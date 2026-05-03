import mongoose from "mongoose";

/**
 * Collection: vscode_activity
 *
 * Stores coding activity events from the U'rWay VS Code extension.
 * Schema matches the exact fields the extension sends.
 *
 * userId is the canonical UUID from the main backend auth collection.
 * It is resolved by the VS Code extension server after Google login
 * via GET /api/auth/resolve/:email on the main backend.
 *
 * Relationships:
 *  - userId → auth.userId (canonical, nullable before user registers on website)
 */
const vscodeActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: false,   // null if user hasn't linked website account yet
      default: null,
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
  "vscode_activity"    // ← explicit collection name
);
