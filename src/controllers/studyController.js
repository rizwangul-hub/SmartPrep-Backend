// backend/src/controllers/studyController.js
const StudyPlan = require("../models/StudyPlan");
const Result = require("../models/Result");
const aiService = require("../utils/aiService");
const aiServiceDirect = require("../services/ai.service");

// Get active study plan for user, or generate on the fly
exports.getStudyPlan = async (req, res) => {
  try {
    let plan = await StudyPlan.findOne({ user: req.user.id }).sort({
      createdAt: -1,
    });

    if (!plan) {
      // Find latest result to assess weak areas
      const latestResult = await Result.findOne({ user: req.user.id })
        .populate({
          path: "answers.question",
          select: "text options correctOptionIndex",
        })
        .sort({ takenAt: -1 });

      const score = latestResult ? latestResult.score : 70; // fallback default
      const examName = req.user.desiredExam || "General Competency Exams";
      const weakAreas = [];

      if (latestResult && latestResult.answers) {
        latestResult.answers.forEach((ans) => {
          if (!ans.isCorrect && ans.question) {
            // Very simple keyword parser for weak areas
            const words = ans.question.text.split(" ");
            if (words.length > 2) {
              weakAreas.push(
                words[words.length - 2] + " " + words[words.length - 1],
              );
            }
          }
        });
      }

      const generated = await aiService.generateStudyPlan(
        examName,
        score,
        weakAreas.slice(0, 4),
      );

      plan = await StudyPlan.create({
        user: req.user.id,
        exam: examName,
        dailyPlan: generated.dailyPlan,
        weeklyPlan: generated.weeklyPlan,
        monthlyPlan: generated.monthlyPlan,
        weakAreas: generated.weakAreas,
        strongAreas: generated.strongAreas,
      });
    }

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
