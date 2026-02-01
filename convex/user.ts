import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get user profile (singleton - first user record)
export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("fitUser").first();
  },
});

// Create or update user profile
export const upsert = mutation({
  args: {
    name: v.optional(v.string()),
    goals: v.optional(v.array(v.string())),
    experienceLevel: v.optional(v.string()),
    preferredDuration: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("fitUser").first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("fitUser", args);
  },
});
