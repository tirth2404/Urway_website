import mongoose from "mongoose";

const examSessionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    targetId: { type: String, default: "" },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    terminated: { type: Boolean, default: false },
    redFlag: { type: Boolean, default: false },
    redFlagReason: { type: String, default: "" },
    sourceMaterial: { type: [String], default: [] },
    generatedQuestions: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const ExamSession = mongoose.model("ExamSession", examSessionSchema);
