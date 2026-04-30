import mongoose from "mongoose";

export async function connectDB(mongoUri, options = {}) {
  const { retries = 5, dbName } = options;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        ...(dbName ? { dbName } : {}),
      });
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = attempt * 1000;
      console.warn(`[DB] Connection attempt ${attempt} failed. Retrying in ${wait}ms…`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}
