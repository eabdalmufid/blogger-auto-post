/**
 * index.js — Blogger Auto Post (with cron scheduler)
 *
 * Runs the blog generator on a daily schedule using node-cron.
 * The process stays alive and fires the generator at the configured time.
 *
 * Usage:
 *   npm start          — start the cron scheduler (runs daily)
 *   npm run generate   — run the generator once immediately
 *
 * Configuration via .env file (see .env.example).
 */

const cron = require("node-cron");
const path = require("path");
const fs = require("fs");

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Import the generator
// ---------------------------------------------------------------------------

const generate = require("./generate");

// ---------------------------------------------------------------------------
// Cron schedule
// ---------------------------------------------------------------------------

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "0 7 * * *";

if (!cron.validate(CRON_SCHEDULE)) {
  console.error(`[ERROR] Invalid cron schedule: "${CRON_SCHEDULE}"`);
  process.exit(1);
}

console.log("========================================");
console.log("  Blogger Auto Post — Cron Scheduler");
console.log("========================================");
console.log(`Schedule : ${CRON_SCHEDULE}`);
console.log(`Started  : ${new Date().toISOString()}`);
console.log("----------------------------------------");
console.log("The blog generator will run automatically");
console.log("according to the schedule above.");
console.log("Press Ctrl+C to stop.\n");

// Run the first generation immediately on startup, then schedule
(async () => {
  console.log("[INFO] Running initial blog generation...\n");
  try {
    await generate();
  } catch (err) {
    console.error("[ERROR] Initial generation failed:", err.message || err);
  }

  // Schedule subsequent runs
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log(`\n[CRON] Triggered at ${new Date().toISOString()}`);
    try {
      await generate();
    } catch (err) {
      console.error("[ERROR] Scheduled generation failed:", err.message || err);
    }
  });

  console.log(`[INFO] Cron job scheduled: "${CRON_SCHEDULE}"`);
  console.log("[INFO] Waiting for next scheduled run...\n");
})();
