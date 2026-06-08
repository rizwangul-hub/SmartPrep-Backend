// backend/src/services/ai.service.js
const OpenAI = require("openai");
const AdminSettings = require("../models/AdminSettings");

// Helper to clean and parse JSON from text responses
const parseJSONFromText = (text) => {
  if (!text || typeof text !== "string") return null;

  const cleaned = text
    .replace(/```(?:json)?/gi, "")
    .replace(/^\s*\n+/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const jsonMatch = cleaned.match(/(\[.*\]|\{.*\})/s);
    if (!jsonMatch) return null;

    const candidate = jsonMatch[1];
    try {
      return JSON.parse(candidate);
    } catch (secondErr) {
      // Remove trailing commas in arrays/objects
      const normalized = candidate.replace(/,\s*([}\]])/g, "$1");
      try {
        return JSON.parse(normalized);
      } catch (thirdErr) {
        return null;
      }
    }
  }
};

// Retrieve client and model settings from DB or fallback to process.env
const getOpenRouterClientAndModel = async () => {
  const settings = await AdminSettings.findOne();
  const apiKey = settings?.openrouterKey || process.env.OPENROUTER_API_KEY;
  const defaultModel = settings?.defaultModel || "google/gemini-2.5-flash";

  if (!apiKey) {
    throw new Error("OpenRouter API key is not configured");
  }

  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: apiKey,
  });

  return { client, defaultModel };
};

// Call OpenRouter with automatic model fallback
const callOpenRouter = async ({ messages, temperature = 0.7 }) => {
  const { client, defaultModel } = await getOpenRouterClientAndModel();

  const modelsToTry = [
    defaultModel,
    "deepseek/deepseek-chat",
    "meta-llama/llama-3.3-70b-instruct"
  ];

  // Remove duplicates
  const uniqueModels = [...new Set(modelsToTry)];
  let lastError = null;

  for (const model of uniqueModels) {
    try {
      console.log(`🤖 Attempting OpenRouter completion using model: ${model}`);
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature,
      });

      const content = response.choices?.[0]?.message?.content;
      if (content) {
        return content.trim();
      }
      throw new Error(`Empty response content from model ${model}`);
    } catch (err) {
      console.warn(`⚠️ OpenRouter model ${model} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw new Error(`All OpenRouter models failed. Last error: ${lastError?.message}`);
};

// --- Fallback Mock Generators for safety ---
const getMockMCQs = (subject, examType, count) => {
  return Array.from({ length: count }, (_, i) => ({
    text: `Conceptual MCQ ${i + 1} regarding ${subject} for ${examType}`,
    options: [
      `Standard definition A for ${subject}`,
      `Alternate solution B: Scientific deduction`,
      `Distractor option C: General misconception`,
      `Distractor option D: Out-of-bounds parameter`,
    ],
    correctOptionIndex: Math.floor(Math.random() * 4),
    explanation: `This is a mock explanation for question ${i + 1} of the ${subject} test.`,
    subject,
  }));
};

const getMockStudyPlan = (examType, score) => {
  return {
    dailyPlan: `### 📅 Daily Study Blueprint (${examType})\n- **08:00 AM - 10:00 AM**: Theory study & revision notes.\n- **02:00 PM - 03:30 PM**: Custom MCQ practice & speed evaluation.\n- **08:00 PM - 09:00 PM**: AI-recommended topic reading.`,
    weeklyPlan: `### 🗓️ Weekly Milestones\n- **Weeks 1-2**: Focus heavily on core formulas and conceptual definitions.\n- **Weeks 3-4**: Engage in revision quizzes under strict time constraints.`,
    monthlyPlan: `### 📈 Monthly Strategy\n- Complete 4 full-length practice sessions.\n- Maintain accuracy goals above 85% to maximize competitive ranking.`,
    weakAreas: score < 60 ? ["Core formulas", "Speed tracking"] : ["Advanced parameters"],
    strongAreas: ["General logical deduction"],
  };
};

const getMockResultAnalysis = (score, examType) => {
  return {
    feedback: `You completed the ${examType} mock test with a score of ${score}%. Good effort! Focus on timing and pacing.`,
    weakAreas: score < 70 ? ["Conceptual foundations", "Time management"] : ["Advanced theory application"],
    examRecommendations: score < 50 ? ["Start with foundation level quizzes", "FPSC General Ability basic preparation"] : ["PMA Long Course Mock Test", "MDCAT Biology Advanced Practice"],
  };
};

// --- Reusable Service Layers ---

/**
 * Generate generic MCQs using OpenRouter.
 */
const generateMCQs = async (subject, examType, count = 5, difficulty = "medium") => {
  const countNum = Number(count) || 5;
  try {
    const prompt = `Generate exactly ${countNum} unique multiple choice questions for subject "${subject}" in "${examType}" exam at a "${difficulty}" difficulty level.
Each question must have exactly four answer options, with one correct answer indexed by correctOptionIndex (0 to 3).
Provide a brief conceptual explanation for each question.
Return the output strictly in valid JSON format. Do not wrap the JSON in markdown code blocks or explanation text.
Format structure:
[
  {
    "text": "question text",
    "options": ["option A", "option B", "option C", "option D"],
    "correctOptionIndex": 0,
    "explanation": "why A is correct",
    "subject": "${subject}"
  }
]`;

    const rawText = await callOpenRouter({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const parsed = parseJSONFromText(rawText);
    if (parsed && Array.isArray(parsed)) {
      return parsed;
    }
    throw new Error("Parsed content is not a valid JSON array");
  } catch (err) {
    console.error(`❌ generateMCQs error: ${err.message}. Falling back to mock data.`);
    return getMockMCQs(subject, examType, countNum);
  }
};

/**
 * Generate Intelligence Test questions.
 */
const generateIntelligenceTest = async (type = "verbal", count = 5, difficulty = "medium") => {
  const subjectName = type === "verbal" ? "Verbal Intelligence" : "Non-Verbal Intelligence";
  return generateMCQs(subjectName, "Intelligence Test", count, difficulty);
};

/**
 * Generate Academic Test questions.
 */
const generateAcademicTest = async (subject, examType, count = 5, difficulty = "medium") => {
  return generateMCQs(subject, examType, count, difficulty);
};

/**
 * Analyze test results and detect weak areas.
 */
const analyzeResult = async (score, answers = [], examType = "General Mock Test") => {
  try {
    const prompt = `Analyze a student's mock test results for "${examType}".
Score achieved: ${score}%.
Number of questions: ${answers.length}.
Provide details on weak areas, feedback, and exam recommendations based on their performance.
Return output strictly in JSON format matching:
{
  "feedback": "detailed feedback string",
  "weakAreas": ["weak area list"],
  "examRecommendations": ["recommended exams list"]
}`;

    const rawText = await callOpenRouter({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    });

    const parsed = parseJSONFromText(rawText);
    if (parsed && parsed.feedback) {
      return parsed;
    }
    throw new Error("Unable to parse result analysis JSON");
  } catch (err) {
    console.error(`❌ analyzeResult error: ${err.message}. Falling back to mock analysis.`);
    return getMockResultAnalysis(score, examType);
  }
};

/**
 * Generate custom study plans.
 */
const generateStudyPlan = async (examType, score, weakAreas = []) => {
  try {
    const prompt = `Create a customized daily, weekly, and monthly study planner for a student preparing for "${examType}" who scored ${score}% in a mock exam.
Weak areas identified: ${weakAreas.join(", ")}.
Return output strictly in JSON matching:
{
  "dailyPlan": "markdown format plan",
  "weeklyPlan": "markdown format plan",
  "monthlyPlan": "markdown format plan",
  "weakAreas": ["weak area list"],
  "strongAreas": ["strong area list"]
}`;

    const rawText = await callOpenRouter({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const parsed = parseJSONFromText(rawText);
    if (parsed && parsed.dailyPlan) {
      return parsed;
    }
    throw new Error("Unable to parse study plan JSON");
  } catch (err) {
    console.error(`❌ generateStudyPlan error: ${err.message}. Falling back to mock planner.`);
    return getMockStudyPlan(examType, score);
  }
};

/**
 * Chat Assistant with AI Tutor.
 */
const chatAssistant = async (message, history = [], examType = "General") => {
  try {
    const systemPrompt = `You are SmartPrep AI, an elite virtual tutor specializing in preparing students for the "${examType}" exam.
Your responses should be highly encouraging, structured, and focused on exam concepts, study strategies, and answering questions.
Keep answers concise and clear. Format output in readable markdown. Use general/polite references only (e.g. refer to yourself as the "AI Assistant").`;

    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({
        role: h.sender === "user" ? "user" : "assistant",
        content: h.text,
      })),
      { role: "user", content: message },
    ];

    return await callOpenRouter({
      messages: formattedMessages,
      temperature: 0.7,
    });
  } catch (err) {
    console.error(`❌ chatAssistant error: ${err.message}`);
    return `I am currently operating in offline mode. Please check your internet connection or admin settings. Error: ${err.message}`;
  }
};

/**
 * Mock Interview Assistant.
 */
const mockInterviewAssistant = async (message, history = [], jobOrExam = "General Recruitment") => {
  try {
    const systemPrompt = `You are the SmartPrep AI Interview Board. You are conducting a mock job/exam interview for a candidate preparing for "${jobOrExam}".
Ask one structured interview question at a time, evaluate their response, and provide gentle constructive advice in your follow-ups. Keep it professional.`;

    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({
        role: h.sender === "user" ? "user" : "assistant",
        content: h.text,
      })),
      { role: "user", content: message },
    ];

    return await callOpenRouter({
      messages: formattedMessages,
      temperature: 0.7,
    });
  } catch (err) {
    console.error(`❌ mockInterviewAssistant error: ${err.message}`);
    return `Interview mode offline: ${err.message}`;
  }
};

/**
 * Recommendation Engine for competitive exams.
 */
const recommendExams = async (desiredExam, userProfile = {}) => {
  try {
    const prompt = `Based on a student's profile and desired goal, recommend competitive examinations.
Desired Goal/Exam: ${desiredExam}
Profile details: ${JSON.stringify(userProfile)}
Provide a structured list of recommendations.
Return output strictly in JSON matching:
{
  "recommendations": [
    {
      "name": "Exam Name",
      "suitability": "High/Medium/Low",
      "reason": "Brief reason for suitability"
    }
  ]
}`;

    const rawText = await callOpenRouter({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    const parsed = parseJSONFromText(rawText);
    if (parsed && parsed.recommendations) {
      return parsed.recommendations;
    }
    throw new Error("Unable to parse exam recommendations JSON");
  } catch (err) {
    console.error(`❌ recommendExams error: ${err.message}`);
    return [
      { name: desiredExam, suitability: "High", reason: "Directly aligns with your desired test prep goal." }
    ];
  }
};

module.exports = {
  generateMCQs,
  generateIntelligenceTest,
  generateAcademicTest,
  analyzeResult,
  generateStudyPlan,
  chatAssistant,
  mockInterviewAssistant,
  recommendExams,
};
