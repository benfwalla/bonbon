import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// NOTE: This deployment is shared with bonbon - include both schemas
export default defineSchema({
  // ========== BONBON TABLES (DO NOT MODIFY) ==========
  recipes: defineTable({
    url: v.string(),
    videoId: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    ownerComment: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    channelName: v.optional(v.string()),
    channelUrl: v.optional(v.string()),
    channelId: v.optional(v.string()),
    duration: v.optional(v.string()),
    isShort: v.optional(v.boolean()),
    transcript: v.optional(v.string()),
    // What the AI extraction actually had available: "transcript",
    // "description", "pinned comment", or "title only"
    extractionSources: v.optional(v.array(v.string())),
    aiRecipe: v.optional(v.object({
      title: v.optional(v.string()),
      cleanTitle: v.optional(v.string()),
      description: v.optional(v.string()),
      prepTime: v.optional(v.string()),
      cookTime: v.optional(v.string()),
      servings: v.optional(v.string()),
      ingredients: v.array(v.string()),
      instructions: v.array(v.string()),
    })),
    chatHistory: v.optional(v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
    }))),
    aiRecipeStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("failed")
    )),
    aiRecipeError: v.optional(v.string()),
  }).index("by_videoId", ["videoId"]),

  // ========== FITCLAW TABLES ==========
  
  // User profile and settings
  fitUser: defineTable({
    name: v.optional(v.string()),
    goals: v.optional(v.array(v.string())), // ["build muscle", "lose fat", "maintain"]
    experienceLevel: v.optional(v.string()), // beginner, intermediate, advanced
    preferredDuration: v.optional(v.number()), // minutes
    notes: v.optional(v.string()), // any preferences
  }),

  // Equipment inventory
  fitEquipment: defineTable({
    name: v.string(),
    category: v.string(), // "dumbbells", "machines", "cables", "barbells", "cardio", "bodyweight", "other"
    available: v.boolean(), // currently available
    notes: v.optional(v.string()),
  }).index("by_category", ["category"]),

  // Exercise definitions (reference data)
  fitExercises: defineTable({
    name: v.string(),
    muscleGroups: v.array(v.string()), // ["chest", "triceps"]
    equipment: v.array(v.string()), // ["dumbbells", "bench"]
    difficulty: v.string(), // easy, medium, hard
    instructions: v.optional(v.string()),
    isCompound: v.boolean(), // true for squats, false for curls
  }).index("by_muscle", ["muscleGroups"]),

  // Completed workouts
  fitWorkouts: defineTable({
    date: v.string(), // ISO date
    name: v.optional(v.string()), // "Push Day", "Full Body"
    duration: v.optional(v.number()), // minutes
    notes: v.optional(v.string()),
    exercises: v.array(v.object({
      name: v.string(),
      muscleGroups: v.array(v.string()),
      sets: v.array(v.object({
        reps: v.number(),
        weight: v.optional(v.number()), // lbs
        notes: v.optional(v.string()),
      })),
    })),
  }).index("by_date", ["date"]),

  // Chat history with AI trainer
  fitChat: defineTable({
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.number(),
    workoutId: v.optional(v.id("fitWorkouts")), // if this message generated/modified a workout
  }).index("by_timestamp", ["timestamp"]),

  // Current workout in progress
  fitCurrentWorkout: defineTable({
    startedAt: v.number(),
    exercises: v.array(v.object({
      name: v.string(),
      muscleGroups: v.array(v.string()),
      targetSets: v.number(),
      targetReps: v.string(), // "8-12" or "10"
      suggestedWeight: v.optional(v.number()),
      completedSets: v.array(v.object({
        reps: v.number(),
        weight: v.optional(v.number()),
        notes: v.optional(v.string()),
      })),
    })),
    notes: v.optional(v.string()),
  }),
});
