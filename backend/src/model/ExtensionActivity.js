import mongoose from "mongoose";

const extensionActivitySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    url: { type: String, required: true },
    title: { type: String, default: "" },
    secondsSpent: { type: Number, default: 0 },
    category: { type: String, default: "unknown" },
    capturedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const ExtensionActivity = mongoose.model("ExtensionActivity", extensionActivitySchema);
