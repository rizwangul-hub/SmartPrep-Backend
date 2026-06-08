const express = require("express");
const router = express.Router();
const testController = require("../controllers/testController");
const verifyToken = require("../middleware/auth");

router.use(verifyToken);

router.get("/stages", testController.getExamStages);
router.post("/generate", testController.generateTest);
router.get("/generate/:examId", testController.generateTestByExamId);
router.post("/save-progress", testController.saveProgress);
router.get("/progress/test/:testId", testController.getProgress);
router.get("/progress/:examId", testController.getProgress);
router.get("/:testId", testController.getTestById);

module.exports = router;
