// backend/src/routes/upload.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const pdfParse = require('pdf-parse');
const cloudinary = require('../config/cloudinary');
const verifyToken = require('../middleware/auth');
const Question = require('../models/Question');
const Exam = require('../models/Exam');

const upload = multer({ storage: multer.memoryStorage() });

// Promise wrapper for Cloudinary stream upload
const uploadStream = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'smartprep_profiles' },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    stream.write(fileBuffer);
    stream.end();
  });
};

// @desc   Upload profile image to Cloudinary
// @route  POST /api/upload/profile
// @access Private
router.post('/profile', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const uploadResult = await uploadStream(req.file.buffer);
    res.json({ imageUrl: uploadResult.secure_url });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ message: 'Failed to upload image to Cloudinary' });
  }
});

// @desc   Import questions from Excel or PDF
// @route  POST /api/upload/questions/:examId
// @access Private (Admin only)
router.post('/questions/:examId', verifyToken, upload.single('file'), async (req, res) => {
  const { examId } = req.params;
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: Admin only' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    let questionsData = [];

    // Check file extension
    const extension = req.file.originalname.split('.').pop().toLowerCase();

    if (extension === 'xlsx' || extension === 'xls' || extension === 'csv') {
      // Parse Excel spreadsheet
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet);

      // Map rows to questions
      rows.forEach((row) => {
        const text = row.Question || row.question || row.Text || row.text;
        const options = [
          row.OptionA || row.optionA || row.option1 || row.A || row.a,
          row.OptionB || row.optionB || row.option2 || row.B || row.b,
          row.OptionC || row.optionC || row.option3 || row.C || row.c,
          row.OptionD || row.optionD || row.option4 || row.D || row.d
        ].filter(Boolean);

        const correctAns = String(row.CorrectIndex || row.correctIndex || row.CorrectOption || row.CorrectAnswer || row.correct || 0).trim();
        let correctIndex = 0;
        if (correctAns.toLowerCase() === 'b' || correctAns === '1') correctIndex = 1;
        else if (correctAns.toLowerCase() === 'c' || correctAns === '2') correctIndex = 2;
        else if (correctAns.toLowerCase() === 'd' || correctAns === '3') correctIndex = 3;

        if (text && options.length >= 2) {
          questionsData.push({ text, options, correctOptionIndex: correctIndex });
        }
      });

    } else if (extension === 'pdf') {
      // Parse PDF document
      const data = await pdfParse(req.file.buffer);
      const text = data.text;
      
      // Simple parser: split by question patterns like "Q1.", "Q2.", or newlines
      // Looking for lines ending with "?" and option lists starting with A), B), C), D)
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      let currentQ = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/^(Q\d+|Question\s*\d+|\d+)\.?\s+/i) || line.endsWith('?')) {
          if (currentQ && currentQ.options.length >= 2) {
            questionsData.push(currentQ);
          }
          currentQ = {
            text: line.replace(/^(Q\d+|Question\s*\d+|\d+)\.?\s+/i, ''),
            options: [],
            correctOptionIndex: 0
          };
        } else if (currentQ && (line.startsWith('A)') || line.startsWith('B)') || line.startsWith('C)') || line.startsWith('D)') ||
                               line.startsWith('a)') || line.startsWith('b)') || line.startsWith('c)') || line.startsWith('d)') ||
                               line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.') || line.startsWith('4.'))) {
          currentQ.options.push(line.substring(2).trim());
        } else if (currentQ && line.toLowerCase().includes('correct:')) {
          const ans = line.split(':').pop().trim().toUpperCase();
          if (ans === 'B' || ans === '2') currentQ.correctOptionIndex = 1;
          else if (ans === 'C' || ans === '3') currentQ.correctOptionIndex = 2;
          else if (ans === 'D' || ans === '4') currentQ.correctOptionIndex = 3;
        }
      }
      if (currentQ && currentQ.options.length >= 2) {
        questionsData.push(currentQ);
      }
    } else {
      return res.status(400).json({ message: 'Unsupported file type. Please upload Excel (xlsx/xls), CSV or PDF.' });
    }

    if (questionsData.length === 0) {
      return res.status(400).json({ message: 'No questions could be parsed from the file.' });
    }

    // Save parsed questions in database
    const questions = await Promise.all(
      questionsData.map(async (q) => {
        const doc = await Question.create({
          exam: examId,
          text: q.text,
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
        });
        exam.questions.push(doc._id);
        return doc;
      })
    );
    await exam.save();

    res.status(201).json({
      message: `Successfully imported ${questions.length} questions into "${exam.title}"!`,
      questionsCount: questions.length,
    });

  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ message: 'Error processing bulk file upload' });
  }
});

module.exports = router;
