import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  recipes: defineTable({
    url: v.string(),
    videoId: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    channelName: v.optional(v.string()),
    channelId: v.optional(v.string()),
    duration: v.optional(v.string()),
  }).index("by_videoId", ["videoId"]),
});
