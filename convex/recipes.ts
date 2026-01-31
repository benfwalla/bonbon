import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";

// Extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
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
    
    let description = details?.description;
    
    // If description is empty and we have channelId, try to get owner's pinned comment
    if ((!description || description.trim() === '') && details?.channelId) {
      const ownerComment = await fetchOwnerComment(args.videoId, details.channelId);
      if (ownerComment) {
        description = ownerComment;
      }
    }
    
    if (metadata || description) {
      await ctx.runMutation(api.recipes.updateMetadata, {
        recipeId: args.recipeId,
        title: metadata?.title,
        channelName: metadata?.channelName,
        thumbnail: metadata?.thumbnail,
        description: description || undefined,
      });
    }
  },
});

export const updateMetadata = mutation({
  args: {
    recipeId: v.id("recipes"),
    title: v.optional(v.string()),
    channelName: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    description: v.optional(v.string()),
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
