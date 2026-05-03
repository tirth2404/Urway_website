import mongoose from "mongoose";

/**
 * Collection: user_profiles
 *
 * Stores all user profile data — onboarding inputs, AI-assigned cluster,
 * extension insights, and user preferences. Deliberately separated from
 * the auth collection so credentials are never accidentally returned in
 * profile queries.
 */
const userProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // ── Identity ────────────────────────────────────────────
    name: { type: String, default: "" },
    age: { type: Number, default: null },

    // ── AI Cluster ──────────────────────────────────────────
    virtualClusterTag: {
      type: String,
      default: "Unclassified",
    },
    clusterRationale: {
      type: String,
      default: "",
    },

    // ── Full onboarding payload (preserved for GenAI re-use) ──
    onboardingInputs: {
      type: Object,
      required: true,
    },

    // ── Extension insights ──────────────────────────────────
    lastExtensionInsight: {
      type: String,
      default: "",
    },

    // ── Preferences (split out from onboarding for easy update) ──
    preferences: {
      preferredStudyTime: { type: String, default: "Morning" },
      learningStyle: { type: String, default: "Visual" },
      studyHoursPerDay: { type: String, default: "2–4 hours" },
      notifications: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export const UserProfile = mongoose.model(
  "UserProfile",
  userProfileSchema,
  "user_profiles"    // ← explicit collection name
);
