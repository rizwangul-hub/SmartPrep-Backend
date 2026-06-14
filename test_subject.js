const fs = require('fs');

const SUBJECT_KEYWORDS = {
  English: ["synonym", "antonym", "grammar", "preposition", "article", "tense", "active voice", "passive voice", "idiom", "adjective", "adverb", "noun", "pronoun", "conjunction", "spelling", "vocab"],
  Urdu: ["urdu", "ghazal", "shair", "nazm", "adab", "mushaira", "ghalib", "iqbal", "shairi", "lafz", "jumla", "huroof", "fail", "faal", "ism", "sift", "takhallus", "qawaid", "khulasa", "tashreeh"],
  Mathematics: ["percentage", "ratio", "average", "profit", "loss", "equation", "algebra", "geometry", "trigonometry", "fraction", "matrix", "logarithm", "derivative", "integral", "probability", "arithmetic"],
  Physics: ["newton", "force", "velocity", "current", "voltage", "wave", "electromagnetic", "motion", "momentum", "energy", "work", "acceleration", "gravity", "refraction", "thermodynamics", "quantum"],
  Chemistry: ["atom", "molecule", "compound", "acid", "base", "reaction", "catalyst", "element", "periodic table", "covalent", "ionic", "organic", "inorganic", "oxidation", "reduction"],
  Biology: ["cell", "dna", "enzyme", "genetics", "photosynthesis", "respiration", "chromosome", "organism", "protein", "hormone", "blood", "mitosis", "meiosis", "ecosystem", "bacteria", "virus"],
  Computer: ["html", "css", "javascript", "cpu", "ram", "operating system", "database", "network", "software", "hardware", "programming", "internet", "protocol", "memory", "storage", "compiler"]
};

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

console.log('Q1:', detectSubjectRuleBased('Which organelle is known as the powerhouse of the cell?'));
console.log('Q2:', detectSubjectRuleBased('What is the primary pigment used by plants to absorb light during photosynthesis?'));
console.log('Q3:', detectSubjectRuleBased('Which macromolecule is primarily responsible for storing genetic information?'));
console.log('Q4:', detectSubjectRuleBased('What is the basic structural and functional unit of all living organisms?'));
