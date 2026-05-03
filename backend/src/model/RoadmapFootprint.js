import mongoose from "mongoose";

/**
 * Collection: roadmap_footprints
 *
 * Daily progress log — one document per user per target per day.
 * Allows the roadmap engine to track actual vs planned progress over time.
 *
 * Relationships:
 *  - userId → user_profiles.userId
 *  - targetId → roadmap_targets._id
 *  - stepsCompleted[] → roadmap_targets.roadmap[].id
 */
const roadmapFootprintSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    targetId: {
      type: String,
      required: true,
      index: true,
    },

    // ── Date key (YYYY-MM-DD) — one footprint per user/target/day ──
    date: {
      type: String,        // e.g. "2026-05-03"
      required: true,
    },

    // ── Steps completed on this day ──────────────────────────
    stepsCompleted: { type: [String], default: [] },  // step IDs e.g. ["S1", "S2"]

    // ── Time metrics ─────────────────────────────────────────
    minutesStudied: { type: Number, default: 0, min: 0 },

    // ── Self-assessment ──────────────────────────────────────
    mood: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    notes: { type: String, default: "" },

    // ── Extension-derived data ───────────────────────────────
    learningMinsFromBrowser: { type: Number, default: 0 },
    distractingMinsFromBrowser: { type: Number, default: 0 },
    codingMinsFromVscode: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Unique compound index — prevents duplicate footprints for the same day
roadmapFootprintSchema.index({ userId: 1, targetId: 1, date: 1 }, { unique: true });

export const RoadmapFootprint = mongoose.model(
  "RoadmapFootprint",
  roadmapFootprintSchema,
  "roadmap_footprints"   // ← explicit collection name
);
