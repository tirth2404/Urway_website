import mongoose from "mongoose";

/**
 * Collection: auth
 *
 * Stores authentication credentials only — no profile data.
 * Kept strictly separate from user_profiles for security.
 * Indexed on both userId (lookup by JWT claim) and email (login lookup).
 */
const userCredentialSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    // Increment this to invalidate all existing refresh tokens for a user
    // (useful for "sign out of all devices" or password-change flows)
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const UserCredential = mongoose.model(
  "UserCredential",
  userCredentialSchema,
  "auth"           // ← explicit collection name
);
