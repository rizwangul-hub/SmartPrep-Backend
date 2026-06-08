const express = require("express");
const router = express.Router();

// Placeholder /api/projects endpoint for production and development.
// Replace or extend this with real project data or a database-backed model as needed.
router.get("/", (req, res) => {
  res.json({
    success: true,
    projects: [
      {
        id: 1,
        title: "Example Project",
        description: "This endpoint is now available and returns JSON from the backend.",
        url: "",
      },
    ],
  });
});

module.exports = router;
