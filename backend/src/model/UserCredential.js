import mongoose from "mongoose";

const userCredentialSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

export const UserCredential = mongoose.model("UserCredential", userCredentialSchema);
