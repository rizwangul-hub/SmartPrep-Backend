// backend/src/services/ai.service.js
const axios = require("axios");
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

// Helper to call Google Gemini directly using Axios
// Supports both old (AIzaSy...) API keys and new (AQ...) Bearer token keys
const callDirectGemini = async ({ messages, apiKey, temperature }) => {
  let systemInstruction = "";
  const contents = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = msg.content;
    } else {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      contents.push({
        role: role,
        parts: [{ text: msg.content }]
      });
    }
  }

  // Use gemini-2.0-flash (fast, free-tier supported)
  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const headers = { 'Content-Type': 'application/json' };

  const payload = {
    contents: contents,
    generationConfig: {
      temperature: temperature,
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  console.log(`💎 Calling Gemini API (model: ${model})`);

  const response = await axios.post(url, payload, { headers });

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Empty or invalid response from Gemini API");
  }
  return text.trim();
};

// Generic callAI router (retaining the callOpenRouter name to prevent editing all calling functions)
const callOpenRouter = async ({ messages, temperature = 0.7 }) => {
  const settings = await AdminSettings.findOne();

  const geminiApiKey = (process.env.GEMINI_API_KEY || settings?.geminiKey || '').trim();
  const openrouterApiKey = (process.env.OPENROUTER_API_KEY || settings?.openrouterKey || settings?.openaiKey || '').trim();

  const provider = (process.env.AI_PROVIDER || settings?.aiProvider || 'openrouter').toLowerCase();
  const normalizedProvider = provider === 'openrouter' ? 'openrouter' : provider === 'gemini' ? 'gemini' : 'openrouter';

  if (normalizedProvider === 'gemini') {
    const apiKey = geminiApiKey || openrouterApiKey;
    if (!apiKey) {
      throw new Error("No Gemini API key configured. Set GEMINI_API_KEY or geminiKey in admin settings.");
    }

    const isGeminiStyleKey = /^AQ\.|^AIzaSy/.test(apiKey);
    if (!isGeminiStyleKey) {
      console.warn("Provider is gemini, but the provided key does not look like Gemini style. Sending request anyway.");
    }

    try {
      console.warn(`Using Gemini API because provider=${normalizedProvider}.`);
      return await callDirectGemini({ messages, apiKey, temperature });
    } catch (geminiErr) {
      console.error(`Gemini request failed: ${geminiErr.message}`);
      throw geminiErr;
    }
  }

  if (!openrouterApiKey) {
    throw new Error("No OpenRouter API key configured. Please add OPENROUTER_API_KEY or openrouterKey in admin settings.");
  }

  const looksLikeGeminiKey = /^AQ\.|^AIzaSy/.test(openrouterApiKey);
  if (looksLikeGeminiKey) {
    console.warn("OpenRouter provider is selected but the OpenRouter API key looks like a Gemini-style key. Please verify your key.");
  }

  // 2. OpenRouter Call (default)
  // Best models to try in order
  const defaultModel = settings?.defaultModel || "deepseek/deepseek-chat";
  const modelsToTry = [
    defaultModel,
    "deepseek/deepseek-chat",
    "google/gemini-2.5-flash",
    "meta-llama/llama-3.3-70b-instruct:free",
  ];

  const uniqueModels = [...new Set(modelsToTry)];
  let lastError = null;

  for (const model of uniqueModels) {
    try {
      console.log(`🤖 Attempting OpenRouter completion using model: ${model}`);

      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model,
          messages,
          temperature,
        },
        {
          headers: {
            Authorization: `Bearer ${openrouterApiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (content) {
        console.log(`✅ OpenRouter success with model: ${model}`);
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
    const systemPrompt = `You are PrepForce AI, an elite virtual tutor specializing in preparing students for the "${examType}" exam.
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
    const systemPrompt = `You are the PrepForce AI Interview Board. You are conducting a mock job/exam interview for a candidate preparing for "${jobOrExam}".
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

/**
 * Convert extracted raw text into structured MCQs using OpenRouter.
 */
const convertTextToMCQs = async (text) => {
  try {
    const prompt = `AI TASK:
Convert the given educational text into structured MCQs.

Rules:
* Only generate valid MCQs based ONLY on the provided text.
* Each MCQ must have exactly 4 options.
* One correct answer only, indexed by correctOptionIndex (0-3).
* No hallucinated content. Only generate questions from the uploaded content. Do not use external knowledge.
* Must stay within the educational syllabus.
* Detect subject automatically for each question from: English, Urdu, Mathematics, Physics, Chemistry, Biology, Computer, General Knowledge, Islamic Studies, Pakistan Studies, Current Affairs, Intelligence, Verbal Intelligence, Non Verbal Intelligence.
* Detect exam category automatically for each question from: ASF, FIA, ANF, Police, PMA, Army, Navy, Air Force, MDCAT, ECAT, LDC, UDC. If unclear, set to "General".

OUTPUT FORMAT MUST BE STRICT JSON ARRAY OF OBJECTS (No markdown, no explanation, just raw JSON array):
[
  {
    "exam": "ASF",
    "subject": "English",
    "text": "...question...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctOptionIndex": 0,
    "type": "single"
  }
]

Educational text to convert:
\"\"\"
${text}
\"\"\"`;

    const rawText = await callOpenRouter({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const parsed = parseJSONFromText(rawText);
    if (parsed && Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && typeof parsed === "object") {
      return [parsed];
    }
    throw new Error("Parsed content is not a valid JSON array");
  } catch (err) {
    console.error(`❌ convertTextToMCQs error: ${err.message}`);
    throw err;
  }
};

/**
 * Classify multiple questions into subject and exam categories in a single request.
 */
const classifyQuestionsBatch = async (questions) => {
  if (!questions || questions.length === 0) return [];
  
  try {
    const prompt = `AI TASK:
Classify each of the following multiple-choice questions into a subject and exam category.

Allowed subjects: English, Urdu, Mathematics, Physics, Chemistry, Biology, Computer, General Knowledge, Islamic Studies, Pakistan Studies, Current Affairs, Intelligence, Verbal Intelligence, Non Verbal Intelligence.
Allowed exams: ASF, FIA, ANF, Police, PMA, Army, Navy, Air Force, MDCAT, ECAT, LDC, UDC. If unclear, set to "General".

Questions to classify:
${JSON.stringify(questions.map((q, i) => ({ id: i, text: q.text })), null, 2)}

OUTPUT FORMAT MUST BE STRICT JSON ARRAY OF OBJECTS (No markdown, no explanation, just raw JSON array):
[
  { "id": 0, "subject": "Physics", "exam": "ECAT" }
]`;

    const rawText = await callOpenRouter({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const parsed = parseJSONFromText(rawText);
    if (parsed && Array.isArray(parsed)) {
      return parsed;
    }
    throw new Error("Parsed content is not a valid classification array");
  } catch (err) {
    console.error(`❌ classifyQuestionsBatch error: ${err.message}`);
    // Return empty classifications for fallback
    return [];
  }
};

/**
 * Classify multiple question texts into subject categories in a single request.
 */
const classifySubjectsBatch = async (questions) => {
  if (!questions || questions.length === 0) return [];
  
  try {
    const prompt = `AI TASK:
Classify each of the following multiple-choice questions into a subject category and provide a confidence score (from 0 to 100).

Allowed subjects:
* English
* Urdu
* Mathematics
* Physics
* Chemistry
* Biology
* Computer
* General Knowledge
* Islamic Studies
* Pakistan Studies
* Current Affairs
* Intelligence
* Verbal Intelligence
* Non Verbal Intelligence

CLASSIFICATION RULES & GUIDELINES:
1. Islamic Studies: Any question related to Prophets, companions of the Prophet (Sahaba), early Caliphs (Khulafa-e-Rashideen), battles of Islam (Ghazwat), Islamic history, Quran, Hadith, Islamic jurisprudence (Fiqh), pillars of Islam, or Islamic personalities. E.g., "Who was the first Caliph of Islam?" or "In which Ghazwa was the trench dug around Madinah?" must be classified as "Islamic Studies", NOT General Knowledge.
2. Pakistan Studies: Any question related to Quaid-e-Azam, Allama Iqbal, the Pakistan Movement (pre-1947), Pakistan's constitution, political history of Pakistan, geography of Pakistan, national symbols, or historical events of Pakistan. E.g., "Who wrote Shikwa and Jawab-e-Shikwa?" must be classified as "Pakistan Studies", NOT General Knowledge.
3. Current Affairs: Questions about current world leaders (e.g. current prime ministers, presidents, Secretary General of UN), current governments, current events, recent international developments, recent sports events, or recent international summits (G20, COP28, etc.). E.g., "Who is the current Secretary General of the United Nations?" must be classified as "Current Affairs", NOT General Knowledge.
4. General Knowledge: Use this ONLY for questions about countries, capitals, currencies, continents, oceans, mountains, rivers, international organizations (UN, OIC, SAARC, WHO, IMF, World Bank, etc.) in a general/historical context, world geography, and basic world facts. E.g., "What is the capital of Canada?" or "Which organization is headquartered in New York?" belongs to "General Knowledge". General Knowledge must be used as a last resort category.
5. English: Grammar, syntax, synonyms, antonyms, prepositions, tenses, active/passive voice, vocabulary, idioms, etc.
6. Urdu: Urdu grammar, literature, poetry, authors, vocabulary, etc.
7. Mathematics: Algebra, equations, arithmetic, geometry, trigonometry, ratio, averages, calculus, matrices, etc.
8. Physics, Chemistry, Biology, Computer: Direct academic questions in these sciences.
9. Intelligence, Verbal Intelligence, Non Verbal Intelligence: Analogies, coding/decoding, series, logical reasoning, water/mirror images, pattern completion.

Questions to classify:
${JSON.stringify(questions.map((q, i) => ({ id: i, text: q.text })), null, 2)}

OUTPUT FORMAT MUST BE A STRICT JSON ARRAY OF OBJECTS (No markdown block, no explanation, just raw JSON array):
[
  { "id": 0, "subject": "Subject Name", "confidence": 95 }
]`;

    const rawText = await callOpenRouter({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const parsed = parseJSONFromText(rawText);
    if (parsed && Array.isArray(parsed)) {
      return parsed;
    }
    throw new Error("Parsed content is not a valid subject classification array");
  } catch (err) {
    console.error(`❌ classifySubjectsBatch error: ${err.message}`);
    return [];
  }
};

/**
 * Resolves uncertain questions by determining correctOptionIndex and/or subject.
 */
const resolveUncertainMCQsBatch = async (questions) => {
  if (!questions || questions.length === 0) return [];
  
  try {
    const prompt = `AI TASK:
Analyze the following batch of multiple-choice questions. For each question:
1. Classify the subject from the allowed list:
   - English
   - Urdu
   - Mathematics
   - Physics
   - Chemistry
   - Biology
   - Computer
   - General Knowledge
   - Islamic Studies
   - Pakistan Studies
   - Current Affairs
   - Intelligence
   - Verbal Intelligence
   - Non Verbal Intelligence
2. Determine the correct answer from the provided options. Provide the 0-based index of the correct option (0=A, 1=B, 2=C, 3=D). If you cannot find the answer, set correctOptionIndex to -1.

CLASSIFICATION RULES & GUIDELINES:
- Islamic Studies: Prophets, companions (Sahaba), early Caliphs (Khulafa-e-Rashideen), battles of Islam (Ghazwat), Islamic history, Quran, Hadith, Islamic jurisprudence, pillars, Makkah/Madinah, and personalities. E.g., "first Caliph of Islam" is "Islamic Studies".
- Pakistan Studies: Quaid-e-Azam, Allama Iqbal, pre-1947 Pakistan Movement, Pakistan's constitution, geography of Pakistan, national symbols, and history. E.g., "Who wrote Shikwa" is "Pakistan Studies".
- Current Affairs: Current leaders, current governments, recent international developments, recent sports events, summits (G20, COP28, etc.). E.g., "current Secretary General of UN" is "Current Affairs".
- General Knowledge: Countries, capitals, currencies, continents, oceans, mountains, rivers, international organizations (UN, SAARC, WHO, IMF, etc.) in general context, world geography, basic world facts. MUST be the last resort fallback.
- English: Grammar, vocabulary, synonyms, antonyms, etc.
- Urdu: Urdu grammar, literature, poetry, authors, etc.
- Mathematics, Physics, Chemistry, Biology, Computer: Academic questions.
- Intelligence, Verbal/Non Verbal Intelligence: Series, analogies, reasoning, water/mirror images.

Questions to resolve:
${JSON.stringify(questions.map((q, i) => ({ id: i, text: q.text, options: q.options })), null, 2)}

OUTPUT FORMAT MUST BE A STRICT JSON ARRAY OF OBJECTS (No markdown block, no explanation, just raw JSON array):
[
  { "id": 0, "subject": "Subject Name", "correctOptionIndex": 1 }
]`;

    const rawText = await callOpenRouter({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const parsed = parseJSONFromText(rawText);
    if (parsed && Array.isArray(parsed)) {
      return parsed;
    }
    throw new Error("Parsed content is not a valid JSON array");
  } catch (err) {
    console.error(`❌ resolveUncertainMCQsBatch error: ${err.message}`);
    return [];
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
  convertTextToMCQs,
  classifyQuestionsBatch,
  classifySubjectsBatch,
  resolveUncertainMCQsBatch,
};

