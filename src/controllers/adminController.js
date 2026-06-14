// backend/src/controllers/adminController.js
const AdminSettings = require('../models/AdminSettings');
const User = require('../models/User');
const Result = require('../models/Result');
const Exam = require('../models/Exam');

// Get active AI settings (obfuscated keys)
exports.getSettings = async (req, res) => {
  try {
    let settings = await AdminSettings.findOne();
    if (!settings) {
      settings = await AdminSettings.create({
        aiProvider: 'openrouter',
        geminiKey: '',
        openaiKey: '',
        openrouterKey: '',
        defaultModel: 'mistralai/mistral-7b-instruct:free',
      });
    }

    const obfuscate = (key) => {
      if (!key) return '';
      if (key.length <= 8) return '****';
      return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
    };

    res.json({
      aiProvider: settings.aiProvider || 'openrouter',
      geminiKey: obfuscate(settings.geminiKey),
      openaiKey: obfuscate(settings.openaiKey),
      openrouterKey: obfuscate(settings.openrouterKey || settings.openaiKey),
      defaultModel: settings.defaultModel,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error retrieving admin configurations' });
  }
};

// Update settings
exports.updateSettings = async (req, res) => {
  const { aiProvider, geminiKey, openaiKey, openrouterKey, defaultModel } = req.body;
  try {
    let settings = await AdminSettings.findOne();
    if (!settings) {
      settings = new AdminSettings();
    }

    if (aiProvider) settings.aiProvider = aiProvider;
    if (defaultModel) settings.defaultModel = defaultModel;
    
    // Only update key if user typed a new one (not obfuscated placeholder)
    if (geminiKey && !geminiKey.includes('...')) {
      settings.geminiKey = geminiKey;
    }
    if (openrouterKey && !openrouterKey.includes('...')) {
      settings.openrouterKey = openrouterKey;
      settings.openaiKey = openrouterKey;
      settings.aiProvider = 'openrouter';
    } else if (openaiKey && !openaiKey.includes('...')) {
      settings.openaiKey = openaiKey;
      settings.openrouterKey = openaiKey;
      settings.aiProvider = 'openrouter';
    }

    settings.updatedAt = Date.now();
    await settings.save();

    res.json({ message: 'AI configuration updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating configs' });
  }
};

// Get high-level analytical stats
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTests = await Result.countDocuments();
    const totalExams = await Exam.countDocuments();

    const Question = require('../models/Question');
    const totalQuestions = await Question.countDocuments();

    // Grouping questions by subject
    const questionsBySubject = await Question.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Grouping tests by exam
    const testRuns = await Result.aggregate([
      { $group: { _id: '$exam', count: { $sum: 1 } } }
    ]);

    res.json({
      totalUsers,
      totalTests,
      totalExams,
      totalQuestions,
      questionsBySubject,
      testRuns,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching statistics' });
  }
};

// List users for management
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error listing accounts' });
  }
};

// Toggle user role or status
exports.updateUserRole = async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User account not found' });
    user.role = role;
    await user.save();
    res.json({ message: `Role updated to ${role} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating user role' });
  }
};

// Delete user account
exports.deleteUser = async (req, res) => {
  const { userId } = req.params;
  try {
    await User.findByIdAndDelete(userId);
    res.json({ message: 'User account deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting account' });
  }
};

// Toggle user block status (Admin only)
exports.updateUserStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body; // status is 'active' or 'blocked'
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User account not found' });
    
    if (status) {
      user.status = status;
      await user.save();
    }
    
    res.json({ message: `User status updated to ${user.status} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating status' });
  }
};

// --- ADVANCED MCQ IMPORTER SYSTEM (Step 1 to 13) ---

const { pdfParse } = require('../utils/pdfParseWrapper');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const Question = require('../models/Question');
const ClassificationCache = require('../models/ClassificationCache');
const aiService = require('../services/ai.service');
const mcqParser = require('../utils/mcqParser');

// Allowed subjects mapping (exact syllabus keys)
const SUBJECTS_KEYS = [
  "English",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer",
  "Pakistan Studies",
  "Islamic Studies",
  "Current Affairs",
  "General Knowledge"
];

// Subject Keyword Dictionaries (Step 7)
// NOTE: More keywords = better rule-based detection without needing AI.
const SUBJECT_KEYWORDS = {
  English: [
    "synonym", "antonym", "grammar", "preposition", "article", "tense",
    "active voice", "passive voice", "idiom", "phrase", "sentence", "vocabulary",
    "adjective", "adverb", "noun", "verb", "pronoun", "conjunction", "punctuation",
    "spelling", "comprehension", "paragraph", "essay", "letter writing"
  ],
  Mathematics: [
    "percentage", "ratio", "average", "profit", "loss", "equation", "algebra",
    "geometry", "trigonometry", "fraction", "decimal", "square root", "cube",
    "lcm", "hcf", "integer", "prime number", "arithmetic", "calculus", "matrix"
  ],
  Physics: [
    "newton", "force", "velocity", "current", "voltage", "wave", "electromagnetic",
    "motion", "acceleration", "momentum", "energy", "power", "friction", "gravity",
    "pressure", "density", "temperature", "thermodynamics", "optics", "refraction"
  ],
  Chemistry: [
    "atom", "molecule", "compound", "acid", "base", "reaction", "element",
    "periodic table", "valency", "oxidation", "reduction", "electrolysis",
    "polymer", "organic", "inorganic", "solution", "concentration", "catalyst"
  ],
  Biology: [
    "cell", "dna", "enzyme", "genetics", "photosynthesis", "respiration",
    "mitosis", "meiosis", "chromosome", "nucleus", "tissue", "organ", "blood",
    "heart", "lung", "kidney", "digestive", "nervous system", "ecosystem"
  ],
  Computer: [
    "html", "css", "javascript", "cpu", "ram", "operating system", "database",
    "network", "software", "hardware", "algorithm", "programming", "internet",
    "binary", "byte", "router", "ip address", "cybersecurity", "encryption"
  ],
  "Pakistan Studies": [
    "quaid e azam", "allama iqbal", "constitution", "pakistan movement", "1947",
    "independence", "lahore resolution", "two nation theory", "partition",
    "liaquat ali khan", "ayub khan", "bhutto", "nawaz", "imran", "karachi",
    "lahore", "islamabad", "sindh", "punjab", "balochistan", "khyber",
    "indus", "raavi", "chenab", "jhelum", "attock", "tarbela", "mangla"
  ],

  // ── ISLAMIC STUDIES – comprehensive keyword list ──
  // Covers: Quran, Hadith, Pillars, Caliphs, Companions, Battles,
  //         Prophets, Islamic law, Mosques, Months, and key terms
  "Islamic Studies": [
    // Quran & revelation
    "quran", "surah", "surat", "ayah", "ayat", "verse", "revelation", "wahi",
    "juz", "para", "makki", "madani", "recitation", "tilawat", "qirat",
    // Hadith & Sunnah
    "hadith", "sunnah", "bukhari", "muslim", "tirmidhi", "narrator", "sahih",
    "daif", "hasan", "isnad", "sanad", "rawi",
    // Five Pillars
    "namaz", "salah", "prayer", "zakat", "sawm", "fasting", "ramadan",
    "ramzan", "hajj", "umrah", "kalima", "shahada", "tawhid",
    // Caliphs / Khulafa
    "caliph", "khalifa", "khilafat", "caliphate",
    "abu bakr", "umar", "uthman", "ali ibn", "khulafa rashideen",
    // Companions / Sahaba
    "sahabi", "sahaba", "companion", "ansar", "muhajir", "muhajireen",
    "bilal", "usamah", "khalid bin", "ammar", "zaid", "muaz",
    // Wives / Family of Prophet
    "ayesha", "khadija", "fatima", "hafsa", "umm", "ahl al bayt",
    // Battles / Ghazwat
    "ghazwa", "battle", "badr", "uhud", "khandaq", "tabuk", "muta",
    "khaybar", "hunayn", "conquest",
    // Prophets
    "prophet", "nabi", "rasul", "ibrahim", "musa", "isa", "yusuf",
    "dawood", "sulaiman", "adam", "nooh", "idrees", "ayyub",
    // Places
    "mecca", "makkah", "medina", "madinah", "masjid", "mosque",
    "kaaba", "kaba", "zamzam", "safa", "marwa", "arafat",
    // Islamic law & concepts
    "fiqh", "sharia", "fatwa", "halal", "haram", "makruh", "wajib",
    "sunnah", "bidah", "iman", "taqwa", "jihad", "ummah", "imam",
    "shirk", "kufr", "tafseer", "tafsir",
    // Islamic months & events
    "muharram", "safar", "rajab", "shaban", "ramadan", "shawwal",
    "dhul hijja", "eid", "lailat ul qadr", "isra", "miraj", "hijra",
    "hijrah",
    // Angels & afterlife
    "angel", "jibril", "jibreel", "mikail", "israfil", "izreel",
    "jannah", "jahannam", "akhirat", "qayamat", "sirat",
    // Key Islamic texts / scholars
    "ibn khaldun", "ghazali", "ibn rushd", "rumi", "iqbal"
  ],

  // ── GENERAL KNOWLEDGE – world knowledge, NOT Pakistan/Islamic ──
  "General Knowledge": [
    // World geography
    "continent", "ocean", "amazon", "nile", "everest", "sahara", "arctic",
    "antarctica", "atlantic", "pacific", "mediterranean", "danube",
    // World history (non-Islamic)
    "world war", "roman empire", "napoleon", "french revolution",
    "renaissance", "industrial revolution", "cold war", "united nations",
    "columbus", "einstein", "newton", "shakespeare",
    // International organizations
    "nato", "who", "imf", "world bank", "olympics", "nobel prize",
    "unicef", "unesco",
    // Science general
    "solar system", "planet", "galaxy", "universe", "gravity", "atmosphere",
    "oxygen", "carbon dioxide", "periodic"
  ],

  "Current Affairs": [
    "recent", "current government", "latest summit", "international organization",
    "election", "prime minister", "president", "budget", "treaty", "agreement",
    "crisis", "conflict", "ceasefire", "sanction"
  ]
};

// Minimum keyword hits required before a subject is considered detected
// (prevents classifying on a single lucky word match)
const SUBJECT_MIN_HITS = {
  "Islamic Studies": 1,  // even 1 specific Islamic term is strong signal
  "Pakistan Studies": 1,
  "Mathematics": 1,
  "Physics": 1,
  "Chemistry": 1,
  "Biology": 1,
  "Computer": 1,
  "English": 2,
  "General Knowledge": 2,
  "Current Affairs": 1,
};

// ── Stop-words: generic English + Islamic domain words that appear in almost
//    every question of that subject and would artificially inflate Jaccard scores
const STOP_WORDS = new Set([
  // generic English
  "the","and","that","this","with","for","are","was","were","has","have",
  "had","not","but","from","they","which","what","who","how","when","where",
  "its","his","her","our","their","one","two","three","also","been","into",
  "than","then","more","some","any","all","can","will","did","does","about",
  // Islamic domain – appear in nearly every Islamic Studies MCQ
  "quran","allah","prophet","islamic","islam","muslim","muslims","surah",
  "surat","hazrat","muhammad","pbuh","holy","verse","ayat","ayah","named",
  "called","known","refers","following","correct","according",
  // Pakistan Studies domain
  "pakistan","government","constitution","national","country","province",
  // General / exam language
  "identify","select","choose","option","answer","question","statement"
]);

// Tokenizer – removes punctuation, splits on whitespace,
// drops stop-words and very short tokens (≤2 chars)
const getWordTokens = (str) => {
  if (!str) return new Set();
  return new Set(
    str.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
};

const calculateSimilarity = (str1, str2) => {
  const set1 = getWordTokens(str1);
  const set2 = getWordTokens(str2);
  // If either question has fewer than 4 meaningful tokens after stop-word
  // removal, skip fuzzy check (too ambiguous – rely on exact match only)
  if (set1.size < 4 || set2.size < 4) return 0;
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
};

// SIMILARITY THRESHOLD – raised from 0.65 → 0.88
// At 0.88 only near-identical questions (e.g. same question with one word
// changed) are flagged. Different questions about the same topic are NOT flagged.
const DUPLICATE_SIMILARITY_THRESHOLD = 0.88;

const isDuplicateInDB = async (text, subject, skipSimilarity = false) => {
  if (!text) return false;
  const normalizedText = text.trim();

  // 1. Exact match check (always run)
  const exactCount = await Question.countDocuments({
    text: { $regex: new RegExp("^" + escapeRegExp(normalizedText) + "$", "i") },
    subject,
  });
  if (exactCount > 0) return true;

  // 2. Fuzzy / Jaccard similarity check
  //    Skip when subject is uncertain (would compare against wrong pool)
  if (skipSimilarity) return false;

  const candidates = await Question.find({ subject }).select("text").lean();
  for (const cand of candidates) {
    if (cand.text) {
      const similarity = calculateSimilarity(normalizedText, cand.text);
      if (similarity >= DUPLICATE_SIMILARITY_THRESHOLD) {
        return true;
      }
    }
  }
  return false;
};

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractJpegsFromPdf(buffer) {
  const jpegs = [];
  let pos = 0;
  while (true) {
    const subtypeIdx = buffer.indexOf("/Subtype", pos);
    if (subtypeIdx === -1) break;
    pos = subtypeIdx + 8;
    const nextSlice = buffer.slice(subtypeIdx, subtypeIdx + 50).toString("ascii");
    if (!nextSlice.match(/\/Subtype\s*\/Image/)) continue;
    const streamIdx = buffer.indexOf("stream", subtypeIdx);
    if (streamIdx === -1) continue;
    const endstreamIdx = buffer.indexOf("endstream", streamIdx);
    if (endstreamIdx === -1) continue;
    let streamStart = streamIdx + 6;
    if (buffer[streamStart] === 13 && buffer[streamStart + 1] === 10) streamStart += 2;
    else if (buffer[streamStart] === 10) streamStart += 1;
    const dictStart = buffer.lastIndexOf("<<", subtypeIdx);
    const dictEnd = buffer.indexOf(">>", subtypeIdx);
    if (dictStart !== -1 && dictEnd !== -1 && dictStart < streamIdx) {
      const dictText = buffer.slice(dictStart, dictEnd).toString("ascii");
      if (dictText.includes("/DCTDecode") || dictText.includes("/DCT")) {
        jpegs.push(buffer.slice(streamStart, endstreamIdx));
      }
    }
    pos = endstreamIdx + 9;
  }
  return jpegs;
}

// Subject detection and confidence score calculation (Step 8)
function detectSubjectRuleBased(text) {
  const lowercaseText = text.toLowerCase();
  const counts = {};
  let totalMatches = 0;

  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    counts[subject] = 0;
    for (const kw of keywords) {
      const regex = new RegExp("\\b" + escapeRegExp(kw) + "\\b", "gi");
      const matches = lowercaseText.match(regex);
      if (matches) {
        counts[subject] += matches.length;
        totalMatches += matches.length;
      }
    }
  }

  if (totalMatches === 0) {
    return { subject: null, confidence: 0 };
  }

  // Find the subject with the highest keyword hit count
  let bestSubject = null;
  let maxCount = 0;
  for (const [subj, count] of Object.entries(counts)) {
    const minHits = SUBJECT_MIN_HITS[subj] || 1;
    if (count >= minHits && count > maxCount) {
      maxCount = count;
      bestSubject = subj;
    }
  }

  if (!bestSubject) return { subject: null, confidence: 0 };

  // Per-subject confidence thresholds:
  // Islamic Studies & Pakistan Studies need lower global share because their
  // keywords are very specific and rarely appear in other subjects' questions.
  const confidence = maxCount / totalMatches;
  const subjectConfidenceThreshold = {
    "Islamic Studies":   0.30,  // 1 Islamic keyword in a question = very strong signal
    "Pakistan Studies":  0.30,
    "Mathematics":       0.50,
    "Physics":           0.50,
    "Chemistry":         0.50,
    "Biology":           0.50,
    "Computer":          0.50,
    "English":           0.60,
    "General Knowledge": 0.60,
    "Current Affairs":   0.40,
  };
  const threshold = subjectConfidenceThreshold[bestSubject] ?? 0.50;

  return { subject: bestSubject, confidence, threshold };
}

// Exam combination mapping (Step 10)
function detectExamRuleBased(subjects) {
  const set = new Set(subjects.map(s => s.toLowerCase()));

  // Biology + Chemistry + Physics => MDCAT
  if (set.has("biology") && set.has("chemistry") && set.has("physics")) {
    return "MDCAT";
  }
  // Physics + Mathematics => ECAT
  if (set.has("physics") && set.has("mathematics")) {
    return "ECAT";
  }
  // English + General Knowledge + Pakistan Studies + Islamic Studies + Intelligence => PMA
  if (
    set.has("english") &&
    set.has("general knowledge") &&
    set.has("pakistan studies") &&
    set.has("islamic studies")
  ) {
    return "PMA";
  }
  // Computer + English => LDC
  if (set.has("computer") && set.has("english")) {
    return "LDC";
  }
  // English + Mathematics + General Knowledge + Intelligence => ASF
  if (
    set.has("english") &&
    set.has("mathematics") &&
    set.has("general knowledge")
  ) {
    return "ASF";
  }
  // Verbal Intelligence + Non-Verbal Intelligence => PMA / Navy / Air Force
  if (set.has("verbal intelligence") || set.has("non verbal intelligence") || set.has("intelligence")) {
    return "PMA";
  }
  // Individual fallbacks
  if (set.has("computer")) return "LDC";
  if (set.has("biology") || set.has("chemistry")) return "MDCAT";
  if (set.has("physics") || set.has("mathematics")) return "ECAT";

  return "General";
}

const getOrCreateExam = async (examTitle) => {
  const title = examTitle || "General";
  let exam = await Exam.findOne({ title: { $regex: new RegExp("^" + escapeRegExp(title) + "$", "i") } });
  if (!exam) {
    exam = await Exam.create({
      title: title,
      duration: 100,
      description: `Auto-generated exam category for ${title}`,
    });
  }
  return exam;
};

// Controller to handle file upload and parsing (Step 1 to 11)
exports.mcqImportUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    let extractedText = "";
    const filename = req.file.originalname;
    const extension = filename.split(".").pop().toLowerCase();
    const mimetype = req.file.mimetype;

    console.log(`📂 Processing MCQ import file: ${filename} (${mimetype})`);

    // Step 2: Extract text (NO AI)
    if (extension === "pdf" || mimetype === "application/pdf") {
      try {
        const parsed = await pdfParse(req.file.buffer);
        extractedText = parsed.text || "";
      } catch (err) {
        console.warn("pdf-parse failed, running OCR fallback:", err.message);
      }

      // OCR Fallback for scanned PDFs
      if (!extractedText || extractedText.trim().length < 100) {
        const jpegs = extractJpegsFromPdf(req.file.buffer);
        if (jpegs.length > 0) {
          let ocrText = "";
          const limit = 5;
          for (let i = 0; i < jpegs.length; i += limit) {
            const chunk = jpegs.slice(i, i + limit);
            const results = await Promise.all(
              chunk.map((imgBuffer) =>
                Tesseract.recognize(imgBuffer, "eng")
                  .then((res) => res.data.text)
                  .catch(() => "")
              )
            );
            ocrText += results.join("\n") + "\n";
          }
          extractedText = ocrText;
        }
      }
    } else if (
      extension === "docx" ||
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const parsed = await mammoth.extractRawText({ buffer: req.file.buffer });
      extractedText = parsed.value;
    } else if (extension === "txt" || mimetype === "text/plain") {
      extractedText = req.file.buffer.toString("utf-8");
    } else {
      return res.status(400).json({
        message: "Unsupported file type. Please upload PDF, DOCX, or TXT.",
      });
    }

    if (!extractedText || !extractedText.trim()) {
      return res.status(400).json({ message: "Unable to extract text from the file." });
    }

    // Step 4: Cleaning Engine
    const cleanedText = mcqParser.cleanTextForParsing(extractedText);

    // Step 3: MCQ Parser (NO AI)
    const rawQuestions = mcqParser.parseMCQs(cleanedText);

    if (rawQuestions.length === 0) {
      return res.status(422).json({
        message: "No structured MCQs could be parsed from the file using standard patterns.",
      });
    }

    let totalFound = rawQuestions.length;
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;
    let aiClassifiedCount = 0;

    const processedQuestions = [];

    // Step 5 & 6: Quality Validation & Duplicate Detection
    for (let i = 0; i < rawQuestions.length; i++) {
      const q = rawQuestions[i];
      const text = q.text || "";
      const options = Array.isArray(q.options) ? q.options : [];
      const correctIndex = Number(q.correctOptionIndex);

      // Quality Validation (Step 5)
      const hasValidOptions = options.length === 4;
      const areOptionsUnique = hasValidOptions && new Set(options.map(o => o.trim().toLowerCase())).size === 4;
      const hasValidCorrectIndex = correctIndex >= 0 && correctIndex <= 3;
      const isTextNotEmpty = text.trim().length > 0;
      const isTextLongEnough = text.trim().length >= 15;

      const isValid = hasValidOptions && areOptionsUnique && hasValidCorrectIndex && isTextNotEmpty && isTextLongEnough;

      if (!isValid) {
        invalidCount++;
        processedQuestions.push({
          id: `admin-extracted-${i}-${Date.now()}`,
          text,
          options,
          correctOptionIndex: correctIndex,
          subject: "General Knowledge",
          exam: "General",
          type: "single",
          isDuplicate: false,
          isValid: false,
          validationErrors: {
            options: !hasValidOptions
              ? "Must contain exactly 4 options."
              : !areOptionsUnique
                ? "Options must all be unique."
                : null,
            correctIndex: !hasValidCorrectIndex ? "Correct index must be 0-3." : null,
            text: !isTextNotEmpty
              ? "Text cannot be empty."
              : !isTextLongEnough
                ? "Text must be at least 15 characters."
                : null,
          },
        });
        continue;
      }

      processedQuestions.push({
        id: `admin-extracted-${i}-${Date.now()}`,
        text,
        options,
        correctOptionIndex: correctIndex,
        subject: null,
        exam: "General",
        type: "single",
        isDuplicate: false,
        isValid: true,
        validationErrors: {},
      });
    }

    // Primary AI Classification (Step 7-9)
    const validQuestions = processedQuestions.filter(q => q.isValid);
    const batchSize = 40;

    const cachedRecords = await ClassificationCache.find({ text: { $in: validQuestions.map(q => q.text.trim()) } }).lean();
    const cacheMap = new Map(cachedRecords.map(rec => [rec.text.trim().toLowerCase(), rec.subject]));

    for (let i = 0; i < validQuestions.length; i += batchSize) {
      const batch = validQuestions.slice(i, i + batchSize);

      const toClassify = [];
      batch.forEach(q => {
        const cached = cacheMap.get(q.text.trim().toLowerCase());
        if (cached) {
          q.subject = cached;
          aiClassifiedCount++;
        } else {
          toClassify.push(q);
        }
      });

      if (toClassify.length > 0) {
        console.log(`🤖 AI classifying batch of ${toClassify.length} questions...`);
        try {
          // classifySubjectsBatch uses numeric index (0,1,2...) as id in its results
          const aiResults = await aiService.classifySubjectsBatch(toClassify);
          const cacheInserts = [];

          toClassify.forEach((q, idx) => {
            // Match by numeric index (how the AI service numbers items)
            const res = aiResults.find(r => r.id === idx);
            if (res && res.subject) {
              q.subject = res.subject;
              aiClassifiedCount++;
              cacheInserts.push({ text: q.text, subject: res.subject, exam: "General" });
            } else {
              // AI skipped this question – use rule-based fallback
              const { subject: ruleSubject } = detectSubjectRuleBased(q.text);
              q.subject = ruleSubject || "General Knowledge";
              console.warn(`⚠️ AI skipped question [${idx}], rule-based fallback: "${q.subject}"`);
            }
          });

          if (cacheInserts.length > 0) {
            await ClassificationCache.insertMany(cacheInserts, { ordered: false }).catch(e => {
              if (e.code !== 11000) console.error("Cache insert error:", e.message);
            });
          }
        } catch (aiErr) {
          // Whole batch failed – apply rule-based fallback to all questions in batch
          console.warn(`⚠️ AI batch failed (${aiErr.message}). Using rule-based fallback for ${toClassify.length} questions.`);
          toClassify.forEach(q => {
            const { subject: ruleSubject } = detectSubjectRuleBased(q.text);
            q.subject = ruleSubject || "General Knowledge";
          });
        }
      }
    }

    // Finalize Subjects & Duplicates
    for (const q of validQuestions) {
      const isDuplicate = await isDuplicateInDB(q.text, q.subject || "General Knowledge", false);
      if (isDuplicate) {
        q.isDuplicate = true;
        duplicateCount++;
      } else {
        validCount++;
      }
    }

    // Step 10: Exam Detection
    const detectedSubjects = validQuestions.filter(q => q.isValid && !q.isDuplicate).map(q => q.subject);
    const suggestedExam = detectExamRuleBased(detectedSubjects);
    validQuestions.forEach(q => {
      if (q.isValid) q.exam = suggestedExam;
    });

    // Sort to keep original order
    processedQuestions.sort((a, b) => a.id.localeCompare(b.id));

    // Distribution Stats (Step 11)
    const subjectDistribution = {};
    const examDistribution = {};

    processedQuestions.forEach(q => {
      if (q.isValid) {
        subjectDistribution[q.subject] = (subjectDistribution[q.subject] || 0) + 1;
        examDistribution[q.exam] = (examDistribution[q.exam] || 0) + 1;
      }
    });

    const stats = {
      totalFound,
      valid: validCount,
      invalid: invalidCount,
      duplicates: duplicateCount,
      aiClassified: aiClassifiedCount,
      subjectDistribution,
      examDistribution,
    };

    res.json({
      message: "MCQ upload and parsing complete",
      stats,
      questions: processedQuestions,
    });
  } catch (err) {
    console.error("MCQ Import Upload Error:", err);
    res.status(500).json({ message: err.message || "Failed to process MCQ file." });
  }
};

// Final Save Route (Step 12 & 13)
exports.mcqImportSave = async (req, res) => {
  try {
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "No questions to save." });
    }

    // Filter valid & non-duplicate questions
    const toInsert = questions.filter(q => q.isValid && !q.isDuplicate);

    if (toInsert.length === 0) {
      return res.status(200).json({
        message: "No new questions to save.",
        totalSaved: 0,
      });
    }

    // Resolve or create exams in bulk
    const uniqueExamNames = [...new Set(toInsert.map(q => q.exam || "General"))];
    const examMap = {};
    for (const name of uniqueExamNames) {
      const examDoc = await getOrCreateExam(name);
      examMap[name] = examDoc._id;
    }

    // Prepare Question documents
    const docsToInsert = toInsert.map(q => ({
      exam: examMap[q.exam || "General"],
      examName: q.exam || "General",
      subject: q.subject || "General Knowledge",
      difficulty: q.difficulty || "medium",
      tags: Array.isArray(q.tags) ? q.tags : ["imported"],
      text: q.text,
      options: q.options.map(String),
      correctOptionIndex: Number(q.correctOptionIndex),
      type: "single",
      isActive: true,
    }));

    // Step 12: bulk insertion
    const insertedDocs = await Question.insertMany(docsToInsert);

    // Group inserted questions by Exam ID to perform updates in bulk
    const examUpdates = {};
    insertedDocs.forEach(doc => {
      if (doc.exam) {
        const examIdStr = doc.exam.toString();
        if (!examUpdates[examIdStr]) {
          examUpdates[examIdStr] = [];
        }
        examUpdates[examIdStr].push(doc._id);
      }
    });

    // Bulk update Exam models
    for (const [examId, questionIds] of Object.entries(examUpdates)) {
      await Exam.findByIdAndUpdate(examId, {
        $addToSet: { questions: { $each: questionIds } }
      });
    }

    res.status(201).json({
      message: `Successfully saved ${insertedDocs.length} questions.`,
      totalSaved: insertedDocs.length,
    });
  } catch (err) {
    console.error("MCQ Import Save Error:", err);
    res.status(500).json({ message: err.message || "Failed to save questions." });
  }
};
