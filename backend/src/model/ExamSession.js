import mongoose from "mongoose";

/**
 * Collection: exam_sessions
 *
 * Tracks each proctored exam session a user starts.
 * Terminated sessions with redFlag=true are audit records
 * and should never be deleted.
 *
 * Relationships:
 *  - userId → user_profiles.userId
 *  - targetId → roadmap_targets._id (optional link to the target being examined)
 */
const examSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    // Optional — links exam to a specific roadmap target
    targetId: { type: String, default: "" },

    // Source material the user submitted (URLs / topic descriptions)
    sourceMaterial: { type: [String], default: [] },

    // AI-generated questions for this session
    generatedQuestions: { type: [String], default: [] },

    // ── Lifecycle ────────────────────────────────────────────
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    terminated: { type: Boolean, default: false },

    // ── Integrity flags ─────────────────────────────────────
    redFlag: { type: Boolean, default: false },
    redFlagReason: { type: String, default: "" },
    // URL that triggered the flag (for AI-site detection)
    redFlagUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

// Index for fetching all sessions belonging to a user, newest first
examSessionSchema.index({ userId: 1, createdAt: -1 });

export const ExamSession = mongoose.model(
  "ExamSession",
  examSessionSchema,
  "exam_sessions"    // ← explicit collection name
);
