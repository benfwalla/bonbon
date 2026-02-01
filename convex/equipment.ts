import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("fitEquipment").collect();
  },
});

export const listAvailable = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("fitEquipment").collect();
    return all.filter(e => e.available);
  },
});

export const add = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    available: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("fitEquipment", {
      ...args,
      available: args.available ?? true,
    });
  },
});

export const toggle = mutation({
  args: { id: v.id("fitEquipment") },
  handler: async (ctx, args) => {
    const eq = await ctx.db.get(args.id);
    if (eq) {
      await ctx.db.patch(args.id, { available: !eq.available });
    }
  },
});

export const remove = mutation({
  args: { id: v.id("fitEquipment") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Bulk add common equipment sets
export const addPreset = mutation({
  args: { preset: v.string() },
  handler: async (ctx, args) => {
    const presets: Record<string, Array<{ name: string; category: string }>> = {
      "home-basic": [
        { name: "Dumbbells (adjustable)", category: "dumbbells" },
        { name: "Pull-up bar", category: "bodyweight" },
        { name: "Resistance bands", category: "other" },
        { name: "Yoga mat", category: "other" },
      ],
      "home-full": [
        { name: "Dumbbells (adjustable)", category: "dumbbells" },
        { name: "Barbell + plates", category: "barbells" },
        { name: "Squat rack", category: "barbells" },
        { name: "Bench (adjustable)", category: "other" },
        { name: "Pull-up bar", category: "bodyweight" },
        { name: "Resistance bands", category: "other" },
        { name: "Cable machine", category: "cables" },
      ],
      "full-gym": [
        { name: "Dumbbells (full rack)", category: "dumbbells" },
        { name: "Barbells", category: "barbells" },
        { name: "Squat rack", category: "barbells" },
        { name: "Smith machine", category: "machines" },
        { name: "Bench (flat/incline)", category: "other" },
        { name: "Cable machine", category: "cables" },
        { name: "Lat pulldown", category: "cables" },
        { name: "Leg press", category: "machines" },
        { name: "Leg curl/extension", category: "machines" },
        { name: "Chest press machine", category: "machines" },
        { name: "Rowing machine", category: "cardio" },
        { name: "Treadmill", category: "cardio" },
        { name: "Pull-up bar", category: "bodyweight" },
      ],
      "hotel": [
        { name: "Dumbbells (light)", category: "dumbbells" },
        { name: "Treadmill", category: "cardio" },
        { name: "Bodyweight", category: "bodyweight" },
      ],
    };

    const items = presets[args.preset];
    if (!items) return;

    for (const item of items) {
      await ctx.db.insert("fitEquipment", { ...item, available: true });
    }
  },
});

// Clear all equipment
export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("fitEquipment").collect();
    for (const eq of all) {
      await ctx.db.delete(eq._id);
    }
  },
});
