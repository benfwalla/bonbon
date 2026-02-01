import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";

// Extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  // Normalize mobile URLs
  const normalizedUrl = url.replace('m.youtube.com', 'youtube.com');
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = normalizedUrl.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Fetch video metadata from YouTube oEmbed API
async function fetchVideoMetadata(url: string) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      title: data.title,
      channelName: data.author_name,
      thumbnail: data.thumbnail_url,
    };
  } catch {
    return null;
  }
}

// Fetch full video details including description from YouTube Data API
async function fetchVideoDetails(videoId: string): Promise<{ description?: string; channelId?: string } | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;
  
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.items?.[0]?.snippet) return null;
    
    return {
      description: data.items[0].snippet.description,
      channelId: data.items[0].snippet.channelId,
    };
  } catch {
    return null;
  }
}

// Fetch pinned/owner comment when description is empty
async function fetchOwnerComment(videoId: string, channelId: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;
  
  try {
    // Get top comments sorted by relevance (pinned usually comes first)
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?videoId=${videoId}&part=snippet&order=relevance&maxResults=10&key=${apiKey}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    
    // Look for a comment from the channel owner
    for (const item of data.items || []) {
      const comment = item.snippet?.topLevelComment?.snippet;
      if (comment?.authorChannelId?.value === channelId) {
        return comment.textOriginal || comment.textDisplay;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("recipes").order("desc").collect();
  },
});

export const get = query({
  args: { id: v.id("recipes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const add = mutation({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const videoId = extractVideoId(args.url);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    // Check if already exists
    const existing = await ctx.db
      .query("recipes")
      .withIndex("by_videoId", (q) => q.eq("videoId", videoId))
      .first();
    
    if (existing) {
      throw new Error("Recipe already saved");
    }

    // Normalize URL
    const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Get thumbnail from video ID
    const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // Insert with basic info first
    const recipeId = await ctx.db.insert("recipes", {
      url: normalizedUrl,
      videoId,
      thumbnail,
    });

    // Schedule action to fetch full metadata
    await ctx.scheduler.runAfter(0, api.recipes.fetchMetadata, {
      recipeId,
      url: normalizedUrl,
      videoId,
    });

    return recipeId;
  },
});

export const fetchMetadata = action({
  args: { recipeId: v.id("recipes"), url: v.string(), videoId: v.string() },
  handler: async (ctx, args) => {
    // Get basic metadata from oEmbed
    const metadata = await fetchVideoMetadata(args.url);
    
    // Try to get description from YouTube Data API
    const details = await fetchVideoDetails(args.videoId);
    
    // Get description (may be empty string)
    const description = details?.description?.trim() || undefined;
    
    // Always try to get owner's pinned comment if we have channelId
    let ownerComment: string | undefined;
    if (details?.channelId) {
      const comment = await fetchOwnerComment(args.videoId, details.channelId);
      ownerComment = comment || undefined;
    }
    
    if (metadata || description || ownerComment) {
      await ctx.runMutation(api.recipes.updateMetadata, {
        recipeId: args.recipeId,
        title: metadata?.title,
        channelName: metadata?.channelName,
        thumbnail: metadata?.thumbnail,
        description,
        ownerComment,
      });
    }

    // Schedule AI recipe extraction (runs in Node runtime from ai.ts)
    await ctx.scheduler.runAfter(0, api.ai.extractAIRecipe, {
      recipeId: args.recipeId,
    });
  },
});

export const updateMetadata = mutation({
  args: {
    recipeId: v.id("recipes"),
    title: v.optional(v.string()),
    channelName: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    description: v.optional(v.string()),
    ownerComment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { recipeId, ...updates } = args;
    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(recipeId, cleanUpdates);
  },
});

export const remove = mutation({
  args: { id: v.id("recipes") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const updateAIRecipeStatus = mutation({
  args: {
    recipeId: v.id("recipes"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.recipeId, {
      aiRecipeStatus: args.status,
      aiRecipeError: args.error,
    });
  },
});

// Trigger AI extraction from frontend (schedules the action)
export const triggerAIExtraction = mutation({
  args: { recipeId: v.id("recipes") },
  handler: async (ctx, args) => {
    // Mark as pending and schedule extraction
    await ctx.db.patch(args.recipeId, {
      aiRecipeStatus: "pending",
      aiRecipeError: undefined,
    });
    await ctx.scheduler.runAfter(0, api.ai.extractAIRecipe, {
      recipeId: args.recipeId,
    });
  },
});

export const updateAIRecipe = mutation({
  args: {
    recipeId: v.id("recipes"),
    aiRecipe: v.object({
      title: v.optional(v.string()),
      cleanTitle: v.optional(v.string()),
      description: v.optional(v.string()),
      prepTime: v.optional(v.string()),
      cookTime: v.optional(v.string()),
      servings: v.optional(v.string()),
      ingredients: v.array(v.string()),
      instructions: v.array(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.recipeId, {
      aiRecipe: args.aiRecipe,
      aiRecipeStatus: "done",
      aiRecipeError: undefined,
    });
  },
});

export const addChatMessage = mutation({
  args: {
    recipeId: v.id("recipes"),
    userMessage: v.string(),
    assistantMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe) throw new Error("Recipe not found");

    const history = recipe.chatHistory || [];
    history.push(
      { role: "user", content: args.userMessage },
      { role: "assistant", content: args.assistantMessage }
    );

    await ctx.db.patch(args.recipeId, { chatHistory: history });
  },
});

export const clearChat = mutation({
  args: { recipeId: v.id("recipes") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.recipeId, { chatHistory: [] });
  },
});
