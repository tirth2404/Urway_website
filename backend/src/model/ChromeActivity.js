import mongoose from "mongoose";

/**
 * Collection: chrome_activity
 *
 * Stores each browser-tab event synced from the U'rWay Chrome extension.
 * High-volume write collection — keep the schema lean.
 * Old records can be TTL-pruned after 90 days (see index below).
 *
 * Relationships:
 *  - userId → user_profiles.userId
 *
 * Renamed from: ExtensionActivity / extensionactivities
 */
const chromeActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
    },
    title: { type: String, default: "" },
    secondsSpent: { type: Number, default: 0, min: 0 },
    category: {
      type: String,
      enum: ["learning", "distracting", "ai-site", "neutral", "unknown"],
      default: "unknown",
    },
    capturedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index — most activity queries filter by userId then sort by capturedAt
chromeActivitySchema.index({ userId: 1, capturedAt: -1 });

// Optional TTL index — auto-delete records older than 90 days
// Uncomment in production once data retention policy is confirmed:
// chromeActivitySchema.index({ capturedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const ChromeActivity = mongoose.model(
  "ChromeActivity",
  chromeActivitySchema,
  "chrome_activity"    // ← explicit collection name
);
