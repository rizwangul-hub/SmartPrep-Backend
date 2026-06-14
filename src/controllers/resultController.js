const Result = require("../models/Result");
const Exam = require("../models/Exam");
const Test = require("../models/Test");
const aiService = require("../services/ai.service");

const computeSubjectBreakdown = (items) => {
  const map = {};

  items.forEach(({ subject, isCorrect }) => {
    const key = subject || "General";
    if (!map[key]) map[key] = { subject: key, total: 0, correct: 0 };
    map[key].total += 1;
    if (isCorrect) map[key].correct += 1;
  });

  return Object.values(map).map((s) => ({
    ...s,
    percentage: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
  }));
};

const deriveWeakStrong = (breakdown) => ({
  weakSubjects: breakdown.filter((s) => s.percentage < 50).map((s) => s.subject),
  strongSubjects: breakdown
    .filter((s) => s.percentage >= 70)
    .map((s) => s.subject),
});

// Submit answers for a static Exam
exports.submitExam = async (req, res) => {
  const { examId, answers } = req.body;

  try {
    const exam = await Exam.findById(examId).populate("questions");
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    let correctCount = 0;
    const evaluatedItems = exam.questions.map((q) => {
      const submitted = (answers || []).find(
        (ans) => ans.questionId === q._id.toString(),
      );
      const selectedIndex =
        submitted && submitted.selectedOptionIndex !== undefined
          ? submitted.selectedOptionIndex
          : null;
      const isCorrect =
        selectedIndex !== null && selectedIndex === q.correctOptionIndex;

      if (isCorrect) correctCount += 1;

      return {
        question: q._id,
        selectedOptionIndex: selectedIndex,
        isCorrect,
        subject: q.subject || "General",
      };
    });

    const totalQuestions = exam.questions.length;
    const incorrectCount = totalQuestions - correctCount;
    const score =
      totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;

    const subjectBreakdown = computeSubjectBreakdown(evaluatedItems);
    const { weakSubjects, strongSubjects } = deriveWeakStrong(subjectBreakdown);

    const result = await Result.create({
      user: req.user.id,
      exam: examId,
      examName: exam.title,
      answers: evaluatedItems,
      score,
      correctCount,
      incorrectCount,
      totalQuestions,
      subjectBreakdown,
      weakSubjects,
      strongSubjects,
    });

    res.status(201).json({
      resultId: result._id,
      score,
      percentage: score,
      totalQuestions,
      correctCount,
      incorrectCount,
      subjectBreakdown,
      weakSubjects,
      strongSubjects,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error submitting exam answers" });
  }
};

// Submit answers for a generated Test
exports.submitGeneratedTest = async (req, res) => {
  const { testId, answers } = req.body;

  try {
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    let correctCount = 0;
    const evaluatedItems = test.questions.map((q, idx) => {
      const qId = q._id.toString();
      const submitted = (answers || []).find(
        (ans) => ans.questionId === qId || ans.questionIndex === idx,
      );
      const selectedIndex =
        submitted && submitted.selectedOptionIndex !== undefined
          ? submitted.selectedOptionIndex
          : null;
      const isCorrect =
        selectedIndex !== null && selectedIndex === q.correctOptionIndex;

      if (isCorrect) correctCount += 1;

      return {
        questionIndex: idx,
        selectedOptionIndex: selectedIndex,
        isCorrect,
        subject: q.subject || "General",
      };
    });

    const totalQuestions = test.questions.length;
    const incorrectCount = totalQuestions - correctCount;
    const score =
      totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;

    const subjectBreakdown = computeSubjectBreakdown(evaluatedItems);
    const { weakSubjects, strongSubjects } = deriveWeakStrong(subjectBreakdown);

    const result = await Result.create({
      user: req.user.id,
      test: testId,
      examName: test.examType,
      answers: evaluatedItems,
      score,
      correctCount,
      incorrectCount,
      totalQuestions,
      subjectBreakdown,
      weakSubjects,
      strongSubjects,
    });

    // ── Record question IDs as "seen" for this user + exam type ──────────────
    const questionIds = test.questionIds || [];
    if (questionIds.length > 0 && req.user && req.user.id) {
      const examType = test.examType || "General";
      const User = require("../models/User");

      // Check if the user already has a seenQuestions entry for this exam type
      const user = await User.findById(req.user.id).select("seenQuestions");
      if (user) {
        const existing = user.seenQuestions.find(
          (e) => e.examType.toLowerCase() === examType.toLowerCase()
        );

        if (existing) {
          // Add only IDs that are not already tracked ($addToSet equivalent via JS filter)
          const existingSet = new Set(existing.questionIds.map((id) => id.toString()));
          const newIds = questionIds.filter((id) => !existingSet.has(id.toString()));
          if (newIds.length > 0) {
            await User.updateOne(
              { _id: req.user.id, "seenQuestions.examType": examType },
              { $push: { "seenQuestions.$.questionIds": { $each: newIds } } }
            );
          }
        } else {
          // Create a new entry for this exam type
          await User.updateOne(
            { _id: req.user.id },
            { $push: { seenQuestions: { examType, questionIds } } }
          );
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    res.status(201).json({
      resultId: result._id,
      score,
      percentage: score,
      totalQuestions,
      correctCount,
      incorrectCount,
      subjectBreakdown,
      weakSubjects,
      strongSubjects,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error submitting test answers" });
  }
};


exports.getUserResults = async (req, res) => {
  try {
    const results = await Result.find({ user: req.user.id })
      .populate("exam", "title description duration")
      .sort({ takenAt: -1 });
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching user results" });
  }
};

exports.getResultById = async (req, res) => {
  try {
    const result = await Result.findById(req.params.id)
      .populate("exam", "title duration")
      .populate("test", "title examType duration questions")
      .populate({
        path: "answers.question",
        select: "text options correctOptionIndex subject",
      });

    if (!result) {
      return res.status(404).json({ message: "Result not found" });
    }

    if (result.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to view this result" });
    }

    // Enrich answers from embedded test questions when applicable
    if (result.test && result.test.questions) {
      result.answers = result.answers.map((ans, idx) => {
        const testQ = result.test.questions[ans.questionIndex ?? idx];
        if (!testQ) return ans.toObject ? ans.toObject() : ans;
        return {
          ...(ans.toObject ? ans.toObject() : ans),
          question: {
            text: testQ.text,
            options: testQ.options,
            correctOptionIndex: testQ.correctOptionIndex,
            subject: testQ.subject,
          },
        };
      });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching result details" });
  }
};

exports.getResultAnalysis = async (req, res) => {
  try {
    const result = await Result.findById(req.params.id)
      .populate("exam", "title")
      .populate({
        path: "answers.question",
        select: "text options correctOptionIndex subject",
      });

    if (!result) {
      return res.status(404).json({ message: "Result not found" });
    }

    if (result.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const analysis = await aiService.analyzeResult(
      result.score,
      result.answers || [],
      result.exam?.title || result.examName || "General Mock Test",
    );

    res.json(analysis);
  } catch (err) {
    console.error("Error analyzing result:", err);
    res.status(500).json({ message: "Server error analyzing result" });
  }
};
