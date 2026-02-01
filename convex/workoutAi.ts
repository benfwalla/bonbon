"use node";

import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Chat with AI trainer
export const chat = action({
  args: { message: v.string() },
  handler: async (ctx, args): Promise<string> => {
    // Get context
    const [user, equipment, recentWorkouts, muscleHistory, chatHistory] = await Promise.all([
      ctx.runQuery(api.user.get),
      ctx.runQuery(api.equipment.listAvailable),
      ctx.runQuery(api.workouts.getRecent, { days: 7 }),
      ctx.runQuery(api.workouts.getMuscleHistory, { days: 7 }),
      ctx.runQuery(api.chat.getRecent, { limit: 20 }),
    ]);

    const systemPrompt = buildSystemPrompt(user, equipment, recentWorkouts, muscleHistory);
    
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...chatHistory.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: args.message },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const reply = response.choices[0]?.message?.content || "I couldn't generate a response.";

    // Save chat messages
    await ctx.runMutation(api.chat.addExchange, {
      userMessage: args.message,
      assistantMessage: reply,
    });

    return reply;
  },
});

// Generate a workout
export const generateWorkout = action({
  args: {
    request: v.optional(v.string()), // "push day", "quick 20 min", "hotel gym"
  },
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const [user, equipment, recentWorkouts, muscleHistory] = await Promise.all([
      ctx.runQuery(api.user.get),
      ctx.runQuery(api.equipment.listAvailable),
      ctx.runQuery(api.workouts.getRecent, { days: 7 }),
      ctx.runQuery(api.workouts.getMuscleHistory, { days: 7 }),
    ]);

    const systemPrompt = `You are an expert personal trainer AI. Generate a workout plan based on the user's context.

USER PROFILE:
${user ? `
- Name: ${user.name || "User"}
- Goals: ${user.goals?.join(", ") || "general fitness"}
- Experience: ${user.experienceLevel || "intermediate"}
- Preferred duration: ${user.preferredDuration || 45} minutes
- Notes: ${user.notes || "none"}
` : "No profile set up yet."}

AVAILABLE EQUIPMENT:
${equipment.length > 0 ? equipment.map((e) => `- ${e.name}`).join("\n") : "Bodyweight only"}

RECENT WORKOUTS (last 7 days):
${recentWorkouts.length > 0 ? recentWorkouts.map((w) => {
  const muscles = [...new Set(w.exercises.flatMap((e) => e.muscleGroups))];
  return `- ${w.date}: ${w.name || "Workout"} (${muscles.join(", ")})`;
}).join("\n") : "No recent workouts"}

MUSCLE RECOVERY STATUS:
${Object.entries(muscleHistory).length > 0 ? Object.entries(muscleHistory).map(([muscle, data]) => 
  `- ${muscle}: worked ${data.daysSince} days ago (${data.totalSets} sets)`
).join("\n") : "All muscles fully recovered"}

RULES:
1. Prioritize muscles that haven't been worked in 48+ hours
2. Don't hit the same muscle group on consecutive days
3. Suggest weights based on previous performance when available
4. For compound movements (squats, deadlifts, bench), prioritize those first
5. Match workout to available equipment only
6. Keep the workout to the preferred duration

Respond with a JSON object (no markdown, just JSON):
{
  "name": "Workout Name",
  "targetDuration": 45,
  "notes": "Brief explanation of why this workout",
  "exercises": [
    {
      "name": "Exercise Name",
      "muscleGroups": ["primary", "secondary"],
      "targetSets": 3,
      "targetReps": "8-12",
      "suggestedWeight": 50,
      "notes": "Optional tip"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: args.request || "Generate a smart workout for today based on my recovery and goals." },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || "{}";
    
    try {
      // Parse JSON (handle potential markdown wrapping)
      const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
      const workout = JSON.parse(jsonStr);
      return workout;
    } catch {
      return { error: "Failed to parse workout", raw: content };
    }
  },
});

function buildSystemPrompt(
  user: any,
  equipment: any[],
  recentWorkouts: any[],
  muscleHistory: Record<string, { lastWorked: string; daysSince: number; totalSets: number }>
): string {
  return `You are FitClaw, an AI personal trainer. You're knowledgeable, motivating, and concise.

USER PROFILE:
${user ? `
- Name: ${user.name || "User"}
- Goals: ${user.goals?.join(", ") || "general fitness"}
- Experience: ${user.experienceLevel || "intermediate"}
- Preferred workout duration: ${user.preferredDuration || 45} minutes
- Notes: ${user.notes || "none"}
` : "No profile set up yet. Help them set one up!"}

AVAILABLE EQUIPMENT:
${equipment.length > 0 ? equipment.map((e) => `- ${e.name} (${e.category})`).join("\n") : "No equipment set. Help them add their equipment!"}

RECENT WORKOUTS (last 7 days):
${recentWorkouts.length > 0 ? recentWorkouts.map((w) => {
  const exercises = w.exercises.map((e: any) => {
    const bestSet = e.sets.reduce((best: any, s: any) => 
      (!best || (s.weight || 0) > (best.weight || 0)) ? s : best, null);
    return `${e.name}: ${e.sets.length} sets${bestSet?.weight ? ` (max: ${bestSet.weight}lbs)` : ""}`;
  }).join(", ");
  return `- ${w.date} (${w.name || "Workout"}): ${exercises}`;
}).join("\n") : "No recent workouts logged."}

MUSCLE RECOVERY STATUS:
${Object.entries(muscleHistory).length > 0 ? Object.entries(muscleHistory).map(([muscle, data]) => 
  `- ${muscle}: ${data.daysSince === 0 ? "worked today" : `${data.daysSince} days since last workout`} (${data.totalSets} total sets)`
).join("\n") : "All muscles fully recovered (no recent training data)."}

KEY PRINCIPLES:
- Muscles need 48-72 hours to recover
- Progressive overload: gradually increase weight/reps
- Compound exercises (squat, deadlift, bench, rows) are most efficient
- Balance push/pull/legs throughout the week
- Adaptation occurs during rest, not during the workout

Be helpful, specific, and concise. When generating workouts, consider recovery status and equipment availability.
If they ask for a workout, you can suggest they use the "Generate Workout" feature, or describe one in chat.`;
}
