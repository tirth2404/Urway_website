import mongoose from "mongoose";

const userProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    virtualClusterTag: { type: String, default: "Unclassified" },
    onboardingInputs: { type: Object, required: true },
    lastExtensionInsight: { type: String, default: "" },
  },
  { timestamps: true }
);

export const UserProfile = mongoose.model("UserProfile", userProfileSchema);
