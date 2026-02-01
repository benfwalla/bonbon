"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";
import { YoutubeTranscript } from "youtube-transcript";

// Fetch YouTube transcript
async function fetchTranscript(videoId: string): Promise<string | null> {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript.map(t => t.text).join(" ");
  } catch (error) {
    console.error("Failed to fetch transcript:", error);
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
- title: Recipe name (string, optional)
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
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    // Parse JSON response
    const parsed = JSON.parse(content);
    return {
      title: parsed.title,
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
