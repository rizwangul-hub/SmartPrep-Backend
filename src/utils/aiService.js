// backend/src/utils/aiService.js
const aiService = require("../services/ai.service");

exports.generateQuestions = async (subject, examType, count) => {
  // Check if it's intelligence or general MCQ, and map to appropriate service method
  if (subject.toLowerCase().includes("intelligence")) {
    const isVerbal = subject.toLowerCase().includes("verbal");
    return aiService.generateIntelligenceTest(isVerbal ? "verbal" : "non-verbal", count);
  }
  return aiService.generateAcademicTest(subject, examType, count);
};

exports.generateStudyPlan = async (examType, score, weakAreas) => {
  return aiService.generateStudyPlan(examType, score, weakAreas);
};

exports.chatWithAI = async (message, history, examType) => {
  return aiService.chatAssistant(message, history, examType);
};
