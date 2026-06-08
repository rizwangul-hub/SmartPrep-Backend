const express = require("express");
const router = express.Router();
const AdminSettings = require("../models/AdminSettings");

// Dev-only endpoint to update AI keys when DEV_ALLOW_ADMIN_UPDATE=true
router.put("/settings", async (req, res) => {
  if (process.env.DEV_ALLOW_ADMIN_UPDATE !== "true") {
    return res.status(403).json({ message: "Dev admin updates are disabled" });
  }

  try {
    let settings = await AdminSettings.findOne();
    if (!settings) settings = new AdminSettings();

    const { openrouterKey, defaultModel } = req.body;
    if (openrouterKey) settings.openrouterKey = openrouterKey;
    if (defaultModel) settings.defaultModel = defaultModel;

    settings.updatedAt = Date.now();
    await settings.save();

    res.json({ message: "Dev admin settings updated" });
  } catch (err) {
    console.error("Dev admin update failed:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
