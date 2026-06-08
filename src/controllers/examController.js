// backend/src/controllers/examController.js
const Exam = require("../models/Exam");
const Question = require("../models/Question");

// Get all exams
exports.getExams = async (req, res) => {
  try {
    const exams = await Exam.find().populate("createdBy", "name");
    res.json(exams);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching exams" });
  }
};

// Get single exam with questions populated
exports.getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate("questions");
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }
    res.json(exam);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching exam" });
  }
};

// Create new exam (Admin only)
exports.createExam = async (req, res) => {
  const { title, description, duration, questionDistribution } = req.body;
  try {
    const exam = await Exam.create({
      title,
      description,
      duration,
      questionDistribution: Array.isArray(questionDistribution)
        ? questionDistribution
        : [],
      createdBy: req.user ? req.user.id : null,
    });
    res.status(201).json(exam);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error creating exam" });
  }
};

// Add question to exam (Admin only)
exports.addQuestion = async (req, res) => {
  const { examId } = req.params;
  const {
    text,
    options,
    correctOptionIndex,
    type,
    subject,
    difficulty,
    tags,
    explanation,
  } = req.body;
  try {
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const question = await Question.create({
      exam: examId,
      text,
      options,
      correctOptionIndex,
      type,
      subject: subject || exam.title || "General Knowledge",
      difficulty: difficulty || "medium",
      tags: Array.isArray(tags) ? tags : [],
      explanation: explanation || "",
    });

    exam.questions.push(question._id);
    await exam.save();

    res.status(201).json(question);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error adding question" });
  }
};

// Seed database with mock exams and questions
exports.seedExams = async (req, res) => {
  try {
    const existing = await Exam.countDocuments();
    if (existing > 0) {
      return res
        .status(400)
        .json({ message: "Database already has exams. Seeding skipped." });
    }

    // Exam 1
    const exam1 = await Exam.create({
      title: "PMA Long Course – Intelligence Mock Test",
      description:
        "Verbal and non-verbal intelligence test practice for Pakistan Army recruitment.",
      duration: 10,
    });
    const q1_1 = await Question.create({
      exam: exam1._id,
      subject: "Verbal Intelligence",
      difficulty: "medium",
      text: "What comes next in the series: 3, 6, 12, 24, ?",
      options: ["36", "48", "30", "40"],
      correctOptionIndex: 1,
      explanation: "The sequence doubles each time, so 24 * 2 = 48.",
    });
    const q1_2 = await Question.create({
      exam: exam1._id,
      subject: "Verbal Intelligence",
      difficulty: "easy",
      text: "Light is to Darkness as Knowledge is to:",
      options: ["Ignorance", "Book", "Intelligence", "School"],
      correctOptionIndex: 0,
      explanation: "Knowledge is opposite to ignorance.",
    });
    const q1_3 = await Question.create({
      exam: exam1._id,
      subject: "Verbal Intelligence",
      difficulty: "medium",
      text: "Which one is different from the rest?",
      options: ["Car", "Bicycle", "Truck", "Train"],
      correctOptionIndex: 1, // Bicycle has no engine
      explanation: "Bicycle is the only non-motorized option.",
    });
    const q1_4 = await Question.create({
      exam: exam1._id,
      subject: "Verbal Intelligence",
      difficulty: "easy",
      text: "If YESTERDAY was Monday, what day will be DAY AFTER TOMORROW?",
      options: ["Wednesday", "Thursday", "Friday", "Saturday"],
      correctOptionIndex: 1, // Today is Tuesday. Tomorrow is Wednesday. Day after is Thursday.
      explanation:
        "If yesterday is Monday then today is Tuesday, so the day after tomorrow is Thursday.",
    });
    exam1.questions.push(q1_1._id, q1_2._id, q1_3._id, q1_4._id);
    await exam1.save();

    // Exam 2
    const exam2 = await Exam.create({
      title: "MDCAT – Biology Foundation Mock Test",
      description:
        "High-yield Biology questions for medical entry test preparation.",
      duration: 15,
    });
    const q2_1 = await Question.create({
      exam: exam2._id,
      subject: "Biology",
      difficulty: "easy",
      text: "Which organelle is known as the powerhouse of the cell?",
      options: ["Ribosome", "Mitochondria", "Golgi Apparatus", "Lysosome"],
      correctOptionIndex: 1,
      explanation:
        "Mitochondria generate the cell’s energy supply in the form of ATP.",
    });
    const q2_2 = await Question.create({
      exam: exam2._id,
      subject: "Biology",
      difficulty: "medium",
      text: "The process of glycolysis occurs in which part of the cell?",
      options: ["Cytoplasm", "Mitochondrial matrix", "Cristae", "Chloroplast"],
      correctOptionIndex: 0,
      explanation:
        "Glycolysis takes place in the cytoplasm before pyruvate enters the mitochondrion.",
    });
    const q2_3 = await Question.create({
      exam: exam2._id,
      subject: "Biology",
      difficulty: "medium",
      text: "Which of the following is a double-membraned organelle?",
      options: ["Ribosome", "Lysosome", "Chloroplast", "Endoplasmic reticulum"],
      correctOptionIndex: 2,
      explanation: "Chloroplasts have both an inner and outer membrane.",
    });
    exam2.questions.push(q2_1._id, q2_2._id, q2_3._id);
    await exam2.save();

    // Exam 3
    const exam3 = await Exam.create({
      title: "FPSC – General Ability Mock Test",
      description: "Quantitative, logical reasoning, and basic math practice.",
      duration: 8,
    });
    const q3_1 = await Question.create({
      exam: exam3._id,
      subject: "Mathematics",
      difficulty: "easy",
      text: "Find the average of first five prime numbers.",
      options: ["5.6", "5.4", "5.0", "6.2"],
      correctOptionIndex: 0, // 2+3+5+7+11 = 28 / 5 = 5.6
      explanation: "The sum of the first five primes is 28 and 28/5 = 5.6.",
    });
    const q3_2 = await Question.create({
      exam: exam3._id,
      subject: "Mathematics",
      difficulty: "easy",
      text: "Solve: 20% of 150 is equal to?",
      options: ["20", "30", "40", "15"],
      correctOptionIndex: 1,
      explanation: "20% of 150 equals 0.2 × 150 = 30.",
    });
    exam3.questions.push(q3_1._id, q3_2._id);
    await exam3.save();

    res
      .status(201)
      .json({
        message:
          "Database seeded successfully with 3 exams and mock questions!",
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error seeding database" });
  }
};

// Update existing exam (Admin only)
exports.updateExam = async (req, res) => {
  const { title, description, duration, questionDistribution } = req.body;
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    if (title) exam.title = title;
    if (description !== undefined) exam.description = description;
    if (duration) exam.duration = duration;
    if (Array.isArray(questionDistribution)) {
      exam.questionDistribution = questionDistribution;
    }

    await exam.save();
    res.json({ message: "Exam updated successfully", exam });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error updating exam" });
  }
};

// Delete exam (Admin only)
exports.deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    // Also delete associated questions
    await Question.deleteMany({ exam: exam._id });
    await Exam.findByIdAndDelete(exam._id);

    res.json({
      message: "Exam and all associated questions deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error deleting exam" });
  }
};

// Update question (Admin only)
exports.updateQuestion = async (req, res) => {
  const { text, options, correctOptionIndex } = req.body;
  try {
    const question = await Question.findById(req.params.questionId);
    if (!question)
      return res.status(404).json({ message: "Question not found" });

    if (text) question.text = text;
    if (options) question.options = options;
    if (correctOptionIndex !== undefined)
      question.correctOptionIndex = Number(correctOptionIndex);

    await question.save();
    res.json({ message: "Question updated successfully", question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error updating question" });
  }
};

// Delete question (Admin only)
exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.questionId);
    if (!question)
      return res.status(404).json({ message: "Question not found" });

    // Remove reference from Exam
    await Exam.findByIdAndUpdate(question.exam, {
      $pull: { questions: question._id },
    });

    await Question.findByIdAndDelete(question._id);
    res.json({ message: "Question deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error deleting question" });
  }
};
