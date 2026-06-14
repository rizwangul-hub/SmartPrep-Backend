/**
 * MCQ Subject Reclassifier
 * Moves incorrectly classified "General Knowledge" MCQs to correct subjects.
 * Uses semantic pattern scoring first, then AI fallback for low-confidence cases.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Question = require("../models/Question");
const { SUPPORTED_SUBJECTS, normalizeSubject } = require("../constants/questionConstants");
const aiService = require("./ai.service");

const CONFIDENCE_THRESHOLD = 70;
const AI_BATCH_SIZE = 75;
const GK_SUBJECT = "General Knowledge";

const REPORTS_DIR = path.resolve(__dirname, "../../../reports");
const PREVIEW_FILE = path.join(REPORTS_DIR, "reclassification-preview.json");
const REPORT_FILE = path.join(REPORTS_DIR, "reclassification-report.json");

/** Semantic rules: pattern groups with per-match weight (meaning-based, not bare keywords). */
const SEMANTIC_RULES = [
  {
    subject: "Islamic Studies",
    weight: 4,
    patterns: [
      /\b(first|second|third|fourth)\s+caliph\b/i,
      /\bkhulafa[\s-]?e[\s-]?rashideen\b/i,
      /\brashid(?:un|een)\s+caliph/i,
      /\bghazwa[t]?\b/i,
      /\bghazwat\b/i,
      /\bsahaba\b/i,
      /\bcompanions?\s+of\s+(the\s+)?prophet\b/i,
      /\bprophet\s+(muhammad|mohammad|pbuh|ﷺ)\b/i,
      /\b(surah|ayah|ayat|qur(?:an|'an|anic))\b/i,
      /\bhadith\b/i,
      /\b(sunnah|sunna)\b/i,
      /\b(zakat|hajj|umrah|namaz|salah|sawm|ramadan|fasting)\b/i,
      /\b(fiqh|sharia|shariah|islamic\s+law)\b/i,
      /\b(makkah|mecca|madinah|medina)\b/i,
      /\btrench\s+(was\s+)?dug\b/i,
      /\bislamic\s+(history|personalit|scholar|jurisprudence)\b/i,
      /\bpillars?\s+of\s+islam\b/i,
      /\bangels?\s+in\s+islam\b/i,
      /\bwudu\b/i,
      /\bhijrah\b/i,
      /\bbattle\s+of\s+(badar|uhud|khandaq|hunayn|tabuk)\b/i,
    ],
  },
  {
    subject: "Pakistan Studies",
    weight: 4,
    patterns: [
      /\bquaid[\s-]?e[\s-]?azam\b/i,
      /\bmuhammad\s+ali\s+jinnah\b/i,
      /\ballama\s+iqbal\b/i,
      /\b(shikwa|jawab[\s-]?e[\s-]?shikwa)\b/i,
      /\blahore\s+resolution\b/i,
      /\bpakistan\s+(movement|resolution|independence|creation)\b/i,
      /\bconstitution\s+of\s+pakistan\b/i,
      /\b1973\s+constitution\b/i,
      /\bmuslim\s+league\b/i,
      /\bpartition\s+of\s+(india|subcontinent)\b/i,
      /\beast\s+pakistan\b/i,
      /\b14\s+august\s+1947\b/i,
      /\bindus\s+(river|basin|water)\b/i,
      /\bkarakoram\b/i,
      /\bfirst\s+(president|governor|prime\s+minister)\s+of\s+pakistan\b/i,
      /\b(father\s+of\s+pakistan|national\s+anthem\s+of\s+pakistan)\b/i,
      /\bpakistan\s+got\s+independence\b/i,
      /\bnational\s+language\s+of\s+pakistan\b/i,
      /\bgeography\s+of\s+pakistan\b/i,
      /\bhistory\s+of\s+pakistan\b/i,
      /\bviceroy\b/i,
      /\bsimla\s+(deputation|conference)\b/i,
    ],
  },
  {
    subject: "Current Affairs",
    weight: 3,
    patterns: [
      /\bcurrent\s+(secretary|president|prime\s+minister|chief|minister|governor|chairman)\b/i,
      /\bwho\s+is\s+the\s+current\b/i,
      /\brecently\s+(elected|appointed|announced|held)\b/i,
      /\blatest\s+(summit|conference|development|news)\b/i,
      /\b(202[4-9]|2030)\b.*\b(elected|appointed|summit|championship|president|minister)\b/i,
      /\b(g20|cop28|cop29|asean|brics)\s+(summit|meeting)\b/i,
      /\bcurrent\s+affairs\b/i,
      /\bforeign\s+minister\s+of\b/i,
    ],
  },
  {
    subject: "English",
    weight: 3,
    patterns: [
      /\b(synonym|antonym)\s+of\b/i,
      /\bchoose\s+the\s+(correct|appropriate)\s+(preposition|article|tense|form|word)\b/i,
      /\b(sentence\s+correction|correct\s+the\s+sentence)\b/i,
      /\b(active\s+voice|passive\s+voice)\b/i,
      /\b(direct\s+speech|indirect\s+speech)\b/i,
      /\b(grammar|vocabulary|spelling)\b/i,
      /\b(preposition|conjunction|pronoun|adjective|adverb)\b/i,
      /\bfill\s+in\s+the\s+blank\b/i,
      /\bpart\s+of\s+speech\b/i,
    ],
  },
  {
    subject: "Urdu",
    weight: 3,
    patterns: [
      /\burdu\s+(grammar|literature|poetry|shairi|adab)\b/i,
      /\b(ghazal|nazm|mushaira|tashreeh|khulasa)\b/i,
      /\b(ism|fail|faal|sift|harf)\b/i,
      /\btakhallus\b/i,
      /\bqawaid[\s-]?e[\s-]?urdu\b/i,
      /[\u0600-\u06FF]{8,}/,
    ],
  },
  {
    subject: "Mathematics",
    weight: 3,
    patterns: [
      /\b\d+\s*[\+\-\*\/\^×÷]\s*\d+/,
      /\b(solve|calculate|find\s+the\s+value|evaluate)\b.*\b(equation|expression|x|y)\b/i,
      /\b(algebra|geometry|trigonometry|calculus|matrix|matrices)\b/i,
      /\b(percentage|ratio|proportion|average|profit|loss)\b/i,
      /\b(area|perimeter|volume|circumference)\s+of\b/i,
      /\bif\s+.+\s*=\s*\d+/i,
      /\b\d+\s*%\s+of\s+\d+/i,
    ],
  },
  {
    subject: "Physics",
    weight: 3,
    patterns: [
      /\b(force|velocity|acceleration|momentum|newton)\b/i,
      /\b(current|voltage|resistance|ohm|ampere|watt)\b/i,
      /\b(electromagnet|optics|refraction|reflection|lens)\b/i,
      /\b(thermodynamics|heat|temperature|entropy)\b/i,
      /\b(wave|frequency|wavelength|amplitude)\b/i,
      /\b(motion|kinematics|projectile|gravity)\b/i,
      /\b(speed\s+of\s+light|theory\s+of\s+relativity|si\s+unit\s+of\s+force)\b/i,
      /\b(discovered?\s+gravity|law\s+of\s+gravity)\b/i,
    ],
  },
  {
    subject: "Chemistry",
    weight: 3,
    patterns: [
      /\b(element|compound|molecule|atom|atomic\s+structure)\b/i,
      /\b(periodic\s+table|chemical\s+reaction|reaction\s+rate)\b/i,
      /\b(acid|base|ph\s+value|oxidation|reduction)\b/i,
      /\b(covalent|ionic|metallic)\s+bond/i,
      /\b(organic|inorganic)\s+chemistry\b/i,
      /\b(catalyst|electrolysis|mole|molarity)\b/i,
    ],
  },
  {
    subject: "Biology",
    weight: 3,
    patterns: [
      /\b(cell|dna|rna|gene|genetic|chromosome)\b/i,
      /\b(enzyme|protein|hormone|organelle)\b/i,
      /\b(photosynthesis|respiration|mitosis|meiosis)\b/i,
      /\b(human\s+body|physiology|anatomy|organ\s+system)\b/i,
      /\b(reproduction|evolution|ecosystem|biodiversity)\b/i,
      /\b(bacteria|virus|microorganism|pathogen)\b/i,
      /\b(nervous\s+system|immune\s+system|digestive\s+system)\b/i,
    ],
  },
  {
    subject: "Computer",
    weight: 3,
    patterns: [
      /\b(html|css|javascript|python|java|c\+\+|programming)\b/i,
      /\b(cpu|ram|rom|gpu|motherboard)\b/i,
      /\b(operating\s+system|database|sql|network)\b/i,
      /\b(software|hardware|compiler|algorithm)\b/i,
      /\b(internet|protocol|ip\s+address|router|firewall|computer\s+network)\b/i,
      /\b(binary|hexadecimal|byte|bit)\b/i,
    ],
  },
  {
    subject: "Non Verbal Intelligence",
    weight: 3,
    patterns: [
      /\b(mirror\s+image|water\s+image|next\s+figure)\b/i,
      /\b(paper\s+folding|embedded\s+figure|pattern\s+completion)\b/i,
      /\b(rotation\s+of\s+shape|matrix\s+completion)\b/i,
      /\bnon[\s-]?verbal\b/i,
      /\bcomplete\s+the\s+figure\b/i,
    ],
  },
  {
    subject: "Verbal Intelligence",
    weight: 3,
    patterns: [
      /\bverbal\s+(analogy|series|reasoning|intelligence)\b/i,
      /\b(letter\s+series|word\s+series|alphabet\s+series)\b/i,
      /\b(word\s+relation|logical\s+deduction)\b/i,
    ],
  },
  {
    subject: "Intelligence",
    weight: 2,
    patterns: [
      /\b(analogy|coding[\s-]?decoding|blood\s+relation)\b/i,
      /\b(odd\s+one\s+out|series|sequence|pattern)\b/i,
      /\b(logical\s+reasoning|direction\s+sense)\b/i,
      /\bcomplete\s+the\s+series\b/i,
    ],
  },
  {
    subject: GK_SUBJECT,
    weight: 2,
    patterns: [
      /\bcapital\s+of\s+(?!pakistan\b)\w+/i,
      /\bcurrency\s+of\b/i,
      /\b(largest|longest|highest|deepest|smallest)\s+(lake|river|mountain|ocean|country|continent)\b/i,
      /\b(united\s+nations|un\s+headquarters|who|imf|world\s+bank|saarc|oic|nato)\b/i,
      /\bun\s+was\s+established\b/i,
      /\brailway\s+network\b/i,
      /\bwho\s+invented\b/i,
      /\bworld\s+(war|record|geography)\b/i,
      /\bheadquarters\s+of\b/i,
      /\bnobel\s+prize\b/i,
    ],
  },
];

const KEYWORD_RULES = {
  English: [
    "synonym", "antonym", "grammar", "preposition", "article", "tense",
    "active voice", "passive voice", "idiom", "vocabulary", "spelling",
  ],
  Urdu: ["urdu", "ghazal", "nazm", "adab", "shairi", "takhallus", "qawaid"],
  Mathematics: [
    "percentage", "ratio", "equation", "algebra", "geometry", "trigonometry",
    "arithmetic", "fraction", "probability", "matrix",
  ],
  Physics: [
    "force", "velocity", "acceleration", "current", "voltage", "motion",
    "momentum", "thermodynamics", "electromagnetic", "optics",
  ],
  Chemistry: [
    "atom", "molecule", "compound", "acid", "base", "reaction", "element",
    "periodic table", "covalent", "oxidation",
  ],
  Biology: [
    "cell", "dna", "enzyme", "genetics", "photosynthesis", "chromosome",
    "organelle", "evolution", "physiology", "reproduction", "ecosystem",
  ],
  Computer: [
    "html", "css", "javascript", "cpu", "ram", "database",
    "computer network", "programming", "operating system", "software", "hardware",
    "ip address", "binary code",
  ],
  "Islamic Studies": [
    "quran", "hadith", "zakat", "hajj", "ghazwa", "prophet", "caliph",
    "sunnah", "fiqh", "sahaba", "surah", "ramadan",
  ],
  "Pakistan Studies": [
    "quaid e azam", "allama iqbal", "pakistan movement", "lahore resolution",
    "constitution", "1947", "muslim league", "partition",
  ],
  "Current Affairs": [
    "current government", "recent", "latest summit", "g20", "cop28",
    "prime minister", "president of", "current affairs",
  ],
  Intelligence: [
    "analogy", "coding decoding", "blood relation", "series", "odd one out",
    "logical reasoning",
  ],
  "Verbal Intelligence": ["verbal series", "alphabet series", "word relation"],
  "Non Verbal Intelligence": [
    "mirror image", "water image", "next figure", "paper folding", "non verbal",
  ],
  [GK_SUBJECT]: [
    "capital of", "currency of", "longest river", "highest peak", "ocean",
    "continent", "headquarters", "world war", "nobel prize",
  ],
};

function buildMcqText(question) {
  const parts = [(question.text || "").trim()];
  if (Array.isArray(question.options)) {
    parts.push(...question.options.map((o) => (o || "").trim()).filter(Boolean));
  }
  return parts.join(" ");
}

function scoreSemanticRules(text) {
  const scores = {};
  for (const rule of SEMANTIC_RULES) {
    let hits = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) hits += 1;
    }
    if (hits > 0) {
      scores[rule.subject] = (scores[rule.subject] || 0) + hits * rule.weight;
    }
  }
  return scores;
}

function scoreKeywords(text) {
  const lower = text.toLowerCase();
  const scores = {};
  for (const [subject, keywords] of Object.entries(KEYWORD_RULES)) {
    let hits = 0;
    for (const kw of keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = kw.includes(" ")
        ? new RegExp(escaped, "gi")
        : new RegExp(`\\b${escaped}\\b`, "gi");
      const matches = lower.match(regex);
      if (matches) hits += matches.length;
    }
    if (hits > 0) scores[subject] = (scores[subject] || 0) + hits;
  }
  return scores;
}

function mergeScores(...scoreMaps) {
  const merged = {};
  for (const map of scoreMaps) {
    for (const [subject, score] of Object.entries(map)) {
      merged[subject] = (merged[subject] || 0) + score;
    }
  }
  return merged;
}

function scoresToClassification(scores) {
  const entries = Object.entries(scores).filter(([, s]) => s > 0);
  if (entries.length === 0) {
    return { subject: null, confidence: 0, method: "semantic" };
  }

  entries.sort((a, b) => b[1] - a[1]);
  const [topSubject, topScore] = entries[0];
  const secondScore = entries[1]?.[1] || 0;
  const total = entries.reduce((sum, [, s]) => sum + s, 0);

  const dominance = topScore / total;
  const margin = topScore - secondScore;
  const confidence = Math.min(
    99,
    Math.round(dominance * 60 + Math.min(margin, 10) * 4 + Math.min(topScore, 20) * 1.5),
  );

  const normalized = normalizeSubject(topSubject);
  if (!SUPPORTED_SUBJECTS.includes(normalized)) {
    return { subject: null, confidence: 0, method: "semantic" };
  }

  return { subject: normalized, confidence, method: "semantic" };
}

function classifyLocally(question) {
  const text = buildMcqText(question);
  const semantic = scoreSemanticRules(text);
  const keywords = scoreKeywords(text);
  const combined = mergeScores(semantic, keywords);

  const nonGk = { ...combined };
  delete nonGk[GK_SUBJECT];
  const nonGkResult = scoresToClassification(nonGk);

  if (nonGkResult.subject && nonGkResult.confidence >= CONFIDENCE_THRESHOLD) {
    return nonGkResult;
  }

  const gkResult = scoresToClassification(combined);
  if (gkResult.subject === GK_SUBJECT && gkResult.confidence >= CONFIDENCE_THRESHOLD) {
    return gkResult;
  }

  if (nonGkResult.subject && nonGkResult.confidence > gkResult.confidence) {
    return { ...nonGkResult, confidence: Math.max(nonGkResult.confidence, 40) };
  }

  return gkResult.subject
    ? { ...gkResult, confidence: Math.max(gkResult.confidence, 30) }
    : { subject: null, confidence: 0, method: "semantic" };
}

async function classifyWithAi(questions, { onProgress } = {}) {
  const results = new Map();
  const totalBatches = Math.ceil(questions.length / AI_BATCH_SIZE);

  for (let i = 0; i < questions.length; i += AI_BATCH_SIZE) {
    const batchNum = Math.floor(i / AI_BATCH_SIZE) + 1;
    const batch = questions.slice(i, i + AI_BATCH_SIZE);
    const aiInput = batch.map((q, idx) => ({
      id: idx,
      text: q.text,
      options: q.options || [],
    }));

    if (onProgress) {
      onProgress(batchNum, totalBatches, batch.length);
    }

    const aiResults = await aiService.resolveUncertainMCQsBatch(aiInput);
    for (const item of aiResults) {
      const q = batch[item.id];
      if (!q) continue;
      const subject = normalizeSubject(item.subject);
      if (SUPPORTED_SUBJECTS.includes(subject)) {
        results.set(String(q._id), {
          subject,
          confidence: 90,
          method: "ai",
        });
      }
    }
  }
  return results;
}

function initDistribution() {
  const dist = { [GK_SUBJECT]: 0 };
  for (const s of SUPPORTED_SUBJECTS) {
    if (s !== GK_SUBJECT) dist[`willMoveTo${s.replace(/\s+/g, "")}`] = 0;
  }
  return dist;
}

function bumpDistribution(dist, subject, unchanged = false) {
  if (unchanged || subject === GK_SUBJECT) {
    dist[GK_SUBJECT] = (dist[GK_SUBJECT] || 0) + 1;
    return;
  }
  const key = `willMoveTo${subject.replace(/\s+/g, "")}`;
  if (dist[key] !== undefined) dist[key] += 1;
}

function generateConfirmToken(preview) {
  const payload = JSON.stringify({
    totalMCQs: preview.totalMCQs,
    generatedAt: preview.generatedAt,
    moveCount: preview.moveCount,
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function buildSamplesBySubject(classifications, perSubject = 5) {
  const bySubject = {};
  for (const c of classifications.filter((x) => x.willChange)) {
    if (!bySubject[c.newSubject]) bySubject[c.newSubject] = [];
    if (bySubject[c.newSubject].length < perSubject) {
      bySubject[c.newSubject].push({
        id: c._id,
        text: c.text.slice(0, 150),
        to: c.newSubject,
        method: c.method,
      });
    }
  }
  return bySubject;
}

async function analyzeGeneralKnowledgeMcqs({ useAi = true } = {}) {
  const questions = await Question.find({ subject: GK_SUBJECT }).lean();
  const classifications = [];

  if (useAi) {
    console.log(`AI classifying all ${questions.length} General Knowledge MCQs...`);
    const aiResults = await classifyWithAi(questions, {
      onProgress: (batch, total, size) => {
        console.log(`  AI batch ${batch}/${total} (${size} MCQs)...`);
      },
    });

    for (const q of questions) {
      const ai = aiResults.get(String(q._id));
      if (ai) {
        classifications.push({
          _id: q._id,
          text: q.text,
          options: q.options,
          currentSubject: GK_SUBJECT,
          newSubject: ai.subject,
          confidence: ai.confidence,
          method: ai.method,
          willChange: ai.subject !== GK_SUBJECT,
        });
      } else {
        const local = classifyLocally(q);
        classifications.push({
          _id: q._id,
          text: q.text,
          options: q.options,
          currentSubject: GK_SUBJECT,
          newSubject: local.subject || GK_SUBJECT,
          confidence: local.confidence,
          method: "ai-fallback-local",
          willChange: local.subject && local.subject !== GK_SUBJECT && local.confidence >= CONFIDENCE_THRESHOLD,
        });
      }
    }

    return { questions, classifications };
  }

  const uncertain = [];

  for (const q of questions) {
    const local = classifyLocally(q);
    if (local.confidence >= CONFIDENCE_THRESHOLD && local.subject) {
      classifications.push({
        _id: q._id,
        text: q.text,
        currentSubject: GK_SUBJECT,
        newSubject: local.subject,
        confidence: local.confidence,
        method: local.method,
        willChange: local.subject !== GK_SUBJECT,
      });
    } else {
      uncertain.push(q);
      classifications.push({
        _id: q._id,
        text: q.text,
        currentSubject: GK_SUBJECT,
        newSubject: null,
        confidence: local.confidence,
        method: "pending-ai",
        willChange: false,
        localHint: local.subject,
      });
    }
  }

  for (const entry of classifications) {
    if (entry.method === "pending-ai") {
      entry.newSubject = entry.localHint || GK_SUBJECT;
      entry.method = "local-low-confidence";
      entry.willChange =
        entry.newSubject !== GK_SUBJECT &&
        entry.confidence >= CONFIDENCE_THRESHOLD;
    }
  }

  return { questions, classifications };
}

function buildPreviewReport(classifications) {
  const distribution = initDistribution();
  distribution.totalMCQs = classifications.length;
  distribution.generalKnowledge = 0;

  let moveCount = 0;
  for (const c of classifications) {
    if (c.willChange) {
      moveCount += 1;
      bumpDistribution(distribution, c.newSubject);
    } else {
      bumpDistribution(distribution, GK_SUBJECT, true);
      distribution.generalKnowledge += 1;
    }
  }

  const preview = {
    totalMCQs: classifications.length,
    generalKnowledge: distribution.generalKnowledge,
    moveCount,
    ...Object.fromEntries(
      Object.entries(distribution).filter(
        ([k]) => k.startsWith("willMoveTo") || k === "totalMCQs",
      ),
    ),
    generatedAt: new Date().toISOString(),
    samplesBySubject: buildSamplesBySubject(classifications),
    sampleChanges: classifications
      .filter((c) => c.willChange)
      .slice(0, 25)
      .map((c) => ({
        id: c._id,
        text: c.text.slice(0, 120),
        from: c.currentSubject,
        to: c.newSubject,
        confidence: c.confidence,
        method: c.method,
      })),
  };

  preview.confirmToken = generateConfirmToken(preview);
  return preview;
}

async function generatePreview({ useAi = true, saveToFile = true } = {}) {
  const { classifications } = await analyzeGeneralKnowledgeMcqs({ useAi });
  const preview = buildPreviewReport(classifications);

  if (saveToFile) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(
      PREVIEW_FILE,
      JSON.stringify({ preview, classifications }, null, 2),
      "utf8",
    );
  }

  return { preview, classifications };
}

async function applyReclassification({
  confirmToken,
  classifications: inputClassifications,
  preview,
} = {}) {
  let classifications = inputClassifications;

  if (!classifications && fs.existsSync(PREVIEW_FILE)) {
    const saved = JSON.parse(fs.readFileSync(PREVIEW_FILE, "utf8"));
    classifications = saved.classifications;
    preview = preview || saved.preview;
  }

  if (!classifications?.length) {
    throw new Error("No preview data found. Run preview first.");
  }

  if (!confirmToken || !preview?.confirmToken) {
    throw new Error("Admin confirmation token is required.");
  }

  if (confirmToken !== preview.confirmToken) {
    throw new Error("Invalid confirmation token. Re-run preview and confirm again.");
  }

  const toUpdate = classifications.filter(
    (c) => c.willChange && c.newSubject && c.newSubject !== GK_SUBJECT,
  );

  const report = {
    updated: 0,
    unchanged: 0,
    errors: 0,
    errorDetails: [],
    appliedAt: new Date().toISOString(),
    confirmToken,
  };

  if (toUpdate.length === 0) {
    report.unchanged = classifications.length;
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");
    return report;
  }

  const BATCH = 500;
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH);
    const ops = batch.map((c) => ({
      updateOne: {
        filter: { _id: c._id, subject: GK_SUBJECT },
        update: { $set: { subject: c.newSubject } },
      },
    }));

    try {
      const result = await Question.bulkWrite(ops, { ordered: false });
      report.updated += result.modifiedCount || 0;
      report.unchanged += batch.length - (result.modifiedCount || 0);
    } catch (err) {
      report.errors += batch.length;
      report.errorDetails.push({ batchStart: i, message: err.message });
    }
  }

  report.unchanged += classifications.length - toUpdate.length;

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");

  return report;
}

module.exports = {
  CONFIDENCE_THRESHOLD,
  AI_BATCH_SIZE,
  buildMcqText,
  classifyLocally,
  analyzeGeneralKnowledgeMcqs,
  generatePreview,
  applyReclassification,
  PREVIEW_FILE,
  REPORT_FILE,
};
