import mongoose from "mongoose";

/**
 * Collection: roadmap_targets
 *
 * Each document is one learning/career target a user has set.
 * The roadmap array is embedded (denormalised) because steps are always
 * read together with their parent target — there is no use-case for
 * querying steps independently.
 *
 * Relationships:
 *  - userId → user_profiles.userId
 *  - roadmap[].id referenced by roadmap_footprints.stepsCompleted[]
 */
const roadmapStepSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    status: {
      type: String,
      enum: ["complete", "in-progress", "remaining", "overdue"],
      default: "remaining",
    },
    dueDate: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const targetSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    targetName: { type: String, required: true },
    timeline: { type: String, required: true },
    priorKnowledge: {
      type: Number,
      min: 1,
      max: 10,
      required: true,
    },
    description: { type: String, required: true },
    roadmap: {
      type: [roadmapStepSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["complete", "in-progress", "remaining", "overdue"],
      default: "remaining",
    },
  },
  { timestamps: true }
);

// Compound index — most dashboard queries filter by userId then sort by createdAt
targetSchema.index({ userId: 1, createdAt: -1 });

export const Target = mongoose.model(
  "Target",
  targetSchema,
  "roadmap_targets"    // ← explicit collection name
);
