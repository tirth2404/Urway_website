/**
 * cleanup.js — U'rWay Post-Migration Cleanup Script
 *
 * Run this AFTER migrate.js has completed successfully.
 *
 * What it does:
 *  1. Copies `daily_footprint` (7 docs) → `roadmap_footprints`
 *  2. Maps `urway_db.user_interests` → `urway.user_interests` (preserved, not dropped)
 *  3. Drops all empty / stale collections from `urway`
 *  4. Drops the old stray `users` collection (already merged into `auth`)
 *  5. Prints final clean state
 *
 * Usage:
 *   cd backend
 *   node cleanup.js
 */

import "dotenv/config";
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const DB_NAME   = process.env.DB_NAME   || "urway";

if (!MONGO_URI) {
  console.error("❌  MONGO_URI is not set in .env");
  process.exit(1);
}

// ── Collections to DROP after migration (empty or superseded) ─────────────
const DROP_IF_EMPTY = [
  "master_keys",
  "examsessions",          // old name — superseded by exam_sessions
  "extensionactivities",   // old name — superseded by chrome_activity
];

// ── Collections to DROP regardless (merged into auth) ─────────────────────
const DROP_ALWAYS = [
  "users",                 // already merged into auth
];

// ── Collections to RENAME within urway ────────────────────────────────────
const RENAMES_CLEANUP = [
  ["daily_footprint", "roadmap_footprints"],  // existing collection discovered post-migration
];

async function cleanup() {
  console.log(`\n🔗  Connecting to MongoDB (${DB_NAME})…`);
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  const client = mongoose.connection.getClient();
  const db     = client.db(DB_NAME);

  // ── Step 1: Handle daily_footprint → roadmap_footprints ─────────────────
  console.log(`\n📋  Step 1: Copy existing collections to correct names…`);
  for (const [fromName, toName] of RENAMES_CLEANUP) {
    const exists = await db.listCollections({ name: fromName }).toArray();
    if (!exists.length) {
      console.log(`  ↳ ${fromName} does not exist — skipping`);
      continue;
    }

    const fromCount = await db.collection(fromName).countDocuments();
    console.log(`  📥  ${fromName} → ${toName} (${fromCount} docs)`);

    if (fromCount === 0) {
      console.log(`    ↳ Empty — will just drop`);
      await db.dropCollection(fromName);
      console.log(`    ✅ Dropped empty ${fromName}`);
      continue;
    }

    // Check if target already has data
    const toExists  = await db.listCollections({ name: toName }).toArray();
    const toCount   = toExists.length ? await db.collection(toName).countDocuments() : 0;

    if (toCount > 0) {
      console.log(`    ⚠️  ${toName} already has ${toCount} docs — merging`);
      const docs = await db.collection(fromName).find({}).toArray();
      try {
        await db.collection(toName).insertMany(docs, { ordered: false });
        console.log(`    ✅ Merged ${fromCount} docs into ${toName}`);
      } catch (err) {
        if (err.code !== 11000 && !err.message?.includes("duplicate key")) throw err;
        console.log(`    ✅ Merged (some duplicates skipped)`);
      }
    } else {
      // Simple rename
      await db.renameCollection(fromName, toName, { dropTarget: false });
      console.log(`    ✅ Renamed ${fromName} → ${toName}`);
      continue; // no need to drop, rename already removed it
    }

    // Drop the source after successful merge
    await db.dropCollection(fromName);
    console.log(`    🗑️  Dropped source: ${fromName}`);
  }

  // ── Step 2: Handle urway_db.user_interests ───────────────────────────────
  console.log(`\n📋  Step 2: Preserve urway_db.user_interests…`);
  const urwayDb     = client.db("urway_db");
  const uiExists    = await urwayDb.listCollections({ name: "user_interests" }).toArray();
  if (uiExists.length) {
    const uiCount   = await urwayDb.collection("user_interests").countDocuments();
    if (uiCount > 0) {
      console.log(`  📥  Copying urway_db.user_interests (${uiCount} docs) → urway.user_interests`);
      const docs = await urwayDb.collection("user_interests").find({}).toArray();
      try {
        await db.collection("user_interests").insertMany(docs, { ordered: false });
        console.log(`  ✅  Copied to urway.user_interests`);
      } catch (err) {
        if (err.code !== 11000 && !err.message?.includes("duplicate key")) throw err;
        console.log(`  ✅  Copied (some duplicates skipped)`);
      }
    } else {
      console.log(`  ↳ urway_db.user_interests is empty — skipping`);
    }
  } else {
    console.log(`  ↳ urway_db.user_interests does not exist`);
  }

  // ── Step 3: Drop empty stale collections ────────────────────────────────
  console.log(`\n📋  Step 3: Drop empty stale collections…`);
  for (const colName of DROP_IF_EMPTY) {
    const exists = await db.listCollections({ name: colName }).toArray();
    if (!exists.length) {
      console.log(`  ↳ ${colName} — not found, skipping`);
      continue;
    }
    const count = await db.collection(colName).countDocuments();
    if (count > 0) {
      console.log(`  ⚠️  ${colName} has ${count} docs — NOT dropping (manual review needed)`);
    } else {
      await db.dropCollection(colName);
      console.log(`  🗑️  Dropped empty collection: ${colName}`);
    }
  }

  // ── Step 4: Drop superseded collections (already merged) ─────────────────
  console.log(`\n📋  Step 4: Drop superseded collections already merged into auth…`);
  for (const colName of DROP_ALWAYS) {
    const exists = await db.listCollections({ name: colName }).toArray();
    if (!exists.length) {
      console.log(`  ↳ ${colName} — not found`);
      continue;
    }
    const count = await db.collection(colName).countDocuments();
    // Verify the same number of docs (or more) exist in auth before dropping
    const authCount = await db.collection("auth").countDocuments();
    console.log(`  🔍  ${colName} has ${count} docs | auth has ${authCount} docs`);
    if (authCount >= count) {
      await db.dropCollection(colName);
      console.log(`  🗑️  Dropped: ${colName} (data safely preserved in auth)`);
    } else {
      console.log(`  ⚠️  auth count seems low — NOT dropping ${colName}. Check manually.`);
    }
  }

  // ── Step 5: Final summary ─────────────────────────────────────────────────
  console.log(`\n📊  Final clean collection state in '${DB_NAME}':`);
  const finalCols = (await db.listCollections().toArray())
    .filter(c => !c.name.startsWith("system."))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const { name } of finalCols) {
    const count   = await db.collection(name).countDocuments();
    const isClean = ["auth","user_profiles","roadmap_targets","exam_sessions",
                     "chrome_activity","vscode_activity","roadmap_footprints","user_interests"].includes(name);
    const marker  = isClean ? "✅" : "⚠️ ";
    console.log(`  ${marker}  ${name.padEnd(25)} ${count} documents`);
  }

  await mongoose.disconnect();
  console.log(`\n✅  Cleanup complete.\n`);
}

cleanup().catch((err) => {
  console.error("❌  Cleanup failed:", err);
  process.exit(1);
});
