#!/usr/bin/env node
/**
 * SmartPrepAI — MCQ Subject Reclassification Migration
 *
 * Reclassifies MCQs currently stored as "General Knowledge" into correct subjects.
 * NEVER deletes MCQs. Preview is required before applying changes.
 *
 * Usage (from project root):
 *   node scripts/reclassifySubjects.js --preview
 *   node scripts/reclassifySubjects.js --preview --no-ai
 *   node scripts/reclassifySubjects.js --apply --confirm <token>
 */
require("dotenv").config();
const mongoose = require("mongoose");
const reclassifier = require("../src/services/subjectReclassifier.service");

const args = process.argv.slice(2);
const isApply = args.includes("--apply");
const useAi = !args.includes("--no-ai");
const showHelp = args.includes("--help");

function printHelp() {
  console.log(`
SmartPrepAI MCQ Reclassification Script
=========================================

Preview (default — no database writes):
  node scripts/reclassifySubjects.js --preview
  node scripts/reclassifySubjects.js --preview --no-ai

Apply (requires confirmation token from preview):
  node scripts/reclassifySubjects.js --apply --confirm <token>

Reports:
  Preview: reports/reclassification-preview.json
  Final:   reports/reclassification-report.json
`);
}

function printPreview(preview) {
  console.log("\n=== RECLASSIFICATION PREVIEW ===\n");
  console.log(JSON.stringify(preview, null, 2));
  console.log("\n--- Summary ---");
  console.log(`Total GK MCQs analyzed: ${preview.totalMCQs}`);
  console.log(`Will remain General Knowledge: ${preview.generalKnowledge}`);
  console.log(`Will be moved: ${preview.moveCount}`);
  console.log(`\nConfirmation token: ${preview.confirmToken}`);
  console.log(
    "\nTo apply changes, run:\n" +
      `  node scripts/reclassifySubjects.js --apply --confirm ${preview.confirmToken}\n`,
  );
}

async function main() {
  if (showHelp) {
    printHelp();
    process.exit(0);
  }

  const uri = process.env.MONGO_URL || "mongodb://localhost:27017/smartprep";

  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");

    if (isApply) {
      const confirmIdx = args.indexOf("--confirm");
      const confirmToken = confirmIdx !== -1 ? args[confirmIdx + 1] : null;

      if (!confirmToken) {
        console.error("Error: --apply requires --confirm <token> from preview report.");
        process.exit(1);
      }

      const fs = require("fs");
      let preview;
      if (fs.existsSync(reclassifier.PREVIEW_FILE)) {
        const saved = JSON.parse(fs.readFileSync(reclassifier.PREVIEW_FILE, "utf8"));
        preview = saved.preview;
      }

      console.log("\nApplying reclassification (bulkWrite)...\n");
      const report = await reclassifier.applyReclassification({
        confirmToken,
        preview,
      });

      console.log("=== RECLASSIFICATION COMPLETE ===\n");
      console.log(JSON.stringify(report, null, 2));
      console.log(`\nReport saved to: ${reclassifier.REPORT_FILE}`);
    } else {
      console.log(`Running preview${useAi ? " (all GK MCQs via AI)" : " (local rules only)"}...\n`);
      const { preview } = await reclassifier.generatePreview({ useAi });
      printPreview(preview);
      console.log(`Preview saved to: ${reclassifier.PREVIEW_FILE}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Reclassification failed:", err.message);
    try {
      await mongoose.disconnect();
    } catch (_) {
      /* ignore */
    }
    process.exit(1);
  }
}

main();
