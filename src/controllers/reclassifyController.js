/**
 * Admin API for MCQ subject reclassification (preview + confirmed apply).
 */
const reclassifier = require("../services/subjectReclassifier.service");

exports.previewReclassification = async (req, res) => {
  try {
    const useAi = req.body?.useAi !== false;
    const { preview } = await reclassifier.generatePreview({ useAi, saveToFile: true });

    res.json({
      message: "Preview generated. Review before applying.",
      preview,
      previewFile: "reports/reclassification-preview.json",
    });
  } catch (err) {
    console.error("previewReclassification error:", err);
    res.status(500).json({ message: err.message || "Failed to generate preview" });
  }
};

exports.applyReclassification = async (req, res) => {
  try {
    const { confirmToken } = req.body;
    if (!confirmToken) {
      return res.status(400).json({
        message: "confirmToken is required. Run preview first and pass the token.",
      });
    }

    const fs = require("fs");
    let preview;
    let classifications;

    if (fs.existsSync(reclassifier.PREVIEW_FILE)) {
      const saved = JSON.parse(fs.readFileSync(reclassifier.PREVIEW_FILE, "utf8"));
      preview = saved.preview;
      classifications = saved.classifications;
    }

    const report = await reclassifier.applyReclassification({
      confirmToken,
      preview,
      classifications,
    });

    res.json({
      message: "Reclassification applied successfully",
      report,
      reportFile: "reports/reclassification-report.json",
    });
  } catch (err) {
    console.error("applyReclassification error:", err);
    const status = err.message?.includes("token") ? 400 : 500;
    res.status(status).json({ message: err.message || "Failed to apply reclassification" });
  }
};

exports.getReclassificationReport = async (req, res) => {
  try {
    const fs = require("fs");
    const type = req.query.type || "report";

    const filePath =
      type === "preview" ? reclassifier.PREVIEW_FILE : reclassifier.REPORT_FILE;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: `No ${type} file found yet` });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    res.json(data);
  } catch (err) {
    console.error("getReclassificationReport error:", err);
    res.status(500).json({ message: "Failed to read report" });
  }
};
