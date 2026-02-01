import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  recipes: defineTable({
    url: v.string(),
    videoId: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    ownerComment: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    channelName: v.optional(v.string()),
    channelId: v.optional(v.string()),
    duration: v.optional(v.string()),
    // AI-extracted recipe
    aiRecipe: v.optional(v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      prepTime: v.optional(v.string()),
      cookTime: v.optional(v.string()),
      servings: v.optional(v.string()),
      ingredients: v.array(v.string()),
      instructions: v.array(v.string()),
    })),
    aiRecipeStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("failed")
    )),
    aiRecipeError: v.optional(v.string()),
  }).index("by_videoId", ["videoId"]),
});
