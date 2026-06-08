const express = require("express");
const router = express.Router();
const questionController = require("../controllers/questionController");
const verifyToken = require("../middleware/auth");

const verifyAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Access denied: Admin only" });
};

router.use(verifyToken);

// List question bank items
router.get("/", questionController.getQuestions);
router.get("/meta/subjects", questionController.getSupportedSubjects);
router.get("/:id", questionController.getQuestionById);

// Admin-only question bank management
router.post("/", verifyAdmin, questionController.createQuestion);
router.post("/bulk-upload", verifyAdmin, questionController.bulkUpload);
router.post("/bulk-preview", verifyAdmin, questionController.previewBulk);
router.post("/duplicates", verifyAdmin, questionController.checkDuplicates);
router.put("/:id", verifyAdmin, questionController.updateQuestion);
router.delete("/:id", verifyAdmin, questionController.deleteQuestion);

module.exports = router;
