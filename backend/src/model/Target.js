import mongoose from "mongoose";

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
    userId: { type: String, required: true, index: true },
    targetName: { type: String, required: true },
    timeline: { type: String, required: true },
    priorKnowledge: { type: Number, min: 1, max: 10, required: true },
    description: { type: String, required: true },
    roadmap: { type: [roadmapStepSchema], default: [] },
    status: {
      type: String,
      enum: ["complete", "in-progress", "remaining", "overdue"],
      default: "remaining",
    },
  },
  { timestamps: true }
);

export const Target = mongoose.model("Target", targetSchema);
