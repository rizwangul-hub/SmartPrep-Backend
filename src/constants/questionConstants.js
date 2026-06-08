const SUPPORTED_SUBJECTS = [
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

const SUPPORTED_DIFFICULTIES = ["easy", "medium", "hard"];

const EXAM_OPTIONS = [
  "PMA",
  "Army",
  "Navy",
  "Air Force",
  "ASF",
  "FIA",
  "Police",
  "UDC",
  "LDC",
  "MDCAT",
  "ECAT",
];

// Balanced subject distribution per exam (subject -> count)
const EXAM_DISTRIBUTIONS = {
  pma: {
    English: 20,
    "General Knowledge": 20,
    "Pakistan Studies": 20,
    "Islamic Studies": 20,
    Intelligence: 20,
  },
  army: {
    English: 20,
    "General Knowledge": 20,
    "Pakistan Studies": 20,
    "Islamic Studies": 20,
    Intelligence: 20,
  },
  navy: {
    English: 20,
    "General Knowledge": 20,
    "Pakistan Studies": 20,
    "Islamic Studies": 20,
    Intelligence: 20,
  },
  "air force": {
    "Verbal Intelligence": 50,
    "Non Verbal Intelligence": 50,
  },
  asf: {
    English: 25,
    Mathematics: 25,
    "General Knowledge": 25,
    Intelligence: 25,
  },
  fia: {
    English: 25,
    Mathematics: 25,
    "General Knowledge": 25,
    Intelligence: 25,
  },
  police: {
    English: 25,
    Mathematics: 25,
    "General Knowledge": 25,
    Intelligence: 25,
  },
  udc: {
    English: 25,
    "General Knowledge": 25,
    Mathematics: 25,
    "Pakistan Studies": 25,
  },
  ldc: {
    English: 25,
    "General Knowledge": 25,
    Mathematics: 25,
    "Pakistan Studies": 25,
  },
  mdcat: {
    Biology: 30,
    Chemistry: 25,
    Physics: 25,
    English: 20,
  },
  ecat: {
    Mathematics: 35,
    Physics: 35,
    Chemistry: 30,
  },
};

const normalizeExamKey = (examName) => {
  const normalized = (examName || "").trim().toLowerCase();
  if (normalized.includes("pma")) return "pma";
  if (normalized.includes("air force") || normalized.includes("paf"))
    return "air force";
  if (normalized.includes("army")) return "army";
  if (normalized.includes("navy")) return "navy";
  if (normalized.includes("mdcat")) return "mdcat";
  if (normalized.includes("ecat")) return "ecat";
  if (normalized.includes("asf")) return "asf";
  if (normalized.includes("fia")) return "fia";
  if (normalized.includes("police")) return "police";
  if (normalized.includes("udc")) return "udc";
  if (normalized.includes("ldc")) return "ldc";
  return normalized;
};

const normalizeDifficulty = (value) => {
  const d = (value || "medium").toString().trim().toLowerCase();
  if (d === "easy") return "easy";
  if (d === "hard") return "hard";
  return "medium";
};

const normalizeSubject = (subject) => {
  const trimmed = (subject || "").toString().trim();
  const match = SUPPORTED_SUBJECTS.find(
    (s) => s.toLowerCase() === trimmed.toLowerCase(),
  );
  return match || trimmed;
};

module.exports = {
  SUPPORTED_SUBJECTS,
  SUPPORTED_DIFFICULTIES,
  EXAM_OPTIONS,
  EXAM_DISTRIBUTIONS,
  normalizeExamKey,
  normalizeDifficulty,
  normalizeSubject,
};
