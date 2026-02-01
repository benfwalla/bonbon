import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get recent workouts
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const workouts = await ctx.db
      .query("fitWorkouts")
      .withIndex("by_date")
      .order("desc")
      .take(args.limit ?? 20);
    return workouts;
  },
});

// Get workout by ID
export const get = query({
  args: { id: v.id("fitWorkouts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get last N workouts for context
export const getRecent = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const daysBack = args.days ?? 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const workouts = await ctx.db
      .query("fitWorkouts")
      .withIndex("by_date")
      .order("desc")
      .collect();

    return workouts.filter((w) => w.date >= cutoffStr);
  },
});

// Get muscle groups worked recently (for recovery tracking)
export const getMuscleHistory = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const daysBack = args.days ?? 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const workouts = await ctx.db
      .query("fitWorkouts")
      .withIndex("by_date")
      .order("desc")
      .collect();

    const recentWorkouts = workouts.filter((w) => w.date >= cutoffStr);

    // Build muscle group history
    const muscleHistory: Record<string, { lastWorked: string; daysSince: number; totalSets: number }> = {};
    const today = new Date();

    for (const workout of recentWorkouts) {
      const workoutDate = new Date(workout.date);
      const daysSince = Math.floor((today.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));

      for (const exercise of workout.exercises) {
        for (const muscle of exercise.muscleGroups) {
          if (!muscleHistory[muscle] || workout.date > muscleHistory[muscle].lastWorked) {
            muscleHistory[muscle] = {
              lastWorked: workout.date,
              daysSince,
              totalSets: exercise.sets.length,
            };
          } else {
            muscleHistory[muscle].totalSets += exercise.sets.length;
          }
        }
      }
    }

    return muscleHistory;
  },
});

// Save a completed workout
export const save = mutation({
  args: {
    date: v.string(),
    name: v.optional(v.string()),
    duration: v.optional(v.number()),
    notes: v.optional(v.string()),
    exercises: v.array(
      v.object({
        name: v.string(),
        muscleGroups: v.array(v.string()),
        sets: v.array(
          v.object({
            reps: v.number(),
            weight: v.optional(v.number()),
            notes: v.optional(v.string()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("fitWorkouts", args);
  },
});

// Update a workout
export const update = mutation({
  args: {
    id: v.id("fitWorkouts"),
    name: v.optional(v.string()),
    duration: v.optional(v.number()),
    notes: v.optional(v.string()),
    exercises: v.optional(
      v.array(
        v.object({
          name: v.string(),
          muscleGroups: v.array(v.string()),
          sets: v.array(
            v.object({
              reps: v.number(),
              weight: v.optional(v.number()),
              notes: v.optional(v.string()),
            })
          ),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

// Delete a workout
export const remove = mutation({
  args: { id: v.id("fitWorkouts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Current workout in progress
export const getCurrentWorkout = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("fitCurrentWorkout").first();
  },
});

export const startWorkout = mutation({
  args: {
    exercises: v.array(
      v.object({
        name: v.string(),
        muscleGroups: v.array(v.string()),
        targetSets: v.number(),
        targetReps: v.string(),
        suggestedWeight: v.optional(v.number()),
      })
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Clear any existing current workout
    const existing = await ctx.db.query("fitCurrentWorkout").first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return await ctx.db.insert("fitCurrentWorkout", {
      startedAt: Date.now(),
      exercises: args.exercises.map((e) => ({
        ...e,
        completedSets: [],
      })),
      notes: args.notes,
    });
  },
});

export const logSet = mutation({
  args: {
    exerciseIndex: v.number(),
    reps: v.number(),
    weight: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const current = await ctx.db.query("fitCurrentWorkout").first();
    if (!current) throw new Error("No active workout");

    const exercises = [...current.exercises];
    exercises[args.exerciseIndex].completedSets.push({
      reps: args.reps,
      weight: args.weight,
      notes: args.notes,
    });

    await ctx.db.patch(current._id, { exercises });
  },
});

export const finishWorkout = mutation({
  args: { name: v.optional(v.string()), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const current = await ctx.db.query("fitCurrentWorkout").first();
    if (!current) throw new Error("No active workout");

    const duration = Math.round((Date.now() - current.startedAt) / 60000);

    // Save to workout history
    const workoutId = await ctx.db.insert("fitWorkouts", {
      date: new Date().toISOString().split("T")[0],
      name: args.name,
      duration,
      notes: args.notes || current.notes,
      exercises: current.exercises.map((e) => ({
        name: e.name,
        muscleGroups: e.muscleGroups,
        sets: e.completedSets,
      })),
    });

    // Clear current workout
    await ctx.db.delete(current._id);

    return workoutId;
  },
});

export const cancelWorkout = mutation({
  args: {},
  handler: async (ctx) => {
    const current = await ctx.db.query("fitCurrentWorkout").first();
    if (current) {
      await ctx.db.delete(current._id);
    }
  },
});
