// backend/src/controllers/studyController.js
const StudyPlan = require("../models/StudyPlan");
const Result = require("../models/Result");
const aiService = require("../utils/aiService");
const aiServiceDirect = require("../services/ai.service");

// Get active study plan for user
exports.getStudyPlan = async (req, res) => {
  try {
    const plan = await StudyPlan.findOne({ user: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error retrieving study plan" });
  }
};

// Force rebuild / regenerate plan
exports.regeneratePlan = async (req, res) => {
  try {
    // Delete existing plans for fresh creation
    await StudyPlan.deleteMany({ user: req.user.id });

    const latestResult = await Result.findOne({ user: req.user.id }).sort({
      takenAt: -1,
    });
    const score = latestResult ? latestResult.score : 65;
    const examName = req.user.desiredExam || "General Competency Exams";

    const generated = await aiService.generateStudyPlan(examName, score, [
      "Exam-specific topics",
    ]);

    const plan = await StudyPlan.create({
      user: req.user.id,
      exam: examName,
      dailyPlan: generated.dailyPlan,
      weeklyPlan: generated.weeklyPlan,
      monthlyPlan: generated.monthlyPlan,
      weakAreas: generated.weakAreas,
      strongAreas: generated.strongAreas,
    });

    res.status(201).json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error generating plan" });
  }
};

// AI Chat Assistant
exports.chatAssistant = async (req, res) => {
  const { message, history } = req.body;
  const examType = req.user.desiredExam || "General Competency Exams";

  if (!message) {
    return res.status(400).json({ message: "Message is required" });
  }

  try {
    const reply = await aiService.chatWithAI(message, history || [], examType);
    res.json({ reply });
  } catch (err) {
    console.error("Error in chat assistant:", err);
    res.status(500).json({ message: "Failed to query AI Assistant" });
  }
};

// Mock Interview
exports.mockInterview = async (req, res) => {
  try {
    const { topic, duration } = req.body;
    const examType = req.user.desiredExam || "General Competency Exams";

    if (!topic) {
      return res.status(400).json({ message: "Topic is required" });
    }

    const questions = await aiService.generateMockInterview(
      topic,
      examType,
      duration || 30,
    );
    res.json({ questions });
  } catch (err) {
    console.error("Error in mock interview:", err);
    res.status(500).json({ message: "Failed to generate mock interview" });
  }
};

// Get Recommendations
exports.getRecommendations = async (req, res) => {
  try {
    const latestResult = await Result.findOne({ user: req.user.id }).sort({
      takenAt: -1,
    });
    const plan = await StudyPlan.findOne({ user: req.user.id }).sort({
      createdAt: -1,
    });

    if (!latestResult || !plan) {
      return res.status(404).json({ message: "No study data available" });
    }

    const recommendations = {
      weakAreas: plan.weakAreas || [],
      strongAreas: plan.strongAreas || [],
      suggestedTopics: plan.weakAreas ? plan.weakAreas.slice(0, 3) : [],
      nextSteps: [
        "Complete daily study plan",
        "Take mock tests in weak areas",
        "Review incorrect answers",
        "Practice time management",
      ],
    };

    res.json(recommendations);
  } catch (err) {
    console.error("Error fetching recommendations:", err);
    res.status(500).json({ message: "Failed to fetch recommendations" });
  }
};

// Save custom generated study plan
exports.saveStudyPlan = async (req, res) => {
  try {
    const { exam, weeksRemaining, dailyHours, plan, tips } = req.body;
    
    let studyPlan = await StudyPlan.findOne({ user: req.user.id });
    if (studyPlan) {
      studyPlan.exam = exam || studyPlan.exam;
      studyPlan.weeksRemaining = weeksRemaining;
      studyPlan.dailyHours = dailyHours;
      studyPlan.structuredPlan = plan;
      studyPlan.tips = tips;
      studyPlan.createdAt = new Date(); // update timestamp
      await studyPlan.save();
    } else {
      studyPlan = await StudyPlan.create({
        user: req.user.id,
        exam: exam || "General",
        weeksRemaining,
        dailyHours,
        structuredPlan: plan,
        tips,
      });
    }
    res.json({ success: true, plan: studyPlan });
  } catch (err) {
    console.error("Error saving study plan:", err);
    res.status(500).json({ message: "Failed to save study plan" });
  }
};
