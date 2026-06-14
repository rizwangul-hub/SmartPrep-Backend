const Test = require("../models/Test");
const Exam = require("../models/Exam");
const Question = require("../models/Question");
const Result = require("../models/Result");
const User = require("../models/User");
const redis = require("../config/redis");
const {
  EXAM_SYLLABUS,
  normalizeExamKey,
} = require("../constants/questionConstants");

const mapSyllabusKeyToDbSubjects = (key) => {
  const k = key.trim().toLowerCase();
  if (k === "english") return ["English", "English "];
  if (k.includes("general knowledge") && k.includes("current affairs")) return ["General Knowledge", "GK", "Current Affairs"];
  if (k.includes("general knowledge") && k.includes("everyday science")) return ["General Knowledge", "GK", "Everyday Science", "Science"];
  if (k === "general knowledge" || k === "gk") return ["General Knowledge", "GK"];
  if (k === "current affairs") return ["Current Affairs"];
  if (k === "pakistan studies") return ["Pakistan Studies"];
  if (k === "islamic studies & urdu") return ["Islamic Studies", "Urdu"];
  if (k === "islamic studies" || k === "islamiat") return ["Islamic Studies"];
  if (k === "urdu") return ["Urdu"];
  if (k.includes("mathematics") && k.includes("intelligence")) return ["Mathematics", "Intelligence", "Verbal Intelligence", "Non Verbal Intelligence"];
  if (k === "mathematics" || k === "math") return ["Mathematics"];
  if (k === "physics") return ["Physics"];
  if (k === "chemistry") return ["Chemistry"];
  if (k === "biology") return ["Biology"];
  if (k === "computer") return ["Computer"];
  if (k === "iq / intelligence" || k === "intelligence" || k === "analytical reasoning" || k === "logical reasoning") {
    return ["Intelligence", "Verbal Intelligence", "Non Verbal Intelligence"];
  }
  if (k === "verbal intelligence") return ["Verbal Intelligence"];
  if (k === "non verbal intelligence") return ["Non Verbal Intelligence"];
  if (k === "anf related questions") return ["ANF Related Questions", "ANF", "General Knowledge"];
  if (k === "chemistry / computer") return ["Chemistry", "Computer"];
  if (k === "law basics") return ["Law Basics", "General Knowledge"];
  return [key];
};

const getCurrentStageForExam = async (userId, examKey) => {
  const results = await Result.find({ user: userId })
    .populate("exam")
    .populate("test")
    .lean();

  const examResults = results.filter((r) => {
    const nameMatch = (r.examName || "").trim().toLowerCase();
    const testTitle = r.test ? (r.test.title || "").trim().toLowerCase() : "";
    const examTitle = r.exam ? (r.exam.title || "").trim().toLowerCase() : "";
    
    return (
      nameMatch.includes(examKey) ||
      testTitle.includes(examKey) ||
      examTitle.includes(examKey) ||
      (examKey === "air force" && (nameMatch.includes("paf") || testTitle.includes("paf") || examTitle.includes("paf")))
    );
  });

  const checkPassed = (keywords) => {
    return examResults.some((r) => {
      if (r.score < 50) return false;
      const testTitle = r.test ? (r.test.title || "").toLowerCase() : "";
      const examTitle = r.exam ? (r.exam.title || "").toLowerCase() : "";
      return keywords.some((kw) => testTitle.includes(kw) || examTitle.includes(kw));
    });
  };

  if (examKey === "pma") {
    const passedStep1 = checkPassed(["verbal intelligence", "step 1"]);
    const passedStep2 = checkPassed(["non-verbal intelligence", "non verbal intelligence", "step 2"]);
    const passedStep3 = checkPassed(["academic", "step 3"]);
    
    let step = 1;
    if (passedStep1) step = 2;
    if (passedStep1 && passedStep2) step = 3;
    
    return {
      step,
      passed: [passedStep1, passedStep2, passedStep3],
      stagesList: [
        { number: 1, name: "Step 1: Verbal Intelligence Test", passed: passedStep1 },
        { number: 2, name: "Step 2: Non-Verbal Intelligence Test", passed: passedStep2 },
        { number: 3, name: "Step 3: Academic Written Exam", passed: passedStep3 }
      ]
    };
  }

  if (examKey === "navy") {
    const passedStep1 = checkPassed(["intelligence", "step 1"]);
    const passedStep2 = checkPassed(["academic", "step 2"]);
    
    let step = 1;
    if (passedStep1) step = 2;
    
    return {
      step,
      passed: [passedStep1, passedStep2],
      stagesList: [
        { number: 1, name: "Step 1: Intelligence Test (Verbal/Non-Verbal)", passed: passedStep1 },
        { number: 2, name: "Step 2: Academic Written Exam", passed: passedStep2 }
      ]
    };
  }

  if (examKey === "air force") {
    const passedStep1 = checkPassed(["intelligence", "step 1"]);
    const passedStep2 = checkPassed(["english", "step 2"]);
    const passedStep3 = checkPassed(["physics", "step 3"]);
    const passedStep4 = checkPassed(["mathematics", "math", "step 4"]);
    
    let step = 1;
    if (passedStep1) step = 2;
    if (passedStep1 && passedStep2) step = 3;
    if (passedStep1 && passedStep2 && passedStep3) step = 4;
    
    return {
      step,
      passed: [passedStep1, passedStep2, passedStep3, passedStep4],
      stagesList: [
        { number: 1, name: "Step 1: Intelligence Test", passed: passedStep1 },
        { number: 2, name: "Step 2: English Test", passed: passedStep2 },
        { number: 3, name: "Step 3: Physics Test", passed: passedStep3 },
        { number: 4, name: "Step 4: Mathematics Test", passed: passedStep4 }
      ]
    };
  }

  return null;
};

const sampleSyllabusQuestions = async (examKey, subjectKey, count, selectedIds) => {
  const dbSubjects = mapSyllabusKeyToDbSubjects(subjectKey);
  
  // 1. Try to find questions specific to this exam first
  const matchWithExam = {
    subject: { $in: dbSubjects },
    examName: { $regex: examKey, $options: "i" },
    isActive: true,
    ...(selectedIds.size ? { _id: { $nin: Array.from(selectedIds) } } : {})
  };
  
  let available = await Question.countDocuments(matchWithExam);
  let size = Math.min(count, available);
  let questions = [];
  
  if (size > 0) {
    questions = await Question.aggregate([
      { $match: matchWithExam },
      { $sample: { size } }
    ]);
  }
  
  // 2. If not enough exam-specific questions, query generic ones of this subject
  if (questions.length < count) {
    const remainingCount = count - questions.length;
    const matchGeneric = {
      subject: { $in: dbSubjects },
      isActive: true,
      _id: { $nin: [...Array.from(selectedIds), ...questions.map(q => q._id.toString())] }
    };
    
    available = await Question.countDocuments(matchGeneric);
    size = Math.min(remainingCount, available);
    
    if (size > 0) {
      const genericQs = await Question.aggregate([
        { $match: matchGeneric },
        { $sample: { size } }
      ]);
      questions.push(...genericQs);
    }
  }
  
  return questions;
};

const stripCorrectAnswers = (questions) =>
  questions.map((q) => ({
    _id: q._id,
    text: q.text,
    options: q.options,
    subject: q.subject || "General",
    difficulty: q.difficulty || "medium",
  }));

// ── Helper: get seen question IDs for a user+exam from User.seenQuestions ──
const getSeenIdsForExam = async (userId, examType) => {
  const user = await User.findById(userId).select("seenQuestions").lean();
  if (!user) return new Set();
  const entry = (user.seenQuestions || []).find(
    (e) => e.examType.toLowerCase() === examType.toLowerCase()
  );
  return new Set((entry?.questionIds || []).map((id) => id.toString()));
};

// ── Helper: clear seen questions for a user+exam (used on bank exhaustion) ──
const clearSeenIdsForExam = async (userId, examType) => {
  await User.updateOne(
    { _id: userId },
    { $pull: { seenQuestions: { examType: { $regex: `^${examType}$`, $options: "i" } } } }
  );
};

// Generate bank-based mock test from question bank according to syllabus
exports.generateTest = async (req, res) => {
  const { exam = "PMA" } = req.body;
  const examKey = normalizeExamKey(exam);
  const syllabus = EXAM_SYLLABUS[examKey];

  if (!syllabus) {
    return res.status(400).json({
      message: `Unsupported exam type: ${exam}`,
    });
  }

  try {
    let testTitle = "";
    let duration = 100;
    let totalQuestions = 100;
    let distribution = {};

    // Check if stage-based flow (PMA, Navy, Air Force)
    if (syllabus.stages) {
      const stageInfo = await getCurrentStageForExam(req.user.id, examKey);
      const stageObj = syllabus.stages[stageInfo.step - 1] || syllabus.stages[syllabus.stages.length - 1];
      testTitle = stageObj.title;
      duration = stageObj.duration;
      totalQuestions = stageObj.totalQuestions;
      distribution = stageObj.distribution;
    } else {
      testTitle = syllabus.title;
      duration = syllabus.duration;
      totalQuestions = syllabus.totalQuestions;
      distribution = syllabus.distribution;
    }

    // ── Load this user's previously-seen question IDs for this exam ──────────
    const userId = req.user ? req.user.id : null;
    let seenIds = userId ? await getSeenIdsForExam(userId, exam) : new Set();

    const _buildTest = async (excludeIds) => {
      const selectedQuestions = [];
      const selectedIds = new Set(excludeIds); // start exclusion from seen + within-run

      // Sample questions based on syllabus distribution
      for (const [subjectKey, count] of Object.entries(distribution)) {
        const targetCount = Math.round(
          (count / Object.values(distribution).reduce((a, b) => a + b, 0)) * totalQuestions
        );
        const bucketQuestions = await sampleSyllabusQuestions(
          examKey,
          subjectKey,
          targetCount,
          selectedIds
        );
        bucketQuestions.forEach((q) => {
          selectedIds.add(q._id.toString());
          selectedQuestions.push(q);
        });
      }

      // Top up if short
      if (selectedQuestions.length < totalQuestions) {
        const topUpCount = totalQuestions - selectedQuestions.length;
        const matchTopUp = {
          isActive: true,
          _id: { $nin: Array.from(selectedIds) },
        };
        const available = await Question.countDocuments(matchTopUp);
        const size = Math.min(topUpCount, available);
        if (size > 0) {
          const topUpQuestions = await Question.aggregate([
            { $match: matchTopUp },
            { $sample: { size } },
          ]);
          topUpQuestions.forEach((q) => {
            selectedIds.add(q._id.toString());
            selectedQuestions.push(q);
          });
        }
      }

      return selectedQuestions;
    };

    let selectedQuestions = await _buildTest(seenIds);

    // ── Edge case: bank exhausted for this user — reset and retry once ────────
    if (selectedQuestions.length === 0 && seenIds.size > 0) {
      console.log(`[generateTest] Question bank exhausted for user ${userId} on exam "${exam}". Resetting seen history.`);
      if (userId) await clearSeenIdsForExam(userId, exam);
      seenIds = new Set();
      selectedQuestions = await _buildTest(seenIds);
    }

    if (!selectedQuestions.length) {
      return res.status(404).json({
        message: "No active questions are available in the bank for this exam type yet. Please seed questions.",
      });
    }

    const finalQuestions = selectedQuestions.slice(0, totalQuestions);

    const formattedQuestions = finalQuestions.map((q) => ({
      _id: q._id,
      text: q.text,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      explanation: q.explanation || "",
      subject: q.subject || "General",
      difficulty: q.difficulty || "medium",
    }));

    const testDoc = await Test.create({
      title: testTitle,
      examType: exam,
      difficulty: "medium",
      questions: formattedQuestions,
      // Store the original Question ObjectIds so submitGeneratedTest can record them
      questionIds: finalQuestions.map((q) => q._id),
      duration,
      user: userId,
    });

    res.json({
      success: true,
      testId: testDoc._id,
      title: testDoc.title,
      examType: testDoc.examType,
      difficulty: testDoc.difficulty,
      totalQuestions: testDoc.questions.length,
      duration: testDoc.duration,
      distribution: formattedQuestions.reduce((acc, q) => {
        acc[q.subject] = (acc[q.subject] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (err) {
    console.error("Error generating syllabus test:", err);
    res.status(500).json({
      message: "Server error generating syllabus-based mock test",
    });
  }
};

// Fetch generated test for student (no correct answers exposed)
exports.getTestById = async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    res.json({
      _id: test._id,
      title: test.title,
      examType: test.examType,
      duration: test.duration,
      difficulty: test.difficulty,
      questions: stripCorrectAnswers(test.questions),
    });
  } catch (err) {
    console.error("Error fetching test:", err);
    res.status(500).json({ message: "Server error fetching test" });
  }
};

exports.saveProgress = async (req, res) => {
  const { examId, testId, currentIdx, answers, flags, timeLeft } = req.body;
  const sessionKey = testId || examId;

  if (!sessionKey) {
    return res
      .status(400)
      .json({ message: "Exam or Test ID is required to save progress" });
  }

  try {
    const redisKey = `user:${req.user.id}:session:${sessionKey}:progress`;
    const progressData = JSON.stringify({
      currentIdx: Number(currentIdx) || 0,
      answers: answers || {},
      flags: flags || {},
      timeLeft: Number(timeLeft) || 0,
      updatedAt: Date.now(),
    });

    await redis.set(redisKey, progressData, "EX", 7200);
    res.json({ message: "Progress saved successfully to cache" });
  } catch (err) {
    console.error("Redis save progress error:", err);
    res.status(500).json({ message: "Failed to cache progress" });
  }
};

exports.getProgress = async (req, res) => {
  const sessionKey = req.params.testId || req.params.examId;

  try {
    const redisKey = `user:${req.user.id}:session:${sessionKey}:progress`;
    const cachedData = await redis.get(redisKey);

    if (!cachedData) {
      return res.json({ progress: null });
    }

    res.json({ progress: JSON.parse(cachedData) });
  } catch (err) {
    console.error("Redis get progress error:", err);
    res.status(500).json({ message: "Failed to fetch cached progress" });
  }
};

// Returns progress details and next steps for the user
exports.getExamStages = async (req, res) => {
  const { examName } = req.query;
  const userId = req.user.id;
  const examKey = normalizeExamKey(examName);

  try {
    const stageInfo = await getCurrentStageForExam(userId, examKey);

    if (stageInfo) {
      const currentStageObj = stageInfo.stagesList.find(s => s.number === stageInfo.step);
      
      return res.json({
        examName,
        currentStage: stageInfo.step,
        stageName: currentStageObj ? currentStageObj.name : "Qualified / Completed",
        stages: stageInfo.stagesList
      });
    }

    // Fallback for standard non-staged exams
    const results = await Result.find({ user: userId });
    const passed = results.some((r) => r.score >= 50 && (r.examName || "").toLowerCase().includes(examKey));

    res.json({
      examName,
      currentStage: 1,
      stageName: "Comprehensive Mock Exam",
      stages: [
        {
          number: 1,
          name: "Comprehensive Entrance Mock Exam",
          passed: passed,
        },
      ],
    });
  } catch (err) {
    console.error("Error fetching exam stages:", err);
    res
      .status(500)
      .json({ message: "Server error retrieving stage progression" });
  }
};

exports.generateTestByExamId = async (req, res) => {
  try {
    const examId = req.params.examId;
    let examRecord = null;
    if (examId) {
      try {
        examRecord = await Exam.findById(examId).lean();
      } catch {
        // Not a valid ObjectId
      }
    }
    const examTitle = examRecord ? examRecord.title : examId;

    req.body = {
      exam: examTitle || "PMA",
    };
    return exports.generateTest(req, res);
  } catch (err) {
    console.error("generateTestByExamId error:", err);
    res.status(500).json({ message: "Server error generating test" });
  }
};

// ── Reset a user's seen-question history for a given exam type ────────────────
// DELETE /api/tests/seen-questions?exam=ASF
exports.resetSeenQuestions = async (req, res) => {
  const { exam } = req.query;
  if (!exam) {
    return res.status(400).json({ message: "Query param `exam` is required" });
  }
  try {
    await User.updateOne(
      { _id: req.user.id },
      { $pull: { seenQuestions: { examType: { $regex: `^${exam}$`, $options: "i" } } } }
    );
    res.json({ message: `Seen question history cleared for exam: ${exam}` });
  } catch (err) {
    console.error("resetSeenQuestions error:", err);
    res.status(500).json({ message: "Server error resetting seen questions" });
  }
};

// ── Get stats: how many questions a user has seen per exam ────────────────────
// GET /api/tests/seen-questions/stats
exports.getSeenQuestionsStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("seenQuestions").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    const stats = (user.seenQuestions || []).map((e) => ({
      examType: e.examType,
      seenCount: e.questionIds.length,
    }));
    res.json({ stats });
  } catch (err) {
    console.error("getSeenQuestionsStats error:", err);
    res.status(500).json({ message: "Server error fetching seen question stats" });
  }
};
