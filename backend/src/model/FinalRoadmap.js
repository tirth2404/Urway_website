import mongoose from "mongoose";

const finalRoadmapStepSchema = new mongoose.Schema(
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

const finalRoadmapSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    targetId: { type: String, required: true, index: true },
    targetName: { type: String, required: true },
    timeline: { type: String, required: true },
    description: { type: String, default: "" },
    priorKnowledge: { type: Number, min: 1, max: 10, default: 5 },
    clusterTag: { type: String, default: "Unclassified" },
    clusterRationale: { type: String, default: "" },
    extensionSummary: { type: String, default: "" },
    keywordsRaw: { type: String, default: "" },
    keywordsList: { type: [String], default: [] },
    steps: { type: [finalRoadmapStepSchema], default: [] },
    source: {
      type: String,
      enum: ["genai", "contextual-fallback", "fallback"],
      default: "genai",
    },
  },
  { timestamps: true }
);

finalRoadmapSchema.index({ userId: 1, createdAt: -1 });
finalRoadmapSchema.index({ userId: 1, targetId: 1 });

export const FinalRoadmap = mongoose.model(
  "FinalRoadmap",
  finalRoadmapSchema,
  "final_roadmaps"
);
