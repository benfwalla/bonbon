import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("fitChat")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
    return messages.reverse(); // Return in chronological order
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("fitChat")
      .withIndex("by_timestamp")
      .order("asc")
      .collect();
  },
});

export const addExchange = mutation({
  args: {
    userMessage: v.string(),
    assistantMessage: v.string(),
    workoutId: v.optional(v.id("fitWorkouts")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("fitChat", {
      role: "user",
      content: args.userMessage,
      timestamp: now,
    });
    await ctx.db.insert("fitChat", {
      role: "assistant",
      content: args.assistantMessage,
      timestamp: now + 1,
      workoutId: args.workoutId,
    });
  },
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("fitChat").collect();
    for (const msg of all) {
      await ctx.db.delete(msg._id);
    }
  },
});
