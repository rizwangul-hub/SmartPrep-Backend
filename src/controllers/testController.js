const Test = require("../models/Test");
const Exam = require("../models/Exam");
const Question = require("../models/Question");
const Result = require("../models/Result");
const redis = require("../config/redis");
const {
  EXAM_DISTRIBUTIONS,
  normalizeExamKey,
} = require("../constants/questionConstants");

const sampleBankQuestions = async (match, count, excludeIds = new Set()) => {
  const matchWithExclude = {
    ...match,
    isActive: true,
    ...(excludeIds.size
      ? { _id: { $nin: Array.from(excludeIds) } }
      : {}),
  };
  const available = await Question.countDocuments(matchWithExclude);
  if (!available) return [];
  const size = Math.min(count, available);
  return Question.aggregate([{ $match: matchWithExclude }, { $sample: { size } }]);
};

const buildBalancedTest = async (examName, totalQuestions, difficulty) => {
  const examKey = normalizeExamKey(examName);
  const distribution = EXAM_DISTRIBUTIONS[examKey];

  if (!distribution) {
    return sampleBankQuestions(
      { difficulty, examName: { $regex: examName, $options: "i" } },
      totalQuestions,
    );
  }

  const distributionTotal = Object.values(distribution).reduce((a, b) => a + b, 0);
  const scale = totalQuestions / distributionTotal;
  const selected = [];
  const selectedIds = new Set();

  for (const [subject, count] of Object.entries(distribution)) {
    const bucketCount = Math.max(1, Math.round(count * scale));
    const bucketQuestions = await sampleBankQuestions(
      {
        subject,
        difficulty,
        $or: [
          { examName: { $regex: examName, $options: "i" } },
          { examName: { $exists: false } },
          { examName: null },
          { examName: "" },
        ],
      },
      bucketCount,
      selectedIds,
    );

    bucketQuestions.forEach((q) => {
      selectedIds.add(q._id.toString());
      selected.push(q);
    });
  }

  if (selected.length < totalQuestions) {
    const extra = await sampleBankQuestions(
      { difficulty },
      totalQuestions - selected.length,
      selectedIds,
    );
    selected.push(...extra);
  }

  return selected.slice(0, totalQuestions);
};

const stripCorrectAnswers = (questions) =>
  questions.map((q) => ({
    _id: q._id,
    text: q.text,
    options: q.options,
    subject: q.subject || "General",
    difficulty: q.difficulty || "medium",
  }));

// Generate bank-based mock test from question bank
exports.generateTest = async (req, res) => {
  const {
    exam = "PMA",
    totalQuestions,
    count,
    difficulty = "medium",
  } = req.body;
  const num = Math.max(1, Number(totalQuestions || count) || 100);
  const normalizedDifficulty = ["easy", "medium", "hard"].includes(
    (difficulty || "").toLowerCase(),
  )
    ? difficulty.toLowerCase()
    : "medium";

  try {
    const examRecord = await Exam.findOne({
      title: { $regex: exam, $options: "i" },
    }).lean();

    let questions = [];
    let duration = Math.ceil(num * 0.75);
    let testTitle = `${exam} Practice Test`;

    if (
      examRecord &&
      Array.isArray(examRecord.questionDistribution) &&
      examRecord.questionDistribution.length
    ) {
      const selected = [];
      const selectedIds = new Set();

      for (const bucket of examRecord.questionDistribution) {
        const bucketCount = Math.max(1, Number(bucket.count) || 1);
        const bucketDifficulty = bucket.difficulty || normalizedDifficulty;
        const bucketSubjects = bucket.subject ? [bucket.subject] : [exam];

        const bucketQuestions = await sampleBankQuestions(
          {
            subject: { $in: bucketSubjects },
            difficulty: bucketDifficulty,
          },
          bucketCount,
          selectedIds,
        );

        bucketQuestions.forEach((q) => {
          selectedIds.add(q._id.toString());
          selected.push(q);
        });
      }
      questions = selected.slice(0, num);
      testTitle = examRecord.title;
      duration = examRecord.duration || duration;
    }

    if (!questions.length) {
      questions = await buildBalancedTest(exam, num, normalizedDifficulty);
    }

    if (!questions.length) {
      return res.status(404).json({
        message:
          "No active questions are available in the bank for this exam type yet. Please ask an admin to seed questions.",
      });
    }

    const formattedQuestions = questions.map((q) => ({
      text: q.text,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      explanation: q.explanation || "",
      subject: q.subject || "General",
      difficulty: q.difficulty || normalizedDifficulty,
    }));

    const testDoc = await Test.create({
      title: testTitle,
      examType: exam,
      difficulty: normalizedDifficulty,
      questions: formattedQuestions,
      duration,
      user: req.user ? req.user.id : null,
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
    console.error("Error generating bank-based test:", err);
    res.status(500).json({
      message: "Server error generating mock test from the question bank",
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

exports.getExamStages = async (req, res) => {
  const { examName } = req.query;
  const userId = req.user.id;

  try {
    const results = await Result.find({ user: userId }).populate("exam");

    if (examName === "Pakistan Air Force") {
      const pafResults = results.filter(
        (r) => r.exam && r.exam.title.toLowerCase().includes("air force"),
      );

      const hasPassedStage1 = pafResults.some(
        (r) =>
          r.exam.title.toLowerCase().includes("intelligence") && r.score >= 50,
      );
      const hasPassedStage2 = pafResults.some(
        (r) => r.exam.title.toLowerCase().includes("english") && r.score >= 50,
      );
      const hasPassedStage3 = pafResults.some(
        (r) => r.exam.title.toLowerCase().includes("physics") && r.score >= 50,
      );
      const hasPassedStage4 = pafResults.some(
        (r) => r.exam.title.toLowerCase().includes("math") && r.score >= 50,
      );
      const hasPassedStage5 = pafResults.some((r) =>
        r.exam.title.toLowerCase().includes("personality"),
      );

      let currentStage = 1;
      let stageName = "Stage 1: Verbal Intelligence Test";

      if (hasPassedStage4) {
        currentStage = 5;
        stageName = "Stage 5: Personality Test";
      } else if (hasPassedStage3) {
        currentStage = 4;
        stageName = "Stage 4: Mathematics Test";
      } else if (hasPassedStage2) {
        currentStage = 3;
        stageName = "Stage 3: Physics Test";
      } else if (hasPassedStage1) {
        currentStage = 2;
        stageName = "Stage 2: English Test";
      }

      return res.json({
        examName,
        currentStage,
        stageName,
        stages: [
          {
            number: 1,
            name: "Verbal Intelligence Test",
            passed: hasPassedStage1,
          },
          { number: 2, name: "English Test", passed: hasPassedStage2 },
          { number: 3, name: "Physics Test", passed: hasPassedStage3 },
          { number: 4, name: "Mathematics Test", passed: hasPassedStage4 },
          { number: 5, name: "Personality Test", passed: hasPassedStage5 },
        ],
      });
    }

    if (
      examName === "PMA Long Course" ||
      examName === "Pakistan Army" ||
      examName === "Pakistan Navy"
    ) {
      const milResults = results.filter(
        (r) =>
          r.exam &&
          (r.exam.title.toLowerCase().includes("pma") ||
            r.exam.title.toLowerCase().includes("navy") ||
            r.exam.title.toLowerCase().includes("army")),
      );

      const hasPassedStage1 = milResults.some(
        (r) =>
          r.exam.title.toLowerCase().includes("intelligence") && r.score >= 50,
      );
      const hasPassedStage2 = milResults.some(
        (r) => r.exam.title.toLowerCase().includes("academic") && r.score >= 50,
      );

      let currentStage = 1;
      let stageName = "Stage 1: Intelligence Test";

      if (hasPassedStage1) {
        currentStage = 2;
        stageName = "Stage 2: Academic Test";
      }

      return res.json({
        examName,
        currentStage,
        stageName,
        stages: [
          {
            number: 1,
            name: "Intelligence Test (Verbal/Non-Verbal)",
            passed: hasPassedStage1,
          },
          { number: 2, name: "Academic Written Exam", passed: hasPassedStage2 },
        ],
      });
    }

    res.json({
      examName,
      currentStage: 1,
      stageName: "Comprehensive Mock Exam",
      stages: [
        {
          number: 1,
          name: "Comprehensive Entrance Mock Exam",
          passed: results.some((r) => r.score >= 50),
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
    const count = Number(req.query.count) || 100;
    const difficulty = req.query.difficulty || "medium";

    let examRecord = null;
    if (examId) examRecord = await Exam.findById(examId).lean();
    const examTitle = examRecord ? examRecord.title : examId;

    req.body = {
      exam: examTitle || "PMA",
      totalQuestions: count,
      difficulty,
    };
    return exports.generateTest(req, res);
  } catch (err) {
    console.error("generateTestByExamId error:", err);
    res.status(500).json({ message: "Server error generating test" });
  }
};
