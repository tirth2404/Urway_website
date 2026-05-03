import mongoose from "mongoose";

/**
 * Collection: logs
 *
 * Stores coding activity events from the U'rWay VS Code extension.
 * Schema matches the exact fields the extension sends.
 *
 * Relationships:
 *  - userId → user_profiles.userId
 *
 * Note: The VS Code extension writes directly to the 'logs' collection.
 * This model points to that same collection so the backend can query it.
 */
const vscodeActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    // ── Project context ──────────────────────────────────────
    project: { type: String, default: "" },       // project/workspace name
    language: { type: String, default: "" },       // programming language

    // ── Session metrics ──────────────────────────────────────
    duration: { type: Number, default: 0, min: 0 },           // duration in seconds
    sessionTimeSeconds: { type: Number, default: 0, min: 0 }, // alias used by extension

    // ── Timestamp from extension ─────────────────────────────
    time: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound index — dashboard queries filter by userId then sort by time
vscodeActivitySchema.index({ userId: 1, time: -1 });

export const VscodeActivity = mongoose.model(
  "VscodeActivity",
  vscodeActivitySchema,
  "vscode_activity"    // ← VS Code extension server now writes here too
);

