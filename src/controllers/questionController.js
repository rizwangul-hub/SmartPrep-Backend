const Question = require("../models/Question");
const Exam = require("../models/Exam");
const {
  SUPPORTED_SUBJECTS,
  SUPPORTED_DIFFICULTIES,
  normalizeDifficulty,
  normalizeSubject,
} = require("../constants/questionConstants");
const {
  normalizeQuestionsInput,
  extractExamFields,
} = require("../utils/questionPayload");

const INVALID_QUESTIONS_MESSAGE =
  'Provide a JSON array of MCQs, a single MCQ object, or { "questions": [...] }';

const resolveExamId = async (examIdOrName) => {
  if (!examIdOrName) return null;
  try {
    const maybe = await Exam.findById(examIdOrName).select("_id title").lean();
    if (maybe) return maybe._id;
  } catch {
    // not a valid ObjectId
  }
  const byTitle = await Exam.findOne({ title: examIdOrName })
    .select("_id title")
    .lean();
  return byTitle ? byTitle._id : null;
};

const isValidSubject = (subject) => {
  const normalized = normalizeSubject(subject);
  return SUPPORTED_SUBJECTS.some(
    (s) => s.toLowerCase() === normalized.toLowerCase(),
  );
};

// List bank questions with filters — returns paginated result with totalCount
exports.getQuestions = async (req, res) => {
  try {
    const {
      subject,
      difficulty,
      tags,
      examId,
      examName,
      keyword,
      active,
      limit = 20,
      page = 1,
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(Math.max(1, Number(limit)), 100); // max 100 per page
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (subject) {
      filter.subject = { $in: subject.split(",").map((item) => item.trim()) };
    }
    if (difficulty) {
      filter.difficulty = difficulty.toLowerCase();
    }
    if (tags) {
      const tagsArray = tags.split(",").map((tag) => tag.trim());
      filter.tags = { $all: tagsArray };
    }
    if (examId) {
      filter.exam = examId;
    }
    if (examName) {
      filter.examName = { $regex: examName.trim(), $options: "i" };
    }
    if (keyword) {
      filter.text = { $regex: keyword.trim(), $options: "i" };
    }
    if (active !== undefined) {
      filter.isActive = active === "true";
    }

    const [questions, totalCount] = await Promise.all([
      Question.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Question.countDocuments(filter),
    ]);

    res.json({
      questions,
      totalCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      limit: limitNum,
    });
  } catch (err) {
    console.error("Error fetching question bank:", err);
    res.status(500).json({ message: "Server error fetching questions" });
  }
};

exports.getQuestionById = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }
    res.json(question);
  } catch (err) {
    console.error("Error fetching question:", err);
    res.status(500).json({ message: "Server error fetching question" });
  }
};

exports.createQuestion = async (req, res) => {
  const {
    exam,
    examName,
    subject,
    difficulty,
    tags,
    text,
    options,
    correctOptionIndex,
    type,
    explanation,
  } = req.body;

  try {
    const question = await Question.create({
      exam,
      examName: examName || undefined,
      subject: normalizeSubject(subject) || "General Knowledge",
      difficulty: normalizeDifficulty(difficulty),
      tags: Array.isArray(tags) ? tags : [],
      text,
      options,
      correctOptionIndex: Number(correctOptionIndex),
      type: type || "single",
      explanation: explanation || "",
    });

    if (exam) {
      await Exam.findByIdAndUpdate(exam, {
        $addToSet: { questions: question._id },
      });
    }

    res.status(201).json(question);
  } catch (err) {
    console.error("Error creating question:", err);
    res.status(500).json({ message: "Server error creating question" });
  }
};

exports.updateQuestion = async (req, res) => {
  const {
    subject,
    difficulty,
    tags,
    text,
    options,
    correctOptionIndex,
    type,
    explanation,
    isActive,
    examName,
  } = req.body;

  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    if (subject) question.subject = normalizeSubject(subject);
    if (difficulty) question.difficulty = normalizeDifficulty(difficulty);
    if (examName !== undefined) question.examName = examName;
    if (tags)
      question.tags = Array.isArray(tags)
        ? tags
        : tags.split(",").map((item) => item.trim());
    if (text) question.text = text;
    if (options) question.options = options;
    if (correctOptionIndex !== undefined)
      question.correctOptionIndex = Number(correctOptionIndex);
    if (type) question.type = type;
    if (explanation !== undefined) question.explanation = explanation;
    if (isActive !== undefined) question.isActive = isActive;

    await question.save();
    res.json({ message: "Question updated successfully", question });
  } catch (err) {
    console.error("Error updating question:", err);
    res.status(500).json({ message: "Server error updating question" });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    await Exam.updateMany(
      { questions: question._id },
      { $pull: { questions: question._id } },
    );
    await Question.findByIdAndDelete(question._id);

    res.json({ message: "Question deleted successfully" });
  } catch (err) {
    console.error("Error deleting question:", err);
    res.status(500).json({ message: "Server error deleting question" });
  }
};

// Bulk upload questions (admin only)
exports.bulkUpload = async (req, res) => {
  try {
    const questions = normalizeQuestionsInput(req.body);
    const examFields = extractExamFields(req.body);
    const examName = (
      examFields.exam ||
      examFields.examName ||
      ""
    )
      .toString()
      .trim();
    const examIdInput = examFields.examId;

    const resolvedExamId =
      (await resolveExamId(examIdInput)) || (await resolveExamId(examName));

    if (!questions) {
      return res.status(400).json({ message: INVALID_QUESTIONS_MESSAGE });
    }

    const errors = [];
    const toInsert = [];

    questions.forEach((q, idx) => {
      const row = q || {};
      const text = (row.text || "").toString().trim();
      const options = Array.isArray(row.options) ? row.options.map(String) : [];
      const correctOptionIndex = Number(row.correctOptionIndex);
      const subject = normalizeSubject(row.subject);
      const difficulty = normalizeDifficulty(row.difficulty);
      const type = row.type || "single";

      const rowErrors = [];
      if (!text) rowErrors.push("text is required");
      if (!Array.isArray(options) || options.length !== 4)
        rowErrors.push("options must be an array of exactly 4 strings");
      if (
        !(
          Number.isInteger(correctOptionIndex) &&
          correctOptionIndex >= 0 &&
          correctOptionIndex <= 3
        )
      )
        rowErrors.push("correctOptionIndex must be between 0 and 3");
      if (!subject) rowErrors.push("subject is required");
      else if (!isValidSubject(subject))
        rowErrors.push(
          `subject must be one of: ${SUPPORTED_SUBJECTS.join(", ")}`,
        );
      if (!SUPPORTED_DIFFICULTIES.includes(difficulty))
        rowErrors.push("difficulty must be Easy, Medium, or Hard");

      if (rowErrors.length) {
        errors.push({ index: idx, errors: rowErrors, row });
      } else {
        toInsert.push({
          exam: resolvedExamId || undefined,
          examName: examName || undefined,
          text,
          options,
          correctOptionIndex,
          subject,
          difficulty,
          type,
          isActive: true,
        });
      }
    });

    if (!toInsert.length) {
      return res.status(400).json({
        success: false,
        message: "No valid questions to upload",
        errors,
      });
    }

    // Duplicate detection: text + subject + examName
    const duplicateQueries = toInsert.map((q) => ({
      text: q.text,
      subject: q.subject,
      examName: q.examName || examName || null,
    }));

    const existingDocs = await Question.find({
      $or: duplicateQueries.map((q) => ({
        text: q.text,
        subject: q.subject,
        ...(q.examName ? { examName: q.examName } : {}),
      })),
    }).select("text subject examName");

    const existingKeys = new Set(
      existingDocs.map(
        (d) => `${d.text}|||${d.subject}|||${d.examName || ""}`,
      ),
    );

    const uniqueToInsert = [];
    const duplicates = [];

    toInsert.forEach((q, idx) => {
      const key = `${q.text}|||${q.subject}|||${q.examName || examName || ""}`;
      if (existingKeys.has(key)) {
        duplicates.push({ index: idx, text: q.text, subject: q.subject });
      } else {
        existingKeys.add(key);
        uniqueToInsert.push(q);
      }
    });

    if (!uniqueToInsert.length) {
      return res.status(400).json({
        success: false,
        message: "All questions are duplicates",
        duplicates,
        errors,
      });
    }

    const inserted = await Question.insertMany(uniqueToInsert, {
      ordered: false,
    });

    if (resolvedExamId) {
      await Exam.findByIdAndUpdate(resolvedExamId, {
        $addToSet: { questions: { $each: inserted.map((d) => d._id) } },
      });
    }

    res.status(201).json({
      success: true,
      totalUploaded: inserted.length,
      skippedDuplicates: duplicates.length,
      duplicates,
      errors,
    });
  } catch (err) {
    console.error("Bulk upload error:", err);
    res.status(500).json({ message: "Server error during bulk upload" });
  }
};

// Preview / validate without saving
exports.previewBulk = async (req, res) => {
  try {
    const questions = normalizeQuestionsInput(req.body);
    const examFields = extractExamFields(req.body);
    const examName = (
      examFields.exam ||
      examFields.examName ||
      ""
    )
      .toString()
      .trim();

    if (!questions) {
      return res.status(400).json({ message: INVALID_QUESTIONS_MESSAGE });
    }

    const errors = [];
    const subjectCount = {};
    const difficultyCount = { easy: 0, medium: 0, hard: 0 };

    questions.forEach((q, idx) => {
      const row = q || {};
      const text = (row.text || "").toString().trim();
      const options = Array.isArray(row.options) ? row.options : [];
      const correctOptionIndex = Number(row.correctOptionIndex);
      const subject = normalizeSubject(row.subject);
      const difficulty = normalizeDifficulty(row.difficulty);

      const rowErrors = [];
      if (!text) rowErrors.push("text is required");
      if (options.length !== 4)
        rowErrors.push("options must contain exactly 4 items");
      if (
        !(
          Number.isInteger(correctOptionIndex) &&
          correctOptionIndex >= 0 &&
          correctOptionIndex <= 3
        )
      )
        rowErrors.push("correctOptionIndex must be between 0 and 3");
      if (!subject) rowErrors.push("subject is required");
      else if (!isValidSubject(subject))
        rowErrors.push(`invalid subject: ${row.subject}`);
      if (!SUPPORTED_DIFFICULTIES.includes(difficulty))
        rowErrors.push("invalid difficulty");

      if (rowErrors.length) {
        errors.push({ index: idx, errors: rowErrors });
      } else {
        subjectCount[subject] = (subjectCount[subject] || 0) + 1;
        difficultyCount[difficulty] = (difficultyCount[difficulty] || 0) + 1;
      }
    });

    // Check duplicates against DB
    const validTexts = questions
      .map((q, idx) => ({ text: (q.text || "").trim(), subject: normalizeSubject(q.subject), idx }))
      .filter((q) => q.text);

    let duplicates = [];
    if (validTexts.length) {
      const existing = await Question.find({
        $or: validTexts.map((q) => ({
          text: q.text,
          subject: q.subject,
          ...(examName ? { examName } : {}),
        })),
      }).select("text subject");
      const existingSet = new Set(existing.map((e) => `${e.text}|||${e.subject}`));
      duplicates = validTexts
        .filter((q) => existingSet.has(`${q.text}|||${q.subject}`))
        .map((q) => ({ index: q.idx, text: q.text, subject: q.subject }));
    }

    res.json({
      totalQuestions: questions.length,
      validQuestions: questions.length - errors.length,
      subjectCount,
      difficultyCount,
      errors,
      duplicates,
      exam: examName,
    });
  } catch (err) {
    console.error("Preview bulk error:", err);
    res.status(500).json({ message: "Failed to preview questions" });
  }
};

// Check duplicates by text + subject + exam
exports.checkDuplicates = async (req, res) => {
  try {
    const questions = normalizeQuestionsInput(req.body);
    const examFields = extractExamFields(req.body);
    const resolvedExam = (
      examFields.exam ||
      examFields.examName ||
      ""
    )
      .toString()
      .trim();

    if (!questions) {
      return res.json({ duplicates: [], existing: [] });
    }

    const queries = questions
      .map((q, idx) => ({
        text: (q.text || q).toString().trim(),
        subject: normalizeSubject(q.subject || ""),
        idx,
      }))
      .filter((q) => q.text);

    const existing = await Question.find({
      $or: queries.map((q) => ({
        text: q.text,
        subject: q.subject,
        ...(resolvedExam ? { examName: resolvedExam } : {}),
      })),
    }).select("text subject examName");

    const existingSet = new Set(
      existing.map((e) => `${e.text}|||${e.subject}|||${e.examName || ""}`),
    );

    const duplicates = queries.filter((q) =>
      existingSet.has(`${q.text}|||${q.subject}|||${resolvedExam}`),
    );

    res.json({
      duplicates,
      existing: existing.map((e) => ({
        text: e.text,
        subject: e.subject,
        examName: e.examName,
      })),
    });
  } catch (err) {
    console.error("Duplicate check error:", err);
    res.status(500).json({ message: "Failed to check duplicates" });
  }
};

exports.getSupportedSubjects = (_req, res) => {
  res.json({ subjects: SUPPORTED_SUBJECTS, difficulties: SUPPORTED_DIFFICULTIES });
};
