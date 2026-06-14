// backend/src/controllers/aiUploadController.js
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");
const Tesseract = require("tesseract.js");
const Question = require("../models/Question");
const Exam = require("../models/Exam");
const ClassificationCache = require("../models/ClassificationCache");
const aiService = require("../services/ai.service");
const mcqParser = require("../utils/mcqParser");

// Allowed subjects mapping (exact syllabus keys)
const SYLLABUS_SUBJECTS = [
  "English",
  "Urdu",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer",
  "General Knowledge",
  "Islamic Studies",
  "Pakistan Studies",
  "Current Affairs",
  "Intelligence",
  "Verbal Intelligence",
  "Non Verbal Intelligence",
];

// Allowed exam categories
const ALLOWED_EXAMS = [
  "ASF",
  "FIA",
  "ANF",
  "Police",
  "PMA",
  "Army",
  "Navy",
  "Air Force",
  "MDCAT",
  "ECAT",
  "LDC",
  "UDC",
];

// Subject Keyword Dictionaries for Rule-Based Classification (Step 7)
const SUBJECT_KEYWORDS = {
  English: [
    "synonym",
    "antonym",
    "grammar",
    "preposition",
    "article",
    "tense",
    "active voice",
    "passive voice",
    "idiom",
    "adjective",
    "adverb",
    "noun",
    "pronoun",
    "conjunction",
    "spelling",
    "vocab"
  ],
  Urdu: [
    "urdu",
    "ghazal",
    "shair",
    "nazm",
    "adab",
    "mushaira",
    "ghalib",
    "iqbal",
    "shairi",
    "lafz",
    "jumla",
    "huroof",
    "fail",
    "faal",
    "ism",
    "sift",
    "takhallus",
    "qawaid",
    "khulasa",
    "tashreeh"
  ],
  Mathematics: [
    "percentage",
    "ratio",
    "average",
    "profit",
    "loss",
    "equation",
    "algebra",
    "geometry",
    "trigonometry",
    "fraction",
    "matrix",
    "logarithm",
    "derivative",
    "integral",
    "probability",
    "arithmetic"
  ],
  Physics: [
    "newton",
    "force",
    "velocity",
    "current",
    "voltage",
    "wave",
    "electromagnetic",
    "motion",
    "momentum",
    "energy",
    "work",
    "acceleration",
    "gravity",
    "refraction",
    "thermodynamics",
    "quantum"
  ],
  Chemistry: [
    "atom",
    "molecule",
    "compound",
    "acid",
    "base",
    "reaction",
    "catalyst",
    "element",
    "periodic table",
    "covalent",
    "ionic",
    "organic",
    "inorganic",
    "oxidation",
    "reduction"
  ],
  Biology: [
    "cell",
    "dna",
    "rna",
    "enzyme",
    "genetics",
    "genetic",
    "photosynthesis",
    "respiration",
    "chromosome",
    "organelle",
    "organism",
    "living",
    "protein",
    "hormone",
    "blood",
    "mitosis",
    "meiosis",
    "ecosystem",
    "bacteria",
    "virus",
    "nucleus",
    "mitochondria",
    "ribosome",
    "membrane",
    "chloroplast",
    "chlorophyll",
    "pigment",
    "macromolecule",
    "carbohydrate",
    "lipid",
    "nucleic acid",
    "amino acid",
    "evolution",
    "natural selection",
    "adaptation",
    "species",
    "taxonomy",
    "kingdom",
    "phylum",
    "class",
    "order",
    "family",
    "genus",
    "tissue",
    "organ",
    "plant",
    "animal",
    "reproduction",
    "fertilization",
    "digestion",
    "absorption",
    "circulation",
    "excretion",
    "nervous system",
    "neuron",
    "endocrine",
    "immune",
    "antibody",
    "antigen",
    "vaccine",
    "mutation",
    "allele",
    "dominant",
    "recessive",
    "phenotype",
    "genotype",
    "osmosis",
    "diffusion",
    "transpiration",
    "stomata",
    "xylem",
    "phloem",
    "algae",
    "fungi",
    "parasite",
    "host",
    "habitat",
    "food chain",
    "food web",
    "biodiversity",
    "biome",
    "ecology",
    "zoology",
    "botany",
    "microbiology",
    "anatomy",
    "physiology",
    "biochemistry",
    "structural unit",
    "functional unit",
    "powerhouse"
  ],
  Computer: [
    "html",
    "css",
    "javascript",
    "cpu",
    "ram",
    "operating system",
    "database",
    "network",
    "software",
    "hardware",
    "programming",
    "internet",
    "protocol",
    "memory",
    "storage",
    "compiler"
  ],
  "General Knowledge": [
    "capital of",
    "currency of",
    "largest lake",
    "highest peak",
    "longest river",
    "world war",
    "nobel prize",
    "discovery of",
    "invented",
    "parliament",
    "headquarters",
    "deepest",
    "ocean",
    "continent",
    "famous for",
    "boundary line",
    "strait",
    "organization"
  ],
  "Islamic Studies": [
    "quran",
    "hadith",
    "zakat",
    "hajj",
    "namaz",
    "ghazwa",
    "prophet",
    "ramadan",
    "fasting",
    "caliph",
    "sunnah",
    "hijrah",
    "surah",
    "angels",
    "wudu",
    "islamic"
  ],
  "Pakistan Studies": [
    "quaid e azam",
    "allama iqbal",
    "constitution",
    "pakistan movement",
    "1947",
    "independence",
    "east pakistan",
    "resolution",
    "lahore resolution",
    "karakoram",
    "indus",
    "viceroy",
    "muslim league",
    "simla",
    "partition"
  ],
  "Current Affairs": [
    "recent",
    "current government",
    "latest summit",
    "international organization",
    "prime minister",
    "president of",
    "elected in",
    "host city",
    "current affairs",
    "foreign policy",
    "g20",
    "cop28",
    "bilateral"
  ],
  Intelligence: [
    "analogy",
    "coding decoding",
    "blood relation",
    "series",
    "odd one out",
    "direction sense",
    "pattern",
    "sequence",
    "logical reasoning"
  ],
  "Verbal Intelligence": [
    "analogy",
    "coding",
    "decoding",
    "blood relation",
    "alphabet series",
    "synonym analogy",
    "number series",
    "verbal series",
    "logical deduction",
    "word relation"
  ],
  "Non Verbal Intelligence": [
    "next figure",
    "pattern completion",
    "mirror image",
    "water image",
    "paper folding",
    "embedded figure",
    "matrix completion",
    "analogy figure",
    "rotation of shape",
    "non verbal"
  ]
};


// Helper to extract JPEG image streams directly from PDF buffer (Step 2 scanned PDF fallback)
function extractJpegsFromPdf(buffer) {
  const jpegs = [];
  let pos = 0;
  while (true) {
    const subtypeIdx = buffer.indexOf("/Subtype", pos);
    if (subtypeIdx === -1) break;
    pos = subtypeIdx + 8;

    const nextSlice = buffer.slice(subtypeIdx, subtypeIdx + 50).toString("ascii");
    if (!nextSlice.match(/\/Subtype\s*\/Image/)) {
      continue;
    }

    const streamIdx = buffer.indexOf("stream", subtypeIdx);
    if (streamIdx === -1) continue;

    const endstreamIdx = buffer.indexOf("endstream", streamIdx);
    if (endstreamIdx === -1) continue;

    let streamStart = streamIdx + 6;
    if (buffer[streamStart] === 13 && buffer[streamStart + 1] === 10) { // \r\n
      streamStart += 2;
    } else if (buffer[streamStart] === 10) { // \n
      streamStart += 1;
    }

    const dictStart = buffer.lastIndexOf("<<", subtypeIdx);
    const dictEnd = buffer.indexOf(">>", subtypeIdx);
    if (dictStart !== -1 && dictEnd !== -1 && dictStart < streamIdx) {
      const dictText = buffer.slice(dictStart, dictEnd).toString("ascii");
      if (dictText.includes("/DCTDecode") || dictText.includes("/DCT")) {
        const imgBuffer = buffer.slice(streamStart, endstreamIdx);
        jpegs.push(imgBuffer);
      }
    }
    pos = endstreamIdx + 9;
  }
  return jpegs;
}

// Rule-based subject detection (Step 8)
function detectSubjectRuleBased(text) {
  const lowercaseText = text.toLowerCase();
  const counts = {};
  let totalMatches = 0;

  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    counts[subject] = 0;
    for (const kw of keywords) {
      const escapedKw = escapeRegExp(kw);
      const regex = new RegExp(kw.includes(" ") ? escapedKw : "\\b" + escapedKw + "\\b", "gi");
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

  let bestSubject = null;
  let maxCount = 0;
  for (const [subj, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      bestSubject = subj;
    }
  }

  const confidence = maxCount / totalMatches;
  return { subject: bestSubject, confidence };
}

// Helper to detect exam category from filename
function detectExamFromFilename(filename) {
  if (!filename) return null;
  const nameUpper = filename.toUpperCase();
  for (const exam of ALLOWED_EXAMS) {
    if (nameUpper.includes(exam.toUpperCase())) {
      return exam;
    }
  }
  return null;
}

// Rule-based exam detection mapping subjects (Step 10)
function detectExamRuleBased(subjects, filenameExam) {
  if (filenameExam) return filenameExam;

  const subjectSet = new Set(subjects.map(s => s.toLowerCase()));

  // Biology + Chemistry + Physics => MDCAT
  if (subjectSet.has("biology") && subjectSet.has("chemistry") && subjectSet.has("physics")) {
    return "MDCAT";
  }
  // Physics + Mathematics => ECAT
  if (subjectSet.has("physics") && subjectSet.has("mathematics")) {
    return "ECAT";
  }
  // Computer + English => LDC / UDC
  if (subjectSet.has("computer") && subjectSet.has("english")) {
    return "LDC";
  }
  // English + General Knowledge + Pakistan Studies + Islamic Studies + Intelligence => PMA / Army
  if (
    subjectSet.has("english") &&
    subjectSet.has("general knowledge") &&
    subjectSet.has("pakistan studies") &&
    subjectSet.has("islamic studies")
  ) {
    return "PMA";
  }
  // English + Mathematics + General Knowledge + Intelligence => ASF / FIA / Police
  if (
    subjectSet.has("english") &&
    subjectSet.has("mathematics") &&
    subjectSet.has("general knowledge")
  ) {
    return "ASF";
  }
  // Verbal Intelligence + Non-Verbal Intelligence => PMA / Navy / Air Force
  if (subjectSet.has("verbal intelligence") || subjectSet.has("non verbal intelligence") || subjectSet.has("intelligence")) {
    return "PMA";
  }

  // Fallbacks
  if (subjectSet.has("computer")) return "LDC";
  if (subjectSet.has("biology") || subjectSet.has("chemistry")) return "MDCAT";
  if (subjectSet.has("physics") || subjectSet.has("mathematics")) return "ECAT";

  return "General";
}

// Helper to normalize subject against allowed syllabus
const validateAndNormalizeSubject = (subj) => {
  if (!subj) return null;
  const cleaned = subj.toString().trim().replace(/-/g, " ").toLowerCase();
  const match = SYLLABUS_SUBJECTS.find(
    (s) => s.toLowerCase() === cleaned
  );
  return match || null;
};

// Helper to normalize exam category
const normalizeExamName = (exam) => {
  if (!exam) return "General";
  const cleaned = exam.toString().trim().toUpperCase();
  const match = ALLOWED_EXAMS.find(
    (e) => e.toUpperCase() === cleaned
  );
  return match || "General";
};

const normalizeQuestionText = (text) => {
  if (!text && text !== 0) return "";
  return text
    .toString()
    .toLowerCase()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?!.;,:\-]+$/g, "")
    .trim();
};

const normalizeOptionText = (option) => {
  if (option === undefined || option === null) return "";
  return option
    .toString()
    .toLowerCase()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const generateQuestionDuplicateKey = ({ subject, text, options, correctOptionIndex }) => {
  const normalizedSubject = validateAndNormalizeSubject(subject) || "General Knowledge";
  const normalizedText = normalizeQuestionText(text);
  const normalizedOptions = Array.isArray(options)
    ? options.map(normalizeOptionText)
    : [];
  const normalizedAnswerIndex = Number.isInteger(Number(correctOptionIndex))
    ? Number(correctOptionIndex)
    : -1;
  return `${normalizedSubject}|||${normalizedText}|||${normalizedOptions.join("|||")}|||${normalizedAnswerIndex}`;
};

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Helper to get or create an Exam document
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

/**
 * Extract text from file and parse to MCQ JSON using Rule-Based Extraction (with AI classification fallback).
 * POST /api/admin/mcq-import/upload
 */
exports.extractQuestions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    let extractedText = "";
    const filename = req.file.originalname;
    const extension = filename.split(".").pop().toLowerCase();
    const mimetype = req.file.mimetype;

    console.log(`📂 Processing file upload: ${filename} (${mimetype})`);

    // Step 2: Extract text based on file type (NO AI)
    if (extension === "pdf" || mimetype === "application/pdf") {
      try {
        const parser = new PDFParse({ data: req.file.buffer });
        const parsed = await parser.getText();
        extractedText = parsed.text || "";
        await parser.destroy();
      } catch (err) {
        console.warn("pdf-parse failed, checking OCR fallback:", err.message);
      }

      // OCR Fallback for scanned PDFs
      if (!extractedText || extractedText.trim().length < 100) {
        console.log("📸 pdf-parse returned low text. Running OCR fallback directly on embedded JPEGs...");
        const jpegs = extractJpegsFromPdf(req.file.buffer);
        if (jpegs.length > 0) {
          console.log(`📸 Found ${jpegs.length} embedded images. Running Tesseract in parallel batches...`);
          let ocrText = "";
          // Process JPEGs in small batches of 5 to avoid CPU/memory overload
          const limit = 5;
          for (let i = 0; i < jpegs.length; i += limit) {
            const chunk = jpegs.slice(i, i + limit);
            const results = await Promise.all(
              chunk.map((imgBuffer) =>
                Tesseract.recognize(imgBuffer, "eng")
                  .then((res) => res.data.text)
                  .catch((err) => {
                    console.error("OCR error for page image:", err.message);
                    return "";
                  })
              )
            );
            ocrText += results.join("\n") + "\n";
          }
          extractedText = ocrText;
        } else {
          console.warn("No JPEG pages found inside the scanned PDF.");
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
    } else if (mimetype.startsWith("image/")) {
      console.log("📸 Running Tesseract OCR on image...");
      const ocrResult = await Tesseract.recognize(req.file.buffer, "eng");
      extractedText = ocrResult.data.text;
    } else {
      return res.status(400).json({
        message: "Unsupported file type. Please upload PDF, DOCX, TXT, or Image.",
      });
    }

    if (!extractedText || !extractedText.trim()) {
      return res.status(400).json({ message: "Unable to extract any text from the file." });
    }

    // Step 4: Run Cleaning Engine before parsing
    console.log("🧹 Running cleaning engine on extracted text...");
    const cleanedText = mcqParser.cleanTextForParsing(extractedText);

    // Step 3: Rule-Based MCQ Extraction (NO AI)
    console.log("🧩 Extracting MCQs using rule-based parser...");
    const rawQuestions = mcqParser.parseMCQs(cleanedText);
    console.log(`🧩 Parsed ${rawQuestions.length} raw questions.`);

    if (rawQuestions.length === 0) {
      return res.status(422).json({
        message: "Could not find any structured MCQs in the file using standard patterns.",
      });
    }

    // Statistics tracking
    let totalFound = rawQuestions.length;
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;
    let possibleDuplicateCount = 0;
    let aiClassifiedCount = 0;
    let ruleClassifiedCount = 0;
    let cachedClassifiedCount = 0;
    let questionsWithAnswers = 0;
    let questionsMissingAnswers = 0;

    // Detect exam category from filename as primary option
    const filenameExam = detectExamFromFilename(filename);

    const processedQuestions = [];
    const validQuestionsToProcess = [];

    // Step 5: Format/Quality Validation (NO AI)
    for (let i = 0; i < rawQuestions.length; i++) {
      const q = rawQuestions[i];
      const text = q.text || "";
      const options = Array.isArray(q.options) ? q.options : [];
      const correctIndex = Number(q.correctOptionIndex);

      const hasValidOptions = options.length === 4;
      const areOptionsUnique = hasValidOptions && new Set(options.map(o => o.trim().toLowerCase())).size === 4;
      const areOptionsNonEmpty = hasValidOptions && options.every(o => o && o.trim().length > 0);
      const isTextNotEmpty = text.trim().length > 0;
      const isTextLongEnough = text.trim().length >= 15;

      const isFormatValid = hasValidOptions && areOptionsUnique && areOptionsNonEmpty && isTextNotEmpty && isTextLongEnough;

      if (!isFormatValid) {
        invalidCount++;
        processedQuestions.push({
          id: `extracted-${i}-${Date.now()}`,
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
              : !areOptionsNonEmpty
                ? "Options cannot be empty."
                : !areOptionsUnique
                  ? "Options must all be unique (no duplicate choices)."
                  : null,
            text: !isTextNotEmpty
              ? "Question text cannot be empty."
              : !isTextLongEnough
                ? "Question text is too short (must be at least 15 characters)."
                : null,
          },
        });
        continue;
      }

      validQuestionsToProcess.push({
        id: `extracted-${i}-${Date.now()}`,
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

    // New Hybrid AI-First Classification Logic
    const resolvedQuestions = [];
    const cacheInserts = [];

    if (validQuestionsToProcess.length > 0) {
      // 1. Check database cache first
      const cacheTexts = validQuestionsToProcess.map(q => q.text.trim());
      const cachedRecords = await ClassificationCache.find({ text: { $in: cacheTexts } }).lean();
      
      const cacheMap = new Map();
      cachedRecords.forEach(rec => {
        cacheMap.set(rec.text.trim().toLowerCase(), rec.subject);
      });

      const toClassifyWithAI = [];

      validQuestionsToProcess.forEach(q => {
        const cachedSubject = cacheMap.get(q.text.trim().toLowerCase());
        if (cachedSubject) {
          const normalized = validateAndNormalizeSubject(cachedSubject);
          if (normalized) {
            q.subject = normalized;
            cachedClassifiedCount++;
            resolvedQuestions.push(q);
            return;
          }
        }
        toClassifyWithAI.push(q);
      });

      // 2. AI Semantic Batch Classification (chunked in batches of 50-100)
      if (toClassifyWithAI.length > 0) {
        console.log(`🤖 AI semantic classification for ${toClassifyWithAI.length} questions...`);
        const batchSize = 50;
        const aiPromises = [];

        for (let i = 0; i < toClassifyWithAI.length; i += batchSize) {
          const batch = toClassifyWithAI.slice(i, i + batchSize);
          aiPromises.push(aiService.classifySubjectsBatch(batch).then(results => ({
            batch,
            results
          })));
        }

        const results = await Promise.all(aiPromises);

        for (const { batch, results: aiClassifications } of results) {
          batch.forEach((q, idx) => {
            const aiResult = aiClassifications.find(c => c.id === idx) || {};
            const aiSubject = validateAndNormalizeSubject(aiResult.subject);
            const aiConfidence = aiResult.confidence !== undefined ? Number(aiResult.confidence) : 0;

            // Priority 1: AI Semantic Classification (if confidence >= 60%)
            if (aiSubject && aiConfidence >= 60) {
              q.subject = aiSubject;
              aiClassifiedCount++;
              resolvedQuestions.push(q);

              // Cache the new high-confidence subject
              cacheInserts.push({
                text: q.text,
                subject: aiSubject,
                exam: "General"
              });
            } else {
              // Priority 2: Rule-Based Classification
              const { subject: ruleSubject, confidence: ruleConfidence } = detectSubjectRuleBased(q.text);
              const normalizedRuleSubject = validateAndNormalizeSubject(ruleSubject);

              if (normalizedRuleSubject && ruleConfidence >= 0.40) {
                q.subject = normalizedRuleSubject;
                ruleClassifiedCount++;
                resolvedQuestions.push(q);
              } else {
                // Priority 3: Last Resort Fallback (General Knowledge)
                q.subject = "General Knowledge";
                ruleClassifiedCount++;
                resolvedQuestions.push(q);
              }
            }
          });
        }

        // Cache the newly classified subjects
        if (cacheInserts.length > 0) {
          try {
            await ClassificationCache.insertMany(cacheInserts, { ordered: false });
          } catch (err) {
            if (err.code !== 11000) {
              console.error("Cache save error:", err.message);
            }
          }
        }
      }
    }

    // Separate resolved questions by whether they have parsed answers or need AI resolution
    const finalResolvedQuestions = [];
    const missingAnswerQuestions = resolvedQuestions.filter(q => q.correctOptionIndex < 0 || q.correctOptionIndex > 3);
    const resolvedWithAnswerQuestions = resolvedQuestions.filter(q => q.correctOptionIndex >= 0 && q.correctOptionIndex <= 3);

    finalResolvedQuestions.push(...resolvedWithAnswerQuestions);

    // AI Fallback to resolve correct option index (and refine subject if currently set to General Knowledge fallback)
    if (missingAnswerQuestions.length > 0) {
      console.log(`🤖 AI resolving correct answer index for ${missingAnswerQuestions.length} questions...`);
      const batchSize = 50;
      const aiPromises = [];

      for (let i = 0; i < missingAnswerQuestions.length; i += batchSize) {
        const batch = missingAnswerQuestions.slice(i, i + batchSize);
        aiPromises.push(aiService.resolveUncertainMCQsBatch(batch).then(results => ({
          batch,
          results
        })));
      }

      const results = await Promise.all(aiPromises);

      for (const { batch, results: aiClassifications } of results) {
        batch.forEach((q, idx) => {
          const aiResult = aiClassifications.find(c => c.id === idx) || {};
          const correctIndex = aiResult.correctOptionIndex !== undefined ? Number(aiResult.correctOptionIndex) : -1;
          const aiSubject = validateAndNormalizeSubject(aiResult.subject);

          if (correctIndex >= 0 && correctIndex <= 3) {
            q.correctOptionIndex = correctIndex;
          }
          if (aiSubject && q.subject === "General Knowledge") {
            q.subject = aiSubject;
          }

          finalResolvedQuestions.push(q);
        });
      }
    }

    // Combine resolved questions and finalize validity (must have correct answer index 0-3)
    const finalizedQuestions = [];
    for (const q of finalResolvedQuestions) {
      const hasValidAnswerIndex = q.correctOptionIndex >= 0 && q.correctOptionIndex <= 3;
      if (!hasValidAnswerIndex) {
        invalidCount++;
        q.isValid = false;
        q.validationErrors.correctIndex = "Correct answer must be A, B, C, or D.";
        processedQuestions.push(q);
      } else {
        finalizedQuestions.push(q);
      }
    }


    // Step 6: Exact duplicate detection on valid questions
    if (finalizedQuestions.length > 0) {
      console.log(`🔍 Running exact duplicate verification on extracted questions...`);
      const subjectsNeeded = [...new Set(finalizedQuestions.map(q => q.subject))];
      const existingDocs = await Question.find({ subject: { $in: subjectsNeeded } })
        .select("text options correctOptionIndex subject")
        .lean();

      const existingQuestionKeys = new Set(
        existingDocs.map((doc) =>
          generateQuestionDuplicateKey({
            subject: doc.subject,
            text: doc.text,
            options: doc.options,
            correctOptionIndex: doc.correctOptionIndex,
          }),
        ),
      );

      for (const q of finalizedQuestions) {
        const duplicateKey = generateQuestionDuplicateKey({
          subject: q.subject,
          text: q.text,
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
        });

        if (existingQuestionKeys.has(duplicateKey)) {
          q.isDuplicate = true;
          duplicateCount++;
        } else {
          q.isDuplicate = false;
          existingQuestionKeys.add(duplicateKey);
        }

        validCount++;
        processedQuestions.push(q);
      }
    }

    // Step 10: Exam Detection (Based on detected subjects across the batch)
    const finalSubjects = processedQuestions.filter(q => q.isValid).map(q => q.subject);
    const overallExam = detectExamRuleBased(finalSubjects, filenameExam);

    processedQuestions.forEach(q => {
      if (q.isValid) {
        q.exam = overallExam;
        
        // Count questions with and without answers
        if (q.correctOptionIndex >= 0 && q.correctOptionIndex <= 3) {
          questionsWithAnswers++;
        } else {
          questionsMissingAnswers++;
        }
      }
    });

    // Sort by original order
    processedQuestions.sort((a, b) => a.id.localeCompare(b.id));

    // Step 11: Import Preview Stats & distributions
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
      duplicates: duplicateCount,
      possibleDuplicates: possibleDuplicateCount,
      invalid: invalidCount,
      questionsWithAnswers,
      questionsMissingAnswers,
      aiClassified: aiClassifiedCount,
      ruleClassified: ruleClassifiedCount,
      cachedClassified: cachedClassifiedCount,
      subjectDistribution,
      examDistribution,
    };

    console.log("📊 Import stats complete:", stats);

    res.json({
      message: "MCQ extraction and preview ready",
      stats,
      questions: processedQuestions,
    });
  } catch (err) {
    console.error("MCQ Question Extraction Error:", err);
    res.status(500).json({
      message: err.message || "Internal server error during question extraction",
    });
  }
};

/**
 * Save validated MCQs list to database. (Uses insertMany)
 * POST /api/admin/mcq-import/save
 */
exports.saveQuestions = async (req, res) => {
  try {
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "No questions provided to save." });
    }

    const skippedDuplicates = [];
    const skippedInvalid = [];
    const toInsert = [];

    // Group questions by subject to minimize database reads
    const questionsBySubject = {};
    for (const q of questions) {
      const subject = validateAndNormalizeSubject(q.subject);
      if (!subject) {
        skippedInvalid.push({ text: q.text || "", reason: "Invalid subject" });
        continue;
      }
      if (!questionsBySubject[subject]) {
        questionsBySubject[subject] = [];
      }
      questionsBySubject[subject].push(q);
    }

    // Process each subject's questions
    for (const subject of Object.keys(questionsBySubject)) {
      const existingDocs = await Question.find({ subject })
        .select("text options correctOptionIndex subject")
        .lean();

      const existingQuestionKeys = new Set(
        existingDocs.map((doc) =>
          generateQuestionDuplicateKey({
            subject: doc.subject,
            text: doc.text,
            options: doc.options,
            correctOptionIndex: doc.correctOptionIndex,
          }),
        ),
      );
      const batchQuestionKeys = new Set();

      for (const q of questionsBySubject[subject]) {
        const text = (q.text || "").trim();
        const options = Array.isArray(q.options) ? q.options.map(String) : [];
        const correctIndex = Number(q.correctOptionIndex);
        const examName = normalizeExamName(q.exam);

        // Quality & Validation checks
        const hasFourOptions = options.length === 4;
        const areOptionsNonEmpty = hasFourOptions && options.every(o => o && o.trim().length > 0);
        const hasValidIndex = correctIndex >= 0 && correctIndex <= 3;
        const isTextValid = text.length >= 15;
        const areOptionsUnique = hasFourOptions && new Set(options.map(o => o.toString().trim().toLowerCase())).size === 4;

        if (!hasFourOptions || !areOptionsNonEmpty || !hasValidIndex || !isTextValid || !areOptionsUnique) {
          skippedInvalid.push({ text, reason: "Validation checks failed" });
          continue;
        }

        // Exact duplicate check using normalized subject, text, options, and correct answer.
        const duplicateKey = generateQuestionDuplicateKey({
          subject,
          text,
          options,
          correctOptionIndex: correctIndex,
        });

        if (existingQuestionKeys.has(duplicateKey) || batchQuestionKeys.has(duplicateKey)) {
          skippedDuplicates.push({ text, subject });
          continue;
        }

        batchQuestionKeys.add(duplicateKey);
        existingQuestionKeys.add(duplicateKey);
        toInsert.push({ ...q, subject, examName, text });
      }
    }

    if (toInsert.length === 0) {
      return res.status(200).json({
        message: "No new valid questions to import.",
        totalSaved: 0,
        skippedDuplicates: skippedDuplicates.length,
        skippedInvalid: skippedInvalid.length,
      });
    }

    // Resolve or create Exam IDs in bulk
    const uniqueExamNames = [...new Set(toInsert.map(q => q.examName))];
    const examMap = {};
    for (const name of uniqueExamNames) {
      const examDoc = await getOrCreateExam(name);
      examMap[name] = examDoc._id;
    }

    // Prepare Question documents
    const docsToInsert = toInsert.map(q => ({
      exam: examMap[q.examName],
      subject: q.subject,
      difficulty: q.difficulty || "medium",
      text: q.text,
      options: q.options.map(String),
      correctOptionIndex: Number(q.correctOptionIndex),
      type: q.type || "single",
      isActive: true,
    }));

    // Step 12: Bulk insert using insertMany
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
      message: `Successfully imported ${insertedDocs.length} questions.`,
      totalSaved: insertedDocs.length,
      skippedDuplicates: skippedDuplicates.length,
      skippedInvalid: skippedInvalid.length,
    });
  } catch (err) {
    console.error("Save Questions Error:", err);
    res.status(500).json({
      message: err.message || "Failed to save parsed questions to database.",
    });
  }
};
