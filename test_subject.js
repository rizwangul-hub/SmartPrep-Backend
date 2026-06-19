const fs = require('fs');

const SUBJECT_KEYWORDS = {
  English: [
    "synonym","antonym","grammar","preposition","article","tense",
    "active voice","passive voice","idiom","adjective","adverb",
    "noun","pronoun","conjunction","spelling","vocabulary","verb",
    "subject verb agreement","direct speech","indirect speech",
    "sentence correction","error detection","fill in the blanks",
    "comprehension","phrase","clause","parts of speech",
    "one word substitution","analogy","homophone","prefix","suffix"
  ],

  Urdu: [
    "urdu","ghazal","shair","nazm","adab","mushaira","ghalib",
    "iqbal","shairi","lafz","jumla","huroof","fail","faal",
    "ism","sift","takhallus","qawaid","khulasa","tashreeh",
    "urdu grammar","mohavra","zarbul misal","mazmoon",
    "urdu adab","nasr","hamd","naat","marsiya","qasida","rubai"
  ],

  Mathematics: [
    "percentage","ratio","average","profit","loss","equation",
    "algebra","geometry","trigonometry","fraction","matrix",
    "logarithm","derivative","integral","probability",
    "arithmetic","mean","median","mode","simplification",
    "interest","discount","time and work","time and distance",
    "age problem","number system","set theory","permutation",
    "combination","statistics","quadratic","polynomial",
    "coordinate geometry","circle","triangle","area","volume"
  ],

  Physics: [
    "newton","force","velocity","current","voltage","wave",
    "electromagnetic","motion","momentum","energy","work",
    "acceleration","gravity","refraction","thermodynamics",
    "quantum","electricity","magnetism","ohm","resistance",
    "capacitor","inductor","nuclear","optics","lens","mirror",
    "frequency","amplitude","sound","light","heat",
    "kinetic energy","potential energy","coulomb","electrostatic",
    "power","watt","joule","pressure","density"
  ],

  Chemistry: [
    "atom","molecule","compound","acid","base","reaction",
    "catalyst","element","periodic table","covalent","ionic",
    "organic","inorganic","oxidation","reduction","alkane",
    "alkene","alkyne","benzene","alcohol","phenol","ketone",
    "aldehyde","ester","polymer","electrolysis","salt",
    "ph","equilibrium","molarity","mole","chemical bond",
    "electron","proton","neutron","isotope"
  ],

  Biology: [
    "cell","dna","enzyme","genetics","photosynthesis",
    "respiration","chromosome","organism","protein","hormone",
    "blood","mitosis","meiosis","ecosystem","bacteria","virus",
    "tissue","organ","gene","inheritance","mutation",
    "circulation","digestion","respiratory system",
    "nervous system","immune system","reproduction",
    "evolution","taxonomy","botany","zoology",
    "human body","kidney","heart","lungs","brain"
  ],

  Computer: [
    "html","css","javascript","cpu","ram","operating system",
    "database","network","software","hardware","programming",
    "internet","protocol","memory","storage","compiler",
    "algorithm","binary","sql","mongodb","react","nodejs",
    "api","router","server","client","cloud","cyber security",
    "email","browser","excel","word","powerpoint","windows",
    "linux","keyboard shortcut","input device","output device",
    "machine learning","artificial intelligence","chatgpt"
  ],

  "Islamic Studies": [
    "allah","islam","quran","holy quran","surah","ayah",
    "hadith","sunnah","prophet","rasool","nabbi",
    "hazrat muhammad","khulfa e rashideen","abu bakr",
    "umar","usman","ali","ghazwa","badr","uhud","khandaq",
    "hijrat","makkah","madina","kaaba","hajj","umrah",
    "zakat","roza","fasting","namaz","salah","tauheed",
    "risalat","akhirat","wudu","tayammum","fiqh",
    "islamic history","islamic studies","sahabi","sahaba",
    "imam bukhari","imam muslim","battle of tabuk"
  ],

  "Pakistan Studies": [
    "pakistan","quaid e azam","muhammad ali jinnah",
    "allama iqbal","lahore resolution","pakistan movement",
    "constitution","1973 constitution","1947",
    "east pakistan","west pakistan","independence",
    "kashmir","pak army","pak navy","pak air force",
    "indus river","kpk","punjab","sindh","balochistan",
    "gilgit baltistan","national assembly","senate",
    "prime minister","president of pakistan",
    "pakistan studies","pakistan affairs","objective resolution"
  ],

  "Current Affairs": [
    "current affairs","recent","today","latest",
    "2025","2026","summit","election","budget",
    "g20","united nations","oic","imf","world bank",
    "cop","climate change","economic survey",
    "foreign minister","prime minister","president",
    "international news","breaking news","recent event",
    "conflict","agreement","treaty","sanction"
  ],

  "General Knowledge": [
    "capital","currency","country","continent","ocean",
    "river","mountain","desert","lake","sea",
    "united nations","uno","oic","saarc","nato",
    "world health organization","who",
    "headquarters","geography","flag","population",
    "national animal","national flower",
    "largest","smallest","longest","highest",
    "inventor","invention","nobel prize",
    "planet","solar system","earth","mars","venus",
    "world cup","olympics"
  ],

  Intelligence: [
    "analogy","series","odd one out","coding",
    "decoding","blood relation","direction sense",
    "logical reasoning","pattern","sequence",
    "mirror image","water image","embedded figure",
    "non verbal","verbal intelligence","iq",
    "ranking","alphabet series","number series",
    "statement conclusion","syllogism"
  ],

  "Verbal Intelligence": [
    "analogy","coding","decoding","series",
    "blood relation","direction sense",
    "alphabet","word formation","logical reasoning",
    "odd one out","statement","conclusion"
  ],

  "Non Verbal Intelligence": [
    "figure","pattern","shape","mirror image",
    "water image","embedded figure","visual reasoning",
    "diagram","image series","symbol series",
    "non verbal","figure classification"
  ]
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
