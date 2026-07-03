"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";
import { YoutubeTranscript } from "youtube-transcript";

// Decode HTML entities that YouTube caption endpoints leave in the text
// (often double-encoded, e.g. "&amp;#39;")
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

// Fetch captions via YouTube's InnerTube API using the ANDROID client.
// The watch-page scraping that youtube-transcript does gets bot-blocked from
// datacenter IPs (where Convex actions run); the InnerTube player endpoint
// with a mobile client context is what yt-dlp/youtubei.js use and works from servers.
async function fetchTranscriptInnertube(videoId: string): Promise<string | null> {
  const res = await fetch(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "20.10.38",
            androidSdkVersion: 30,
            hl: "en",
          },
        },
        videoId,
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();

  const tracks: Array<{ baseUrl: string; languageCode?: string; kind?: string }> | undefined =
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks?.length) return null;

  // Prefer manually-created English captions, then auto-generated English, then anything
  const track =
    tracks.find((t) => t.languageCode?.startsWith("en") && t.kind !== "asr") ??
    tracks.find((t) => t.languageCode?.startsWith("en")) ??
    tracks[0];

  const capRes = await fetch(`${track.baseUrl}&fmt=json3`);
  if (!capRes.ok) return null;
  const cap = await capRes.json();

  const text = (cap.events ?? [])
    .flatMap((e: { segs?: Array<{ utf8?: string }> }) => e.segs ?? [])
    .map((s: { utf8?: string }) => s.utf8 ?? "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 0 ? text : null;
}

// Fetch YouTube transcript: InnerTube first, legacy library as fallback
async function fetchTranscript(videoId: string): Promise<string | null> {
  try {
    const text = await fetchTranscriptInnertube(videoId);
    if (text) return text;
    console.error("InnerTube returned no caption tracks for", videoId);
  } catch (error) {
    console.error("InnerTube transcript fetch failed:", error);
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    const text = decodeEntities(transcript.map((t) => t.text).join(" "))
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 0 ? text : null;
  } catch (error) {
    console.error("Library transcript fetch failed:", error);
    return null;
  }
}

// Extract recipe using GPT-4o-mini
async function extractRecipeWithAI(
  transcript: string | null,
  description: string | null,
  pinnedComment: string | null,
  videoTitle: string | null
): Promise<{
  title?: string;
  cleanTitle?: string;
  description?: string;
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  ingredients: string[];
  instructions: string[];
} | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("No OpenAI API key found");
    return null;
  }

  // Build context from available sources
  const parts: string[] = [];
  if (videoTitle) parts.push(`Video Title: ${videoTitle}`);
  if (description) parts.push(`Video Description:\n${description}`);
  if (pinnedComment) parts.push(`Pinned Comment from Creator:\n${pinnedComment}`);
  if (transcript) parts.push(`Video Transcript:\n${transcript}`);

  if (parts.length === 0) return null;

  const context = parts.join("\n\n---\n\n");

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `You are a recipe extraction assistant. Given information about a cooking video (transcript, description, pinned comment), extract the recipe into a structured format.

Return a JSON object with these fields:
- title: Original recipe name from the video (string, optional)
- cleanTitle: A simple, generic recipe name without clickbait or filler words. E.g. "The BEST Creamy Garlic Tuscan Salmon (SO EASY!)" becomes "Creamy Garlic Tuscan Salmon". Keep it short and descriptive.
- description: Brief description of the dish (string, optional)
- prepTime: Preparation time like "15 minutes" (string, optional)
- cookTime: Cooking time like "30 minutes" (string, optional)
- servings: Number of servings like "4 servings" (string, optional)
- ingredients: Array of ingredient strings with quantities (e.g., "2 cups flour", "1 tsp salt")
- instructions: Array of step-by-step instruction strings

Be thorough - extract ALL ingredients and steps mentioned. If times/servings aren't mentioned, omit them.
Only return valid JSON, no markdown code blocks.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: context }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    // Parse JSON response (strip markdown fences if the model added them anyway)
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(cleaned);
    return {
      title: parsed.title,
      cleanTitle: parsed.cleanTitle,
      description: parsed.description,
      prepTime: parsed.prepTime,
      cookTime: parsed.cookTime,
      servings: parsed.servings,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
    };
  } catch (error) {
    console.error("Failed to extract recipe with AI:", error);
    return null;
  }
}

// Recipe chat - fast, terse responses
export const chat = action({
  args: {
    recipeId: v.id("recipes"),
    message: v.string(),
    // 1-based step the cook is currently on, when chatting from cook mode
    currentStep: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("No OpenAI API key");
    }

    // Get the recipe for context
    const recipe = await ctx.runQuery(api.recipes.get, { id: args.recipeId });
    if (!recipe) {
      throw new Error("Recipe not found");
    }

    // Build recipe context
    let recipeContext = recipe.aiRecipe ? `
Recipe: ${recipe.aiRecipe.cleanTitle || recipe.aiRecipe.title || recipe.title}
Ingredients: ${recipe.aiRecipe.ingredients.join(", ")}
Instructions: ${recipe.aiRecipe.instructions.join(" | ")}
    `.trim() : `Recipe: ${recipe.title}`;

    // Add transcript if available (truncate to ~4000 chars to save tokens)
    if (recipe.transcript) {
      const truncatedTranscript = recipe.transcript.slice(0, 4000);
      recipeContext += `\n\nVideo Transcript:\n${truncatedTranscript}${recipe.transcript.length > 4000 ? '...' : ''}`;
    }

    // Tell the assistant where the cook currently is in the recipe
    const instructions = recipe.aiRecipe?.instructions ?? [];
    if (
      args.currentStep !== undefined &&
      args.currentStep >= 1 &&
      args.currentStep <= instructions.length
    ) {
      recipeContext += `\n\nThe cook is currently on step ${args.currentStep} of ${instructions.length}: "${instructions[args.currentStep - 1]}"`;
    }

    // Get existing chat history
    const history = recipe.chatHistory || [];

    const openai = new OpenAI({ apiKey });

    const systemPrompt = `You're a cooking assistant helping with this recipe:

${recipeContext}

Rules:
- Be EXTREMELY brief. 1-2 sentences max unless they ask for more detail.
- No filler words, no "Great question!", just answer directly.
- If suggesting substitutes, just list them with a tiny note why.
- Be practical and helpful.

Example:
User: "What can I sub for heavy cream?"
You: "Coconut cream or cashew cream. Both keep it rich and dairy-free."`;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10).map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: args.message }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      // Roomy enough that answers don't get cut off mid-sentence;
      // the system prompt keeps replies short anyway
      max_tokens: 500,
    });

    const reply = response.choices[0]?.message?.content || "Sorry, couldn't help with that.";

    // Save to chat history
    await ctx.runMutation(api.recipes.addChatMessage, {
      recipeId: args.recipeId,
      userMessage: args.message,
      assistantMessage: reply,
    });

    return reply;
  },
});

export const extractAIRecipe = action({
  args: { recipeId: v.id("recipes") },
  handler: async (ctx, args) => {
    // Get the recipe
    const recipe = await ctx.runQuery(api.recipes.get, { id: args.recipeId });
    if (!recipe) {
      throw new Error("Recipe not found");
    }

    // Mark as processing
    await ctx.runMutation(api.recipes.updateAIRecipeStatus, {
      recipeId: args.recipeId,
      status: "processing",
    });

    try {
      // Fetch transcript
      const transcript = await fetchTranscript(recipe.videoId);

      // Record what the AI actually saw, so the UI can show it
      const extractionSources: string[] = [];
      if (transcript) extractionSources.push("transcript");
      if (recipe.description) extractionSources.push("description");
      if (recipe.ownerComment) extractionSources.push("pinned comment");
      if (!transcript && !recipe.description && !recipe.ownerComment && recipe.title) {
        extractionSources.push("title only");
      }

      // Extract recipe with AI
      const aiRecipe = await extractRecipeWithAI(
        transcript,
        recipe.description || null,
        recipe.ownerComment || null,
        recipe.title || null
      );

      if (aiRecipe && (aiRecipe.ingredients.length > 0 || aiRecipe.instructions.length > 0)) {
        await ctx.runMutation(api.recipes.updateAIRecipe, {
          recipeId: args.recipeId,
          aiRecipe,
          transcript: transcript || undefined,
          extractionSources,
        });
      } else {
        await ctx.runMutation(api.recipes.updateAIRecipeStatus, {
          recipeId: args.recipeId,
          status: "failed",
          error: "Could not extract recipe from video content",
        });
      }
    } catch (error) {
      await ctx.runMutation(api.recipes.updateAIRecipeStatus, {
        recipeId: args.recipeId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});
