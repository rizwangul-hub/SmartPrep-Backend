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
  "ASF",
  "FIA",
  "ANF",
  "Police",
  "PMA",
  "Army",
  "Navy",
  "Air Force",
  "UDC",
  "LDC",
  "MDCAT",
  "ECAT"
];

// Syllabus maps and rules for all 12 exams
const EXAM_SYLLABUS = {
  asf: {
    title: "ASF Syllabus Test",
    duration: 100,
    totalQuestions: 100,
    distribution: {
      "English": 20,
      "General Knowledge & Current Affairs": 20,
      "Pakistan Studies": 20,
      "Islamic Studies & Urdu": 20,
      "Mathematics / Intelligence": 20
    }
  },
  fia: {
    title: "FIA Syllabus Test",
    duration: 100,
    totalQuestions: 100,
    distribution: {
      "English": 20,
      "General Knowledge & Current Affairs": 20,
      "Mathematics / Intelligence": 15,
      "Pakistan Studies": 20,
      "Islamic Studies": 15,
      "FIA Related Questions": 10
    }
  },
  anf: {
    title: "ANF Syllabus Test",
    duration: 100,
    totalQuestions: 100,
    distribution: {
      "English": 20,
      "General Knowledge & Everyday Science": 20,
      "Pakistan Studies": 20,
      "Islamic Studies": 20,
      "ANF Related Questions": 20
    }
  },
  police: {
    title: "Police Syllabus Test",
    duration: 100,
    totalQuestions: 100,
    distribution: {
      "General Knowledge & Current Affairs": 11,
      "Pakistan Studies": 11,
      "Current Affairs": 11,
      "English": 15,
      "Urdu": 11,
      "Mathematics": 11,
      "Intelligence": 11,
      "Law Basics": 12
    }
  },
  udc: {
    title: "UDC Syllabus Test",
    duration: 100,
    totalQuestions: 100,
    distribution: {
      "Computer": 50,
      "English": 10,
      "General Knowledge": 10,
      "Pakistan Studies": 10,
      "Islamic Studies": 10,
      "IQ / Intelligence": 10
    }
  },
  ldc: {
    title: "LDC Syllabus Test",
    duration: 100,
    totalQuestions: 100,
    distribution: {
      "Computer": 50,
      "English": 10,
      "General Knowledge": 10,
      "Pakistan Studies": 10,
      "Islamic Studies": 10,
      "IQ / Intelligence": 10
    }
  },
  mdcat: {
    title: "MDCAT Syllabus Test",
    duration: 180,
    totalQuestions: 180,
    distribution: {
      "Biology": 81,
      "Chemistry": 45,
      "Physics": 36,
      "English": 9,
      "IQ / Intelligence": 9
    }
  },
  ecat: {
    title: "ECAT Syllabus Test",
    duration: 100,
    totalQuestions: 100,
    distribution: {
      "Mathematics": 30,
      "Physics": 30,
      "Chemistry / Computer": 30,
      "English": 10
    }
  },
  army: {
    title: "Army Syllabus Test",
    duration: 100,
    totalQuestions: 100,
    distribution: {
      "English": 20,
      "General Knowledge": 20,
      "Pakistan Studies": 20,
      "Islamic Studies": 20,
      "Mathematics / Intelligence": 20
    }
  },
  pma: {
    stages: [
      {
        step: 1,
        title: "PMA - Step 1: Verbal Intelligence Test",
        duration: 30,
        totalQuestions: 50,
        distribution: { "Verbal Intelligence": 50 }
      },
      {
        step: 2,
        title: "PMA - Step 2: Non-Verbal Intelligence Test",
        duration: 30,
        totalQuestions: 50,
        distribution: { "Non Verbal Intelligence": 50 }
      },
      {
        step: 3,
        title: "PMA - Step 3: Academic Test",
        duration: 100,
        totalQuestions: 100,
        distribution: {
          "English": 20,
          "General Knowledge": 20,
          "Pakistan Studies": 20,
          "Islamic Studies": 20,
          "Mathematics": 20
        }
      }
    ]
  },
  navy: {
    stages: [
      {
        step: 1,
        title: "Navy - Step 1: Intelligence Test",
        duration: 30,
        totalQuestions: 50,
        distribution: {
          "Verbal Intelligence": 25,
          "Non Verbal Intelligence": 25
        }
      },
      {
        step: 2,
        title: "Navy - Step 2: Academic Test",
        duration: 100,
        totalQuestions: 100,
        distribution: {
          "English": 20,
          "Mathematics": 20,
          "Physics": 20,
          "General Knowledge": 20,
          "Pakistan Studies": 20
        }
      }
    ]
  },
  "air force": {
    stages: [
      {
        step: 1,
        title: "Air Force - Step 1: Intelligence Test",
        duration: 30,
        totalQuestions: 50,
        distribution: {
          "Verbal Intelligence": 25,
          "Non Verbal Intelligence": 25
        }
      },
      {
        step: 2,
        title: "Air Force - Step 2: English Test",
        duration: 50,
        totalQuestions: 50,
        distribution: { "English": 50 }
      },
      {
        step: 3,
        title: "Air Force - Step 3: Physics Test",
        duration: 50,
        totalQuestions: 50,
        distribution: { "Physics": 50 }
      },
      {
        step: 4,
        title: "Air Force - Step 4: Mathematics Test",
        duration: 50,
        totalQuestions: 50,
        distribution: { "Mathematics": 50 }
      }
    ]
  }
};

// Map EXAM_DISTRIBUTIONS for backward compatibility
const EXAM_DISTRIBUTIONS = {
  pma: EXAM_SYLLABUS.pma.stages[2].distribution,
  army: EXAM_SYLLABUS.army.distribution,
  navy: EXAM_SYLLABUS.navy.stages[1].distribution,
  "air force": EXAM_SYLLABUS["air force"].stages[1].distribution,
  asf: EXAM_SYLLABUS.asf.distribution,
  fia: EXAM_SYLLABUS.fia.distribution,
  anf: EXAM_SYLLABUS.anf.distribution,
  police: EXAM_SYLLABUS.police.distribution,
  udc: EXAM_SYLLABUS.udc.distribution,
  ldc: EXAM_SYLLABUS.ldc.distribution,
  mdcat: EXAM_SYLLABUS.mdcat.distribution,
  ecat: EXAM_SYLLABUS.ecat.distribution,
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
  if (normalized.includes("anf")) return "anf";
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
  EXAM_SYLLABUS,
  EXAM_DISTRIBUTIONS,
  normalizeExamKey,
  normalizeDifficulty,
  normalizeSubject,
};
