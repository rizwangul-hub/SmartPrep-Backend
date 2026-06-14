const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Mock ClassificationCache model to avoid DB dependency in this script
const ClassificationCache = {
  find: () => ({
    lean: () => Promise.resolve([])
  })
};

// Mock Question model
const Question = {
  find: () => ({
    select: () => ({
      lean: () => Promise.resolve([])
    })
  })
};

// Replace models in require cache or override before loading controller
require('./src/models/ClassificationCache');
require.cache[require.resolve('./src/models/ClassificationCache')].exports = ClassificationCache;

require('./src/models/Question');
require.cache[require.resolve('./src/models/Question')].exports = Question;

const aiUploadController = require('./src/controllers/aiUploadController');

const pdfPath = 'C:\\Users\\5500\\Downloads\\biology_500_mcqs_clean.pdf';
const buffer = fs.readFileSync(pdfPath);

const req = {
  file: {
    originalname: 'biology_500_mcqs_clean.pdf',
    mimetype: 'application/pdf',
    buffer: buffer
  }
};

const res = {
  status: function(code) {
    console.log('STATUS CODE:', code);
    return this;
  },
  json: function(data) {
    console.log('RESPONSE JSON DATA:');
    console.log('Stats:', data.stats);
    console.log('Number of questions:', data.questions ? data.questions.length : 0);
    if (data.questions && data.questions.length > 0) {
      console.log('First 5 questions:');
      data.questions.slice(0, 5).forEach((q, idx) => {
        console.log(`Q${idx+1}:`, JSON.stringify(q, null, 2));
      });
    }
  }
};

aiUploadController.extractQuestions(req, res)
  .catch(err => {
    console.error('Unhandled Controller Error:', err);
  });
