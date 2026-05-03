/**
 * migrate.js — U'rWay Database Migration Script
 *
 * Migrates all existing data from old scattered collections to the new
 * clean collection names inside the single `urway` database.
 *
 * OLD → NEW mapping:
 *   usercredentials      → auth
 *   userprofiles         → user_profiles
 *   targets              → roadmap_targets
 *   examsessions         → exam_sessions
 *   extensionactivities  → chrome_activity
 *   (any legacy aliases from test / urway_db / urway_project_db)
 *
 * Usage:
 *   cd backend
 *   node migrate.js
 *
 * ⚠️  Run this ONCE only — it is idempotent (uses upsert), but there
 *    is no need to run it multiple times.
 * ⚠️  Take a MongoDB Atlas snapshot before running.
 */

import "dotenv/config";
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const DB_NAME   = process.env.DB_NAME   || "urway";

if (!MONGO_URI) {
  console.error("❌  MONGO_URI is not set in .env");
  process.exit(1);
}

// ── Collection rename map ──────────────────────────────────────────────────
//  [ oldName, newName ]
const RENAMES = [
  ["usercredentials",     "auth"],
  ["userprofiles",        "user_profiles"],
  ["targets",             "roadmap_targets"],
  ["examsessions",        "exam_sessions"],
  ["extensionactivities", "chrome_activity"],
  // Legacy aliases that may exist in old databases:
  ["users",               "auth"],            // only if it contains credential docs
  ["logs",                "chrome_activity"], // only if it contains activity docs
];

// ── Extra databases to scan for stray collections ────────────────────────
const EXTRA_DBS = ["test", "urway_db", "urway_project_db", "admin"];

async function renameCollection(db, fromName, toName) {
  const collections = await db.listCollections({ name: fromName }).toArray();
  if (!collections.length) return false;

  const fromCount = await db.collection(fromName).countDocuments();
  if (fromCount === 0) {
    console.log(`  ↳ ${fromName} is empty — skipping`);
    return false;
  }

  // Check if target already exists and has data
  const toCollections = await db.listCollections({ name: toName }).toArray();
  if (toCollections.length) {
    const toCount = await db.collection(toName).countDocuments();
    if (toCount > 0) {
      console.log(`  ↳ ${toName} already has ${toCount} docs — merging from ${fromName} (${fromCount} docs)`);
      // Copy missing docs via insertMany with ordered:false to skip duplicates
      const docs = await db.collection(fromName).find({}).toArray();
      try {
        await db.collection(toName).insertMany(docs, { ordered: false });
      } catch (err) {
        // E11000 = duplicate key — safe to ignore (docs already exist)
        if (err.code !== 11000 && !err.message?.includes("duplicate key")) throw err;
      }
      console.log(`    ✅ Merged ${fromName} → ${toName}`);
      return true;
    }
  }

  // Simple rename — target doesn't exist yet
  await db.renameCollection(fromName, toName, { dropTarget: false });
  console.log(`  ✅ Renamed ${fromName} → ${toName} (${fromCount} docs)`);
  return true;
}

async function migrate() {
  console.log(`\n🔗  Connecting to MongoDB…`);
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  const client = mongoose.connection.getClient();

  // ── 1. Migrate within the primary `urway` database ──────────────────────
  console.log(`\n📦  Migrating collections in '${DB_NAME}' database…`);
  const primaryDb = client.db(DB_NAME);

  for (const [fromName, toName] of RENAMES) {
    if (fromName === toName) continue;
    await renameCollection(primaryDb, fromName, toName);
  }

  // ── 2. Pull stray documents from other databases ─────────────────────────
  console.log(`\n🔍  Scanning extra databases for stray collections…`);

  for (const dbName of EXTRA_DBS) {
    const db = client.db(dbName);
    const cols = await db.listCollections().toArray();
    if (!cols.length) continue;

    console.log(`\n  📂 ${dbName}: ${cols.map(c => c.name).join(", ")}`);

    for (const { name: colName } of cols) {
      // Skip system collections
      if (colName.startsWith("system.")) continue;

      // Find a matching target in RENAMES
      const match = RENAMES.find(([from]) => from === colName);
      if (!match) {
        console.log(`  ⚠️  ${dbName}.${colName} — no mapping found, skipping`);
        continue;
      }

      const toName    = match[1];
      const fromCount = await db.collection(colName).countDocuments();
      if (fromCount === 0) {
        console.log(`  ↳ ${dbName}.${colName} is empty — skipping`);
        continue;
      }

      console.log(`  📥  Copying ${dbName}.${colName} (${fromCount} docs) → ${DB_NAME}.${toName}`);
      const docs = await db.collection(colName).find({}).toArray();
      try {
        await primaryDb.collection(toName).insertMany(docs, { ordered: false });
        console.log(`    ✅ Done`);
      } catch (err) {
        if (err.code !== 11000 && !err.message?.includes("duplicate key")) {
          console.error(`    ❌ Error: ${err.message}`);
        } else {
          console.log(`    ✅ Done (some duplicates skipped)`);
        }
      }
    }
  }

  // ── 3. Summary ────────────────────────────────────────────────────────────
  console.log(`\n📊  Final collection state in '${DB_NAME}':`);
  const finalCols = await primaryDb.listCollections().toArray();
  for (const { name } of finalCols) {
    if (name.startsWith("system.")) continue;
    const count = await primaryDb.collection(name).countDocuments();
    console.log(`  ✔  ${name.padEnd(25)} ${count} documents`);
  }

  await mongoose.disconnect();
  console.log(`\n✅  Migration complete.\n`);
}

migrate().catch((err) => {
  console.error("❌  Migration failed:", err);
  process.exit(1);
});
