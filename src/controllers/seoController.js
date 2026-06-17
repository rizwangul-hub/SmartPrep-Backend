// backend/src/controllers/seoController.js
'use strict';

const mongoose = require('mongoose');
const Question = require('../models/Question');

// List of exact routes to generate and index
const STATIC_EXAMS = [
  { slug: 'asf-preparation', exam: 'ASF', type: 'prep', title: 'ASF Test Preparation 2026 | Airport Security Force', desc: 'Prepare for ASF written exam with PrepForce AI. Interactive mock tests, past papers, syllabus details, and ASI/Constable exam guides.' },
  { slug: 'asf-test-preparation', exam: 'ASF', type: 'prep-test', title: 'ASF Written Test Preparation & Guide | PrepForce AI', desc: 'Get the complete written test preparation guide for ASF. Solve interactive MCQs, check eligibility criteria, and past papers.' },
  { slug: 'asf-syllabus', exam: 'ASF', type: 'syllabus', title: 'ASF Written Test Syllabus 2026 & Marks Distribution | PrepForce AI', desc: 'Detailed syllabus, paper pattern, and subject-wise marks distribution for Airport Security Force (ASF) written tests.' },
  { slug: 'asf-mock-test', exam: 'ASF', type: 'mock', title: 'Free ASF Mock Test 2026 - Solve Interactive Exams | PrepForce AI', desc: 'Practice free high-yield ASF simulator mock tests. Get instant score, detailed explanation, and performance analytics.' },
  { slug: 'asf-past-papers', exam: 'ASF', type: 'papers', title: 'ASF Past Papers & Solved MCQs (PDF Guide) | PrepForce AI', desc: 'Solve authentic Airport Security Force (ASF) past papers questions and high-yield solved MCQs for ASI, Inspector, and Constable.' },

  { slug: 'fia-preparation', exam: 'FIA', type: 'prep', title: 'FIA Test Preparation 2026 - Sub-Inspector & Constable | PrepForce AI', desc: 'Pass the Federal Investigation Agency (FIA) written tests. Study guides, interactive tests, and solved past papers on PrepForce AI.' },
  { slug: 'fia-syllabus', exam: 'FIA', type: 'syllabus', title: 'FIA Written Test Syllabus & Marks Distribution 2026 | PrepForce AI', desc: 'Check FIA syllabus for Constable, Assistant Sub-Inspector (ASI), and Sub-Inspector. Marks distribution and study material.' },
  { slug: 'fia-mock-test', exam: 'FIA', type: 'mock', title: 'FIA Free Mock Test & Practice Simulator | PrepForce AI', desc: 'Test your FIA preparation with our real exam simulator. 100% free interactive questions with detailed explanations.' },
  { slug: 'fia-past-papers', exam: 'FIA', type: 'papers', title: 'FIA Solved Past Papers & High-Yield MCQs | PrepForce AI', desc: 'Practice real questions asked in previous FIA papers. Master General Knowledge, Current Affairs, and Computer Concepts.' },

  { slug: 'pma-preparation', exam: 'PMA', type: 'prep', title: 'PMA Long Course Test Preparation 2026 | PrepForce AI', desc: 'Prepare for Pak Army PMA Long Course Initial Test. Verbal, Non-Verbal, and Academic tests preparation with AI-powered simulators.' },
  { slug: 'pma-verbal-intelligence', exam: 'PMA', type: 'verbal', title: 'PMA Verbal Intelligence Test Preparation MCQs | PrepForce AI', desc: 'Free online PMA Verbal Intelligence Test questions. Solve analogies, series, code-decode, and relationships with explanation.' },
  { slug: 'pma-non-verbal-intelligence', exam: 'PMA', type: 'non-verbal', title: 'PMA Non-Verbal Intelligence Test Practice MCQs | PrepForce AI', desc: 'Practice PMA Non-Verbal Intelligence MCQs. Graphical pattern completion, odd-one-out, and matrix completion tests.' },
  { slug: 'pma-academic-test', exam: 'PMA', type: 'academic', title: 'PMA Academic Test Preparation - General Knowledge & Math | PrepForce AI', desc: 'Prepare for PMA Academic initial test. Interactive questions on English, Math, General Knowledge, Pak Studies, and Islamiat.' },

  { slug: 'pak-army-preparation', exam: 'Army', type: 'prep', title: 'Pakistan Army Initial Test Preparation 2026 | PrepForce AI', desc: 'Pass Pak Army Soldier, Captain, and PMA Initial written test. Complete guide, verbal & non-verbal intelligence tests.' },
  { slug: 'pak-army-test', exam: 'Army', type: 'prep-test', title: 'Pakistan Army Written Test Simulator & Practice | PrepForce AI', desc: 'Simulate Pakistan Army entry and initial tests. Interactive quiz, subject-wise academic tests, and instant results.' },
  { slug: 'pak-army-past-papers', exam: 'Army', type: 'papers', title: 'Pak Army Solved Past Papers & Intelligence MCQs | PrepForce AI', desc: 'Get PDF guides and solved questions from previous Pakistan Army recruitment and PMA entry tests.' },

  { slug: 'pakistan-navy-preparation', exam: 'Navy', type: 'prep', title: 'Pakistan Navy Initial Test Preparation 2026 | PrepForce AI', desc: 'Prepare for Pak Navy Sailor, Cadet, and Officer recruitment tests. Complete academic, intelligence, and mock test guides.' },
  { slug: 'pakistan-navy-test', exam: 'Navy', type: 'prep-test', title: 'Pakistan Navy Online Written Test Simulator | PrepForce AI', desc: 'Take free mock tests for Pakistan Navy initial test. Practice general knowledge, science, mathematics, and English MCQs.' },

  { slug: 'paf-preparation', exam: 'PAF', type: 'prep', title: 'PAF Initial Test & GDP Preparation 2026 | PrepForce AI', desc: 'Pass PAF initial exams for GDP, Aeronautic Engineering, Air Defense, and Admin. Intelligence and physics/math tests.' },
  { slug: 'paf-initial-test', exam: 'PAF', type: 'prep-test', title: 'PAF Initial Test Online Preparation & Pattern | PrepForce AI', desc: 'Prepare for Pakistan Air Force initial written test. Complete exam pattern guide with interactive mock tests.' },
  { slug: 'paf-verbal-intelligence', exam: 'PAF', type: 'verbal', title: 'PAF Verbal Intelligence Test Practice MCQs | PrepForce AI', desc: 'Master PAF verbal intelligence questions. Analogies, classifications, direction sense, and math series.' },

  { slug: 'police-preparation', exam: 'Police', type: 'prep', title: 'Police Constable Written Test Preparation 2026 | PrepForce AI', desc: 'Prepare for Punjab, Sindh, KPK, and Balochistan Police Constable, ASI, and Sub-Inspector written exams.' },
  { slug: 'police-constable-test', exam: 'Police', type: 'prep-test', title: 'Police Constable Online Mock Test & MCQs | PrepForce AI', desc: 'Free practice quiz for police recruitment. Math, Urdu, Pakistan Studies, English, and General Knowledge questions.' },

  { slug: 'anf-preparation', exam: 'ANF', type: 'prep', title: 'ANF Written Test Preparation 2026 - Anti Narcotics | PrepForce AI', desc: 'Study guide for Anti Narcotics Force (ANF) written tests. Practice ASI, Sub-Inspector, and Constable MCQs.' },
  { slug: 'anf-test', exam: 'ANF', type: 'prep-test', title: 'ANF Online Mock Test & Paper Pattern | PrepForce AI', desc: 'Interactive sample test for ANF exams. Practice English, General Knowledge, Law, and Pakistan Studies.' },

  { slug: 'ldc-preparation', exam: 'LDC', type: 'prep', title: 'LDC Test Preparation 2026 - Lower Division Clerk | PrepForce AI', desc: 'Complete study material for Lower Division Clerk (LDC) tests. Solve computer MCQs, typing guidelines, and math tests.' },
  { slug: 'ldc-computer-mcqs', exam: 'LDC', type: 'computer', title: 'LDC Computer & IT MCQs - Online Practice | PrepForce AI', desc: 'Practice MS Office, Windows, Networking, and hardware questions asked in LDC clerk recruitment tests.' },

  { slug: 'udc-preparation', exam: 'UDC', type: 'prep', title: 'UDC Test Preparation 2026 - Upper Division Clerk | PrepForce AI', desc: 'Upper Division Clerk (UDC) exam preparation guide. Practice English, Computer Science, and General Knowledge tests.' },
  { slug: 'udc-computer-mcqs', exam: 'UDC', type: 'computer', title: 'UDC Computer Science & MS Office MCQs | PrepForce AI', desc: 'Solve interactive IT, Microsoft Word, Excel, and keyboard shortcut questions for UDC exams.' },

  { slug: 'mdcat-preparation', exam: 'MDCAT', type: 'prep', title: 'MDCAT Entry Test Preparation 2026 - PMC Syllabus | PrepForce AI', desc: 'Score 180+ in MDCAT with PrepForce AI. Interactive Biology, Chemistry, Physics, and English practice tests.' },
  { slug: 'mdcat-biology-mcqs', exam: 'MDCAT', type: 'biology', title: 'MDCAT Biology MCQs - Dynamic Practice Tests | PrepForce AI', desc: 'Practice high-yield MDCAT Biology questions. Cell structure, genetics, evolution, enzymes, and plant systems.' },
  { slug: 'mdcat-chemistry-mcqs', exam: 'MDCAT', type: 'chemistry', title: 'MDCAT Chemistry MCQs - Organic & Inorganic | PrepForce AI', desc: 'Solve MDCAT Chemistry MCQs. Organic reactions, stoichiometry, chemical equilibrium, and atomic structures.' },
  { slug: 'mdcat-physics-mcqs', exam: 'MDCAT', type: 'physics', title: 'MDCAT Physics MCQs - Core Concepts Quiz | PrepForce AI', desc: 'Master MDCAT Physics. Force & motion, work & energy, electricity, waves, and modern physics MCQs.' },

  { slug: 'ecat-preparation', exam: 'ECAT', type: 'prep', title: 'ECAT Entry Test Preparation 2026 - UET Syllabus | PrepForce AI', desc: 'Prepare for ECAT engineering entry test. Mathematics, Physics, and Chemistry solved MCQs and full simulators.' },
  { slug: 'ecat-mathematics-mcqs', exam: 'ECAT', type: 'math', title: 'ECAT Mathematics MCQs - Algebra & Calculus | PrepForce AI', desc: 'Solve UET ECAT Math questions. Differentiation, integration, matrices, trigonometry, and analytical geometry.' },
  { slug: 'ecat-physics-mcqs', exam: 'ECAT', type: 'physics', title: 'ECAT Physics MCQs - Mechanics & Waves | PrepForce AI', desc: 'Practice engineering entry test physics MCQs. Kinematics, thermodynamics, electrostatics, and magnetism.' },
];

const STATIC_SUBJECTS = [
  { slug: 'english-mcqs', subject: 'English', title: 'English Grammar & Vocabulary MCQs with Answers | PrepForce AI', desc: 'Practice English grammar, synonyms, antonyms, prepositions, active-passive voice, and sentence completion MCQs.' },
  { slug: 'urdu-mcqs', subject: 'Urdu', title: 'Urdu Grammar, Literature & Solved MCQs | PrepForce AI', desc: 'Solve Urdu grammar, vocabulary, proverbs, and poetry questions for competitive and recruitment examinations.' },
  { slug: 'mathematics-mcqs', subject: 'Mathematics', title: 'Basic Mathematics & Quantitative Reasoning MCQs | PrepForce AI', desc: 'Practice math MCQs on algebra, percentage, ratio, average, geometry, and basic arithmetic operations.' },
  { slug: 'physics-mcqs', subject: 'Physics', title: 'General & Conceptual Physics Solved MCQs | PrepForce AI', desc: 'Solve mechanics, thermodynamics, light, sound, waves, electromagnetism, and atomic physics MCQs with explanations.' },
  { slug: 'chemistry-mcqs', subject: 'Chemistry', title: 'Organic, Inorganic & Physical Chemistry MCQs | PrepForce AI', desc: 'Practice basic and advanced chemistry topics, chemical equations, periodic table, and organic compounds.' },
  { slug: 'biology-mcqs', subject: 'Biology', title: 'Biology MCQs - Cell Biology, Genetics & Human Anatomy | PrepForce AI', desc: 'Practice plant biology, human anatomy, genetics, diseases, ecology, and biological classifications.' },
  { slug: 'computer-mcqs', subject: 'Computer', title: 'Computer Science, IT & MS Office MCQs | PrepForce AI', desc: 'Learn MS Word, Excel, PowerPoint, computer hardware, networking, programming concepts, and internet shortcuts.' },
  { slug: 'general-knowledge-mcqs', subject: 'General Knowledge', title: 'General Knowledge (GK) MCQs - Solved PDF Guides | PrepForce AI', desc: 'Master world geography, capitals, currencies, international organizations, history, and important world facts.' },
  { slug: 'current-affairs-mcqs', subject: 'Current Affairs', title: 'Pakistan & Global Current Affairs MCQs 2026 | PrepForce AI', desc: 'Stay updated with monthly national and international current affairs, CPEC, politics, and summit MCQs.' },
  { slug: 'islamic-studies-mcqs', subject: 'Islamic Studies', title: 'Islamic Studies (Islamiat) Solved MCQs | PrepForce AI', desc: 'Learn Quranic knowledge, Hadith, Seerah, Battle of Badr, pillars of Islam, and Islamic history MCQs.' },
  { slug: 'pakistan-studies-mcqs', subject: 'Pakistan Studies', title: 'Pakistan Studies & History Solved MCQs | PrepForce AI', desc: 'Practice pre-partition history, 1947 partition, Pakistan geography, constitution, and historical figures.' },
  { slug: 'intelligence-mcqs', subject: 'Intelligence', title: 'Intelligence Test MCQs - ISSB & Force Entry | PrepForce AI', desc: 'Solve verbal and non-verbal intelligence questions, analogies, direction tests, and mathematical coding.' },
  { slug: 'verbal-intelligence-mcqs', subject: 'Verbal Intelligence', title: 'Verbal Intelligence Test Online Practice MCQs | PrepForce AI', desc: 'Online practice tests for verbal intelligence. Analogies, coding-decoding, logical order, and word series.' },
  { slug: 'non-verbal-intelligence-mcqs', subject: 'Non Verbal Intelligence', title: 'Non-Verbal Intelligence Test - Figure MCQs | PrepForce AI', desc: 'Solve ISSB non-verbal intelligence questions, patterns, matrix completion, rotation, and odd figures.' },
];

const MCQ_CATEGORIES = [
  { slug: 'english-synonyms-mcqs', subject: 'English', match: 'synonym|nearest in meaning|similar', displayName: 'English Synonyms', title: 'English Synonyms MCQs with Answers & Solved Examples | PrepForce AI', desc: 'Practice dynamic English Synonyms MCQs. Solve vocabulary questions, find similar words, and pass written exams.' },
  { slug: 'english-antonyms-mcqs', subject: 'English', match: 'antonym|opposite in meaning', displayName: 'English Antonyms', title: 'English Antonyms MCQs - Practice Solved Vocabulary | PrepForce AI', desc: 'Solve English Antonyms MCQs. Challenge yourself with opposing word meanings and build an elite vocabulary.' },
  { slug: 'english-preposition-mcqs', subject: 'English', match: 'preposition|fill in the blank', displayName: 'English Prepositions', title: 'English Preposition MCQs - Grammar Rules Practice | PrepForce AI', desc: 'Practice preposition MCQs. Understand in, on, at, to, for, and with usage through interactive solved questions.' },
  { slug: 'physics-motion-mcqs', subject: 'Physics', match: 'motion|speed|velocity|acceleration|force|gravity', displayName: 'Physics Force & Motion', title: 'Physics Force & Motion MCQs - Mechanics Quiz | PrepForce AI', desc: 'Solve force, gravity, kinematics, velocity, and acceleration MCQs. Best practice questions for entry tests.' },
  { slug: 'physics-electricity-mcqs', subject: 'Physics', match: 'electricity|charge|current|voltage|resistance|ohm', displayName: 'Physics Electricity & Magnetism', title: 'Physics Electricity & Ohm Law MCQs | PrepForce AI', desc: 'Practice current, voltage, resistance, charge, and magnetism MCQs. Fully updated for MDCAT and ECAT tests.' },
  { slug: 'chemistry-organic-mcqs', subject: 'Chemistry', match: 'organic|carbon|alkane|alkene|alcohol|ester', displayName: 'Organic Chemistry', title: 'Organic Chemistry Solved MCQs - Carbon Compounds | PrepForce AI', desc: 'Master organic chemistry reactions, hydrocarbons, alkanes, alcohol, and carbon compound MCQs.' },
  { slug: 'biology-genetics-mcqs', subject: 'Biology', match: 'genetics|genetic|dna|rna|gene|chromosome', displayName: 'Biology Genetics & DNA', title: 'Biology Genetics, DNA & Chromosomes MCQs | PrepForce AI', desc: 'Solve DNA replication, genetics, chromosomes, genes, and inherited traits biological MCQs.' },
  { slug: 'computer-ms-word-mcqs', subject: 'Computer', match: 'word|ms word|document|font|paragraph', displayName: 'Microsoft Word Office', title: 'MS Word MCQs - Keyboard Shortcuts & Document Formatting | PrepForce AI', desc: 'Practice Microsoft Word shortcuts, formatting options, menus, and document layout MCQs.' },
  { slug: 'computer-excel-mcqs', subject: 'Computer', match: 'excel|spreadsheet|sheet|cell|formula', displayName: 'Microsoft Excel Spreadsheets', title: 'MS Excel Formulas, Shortcuts & Spreadsheet MCQs | PrepForce AI', desc: 'Solve MS Excel cell, formula, sum, average, vlookup, and spreadsheet keyboard shortcut MCQs.' },
  { slug: 'current-affairs-pakistan-mcqs', subject: 'Current Affairs', match: 'pakistan|pm|president|cpec|minister', displayName: 'Pakistan Current Affairs', title: 'Pakistan Current Affairs MCQs 2026 - Solved Updates | PrepForce AI', desc: 'Practice Pakistan-related current affairs, cabinet ministers, CPEC developments, and geopolitical MCQs.' },
];

const STATIC_LOCATIONS = ['lahore', 'karachi', 'islamabad', 'rawalpindi', 'faisalabad'];
const STATIC_LOCATION_EXAMS = ['asf', 'fia', 'mdcat', 'ecat'];

const STATIC_BLOGS = [
  { slug: 'how-to-pass-asf-test', exam: 'ASF', title: 'How to Pass ASF Written Test 2026 - Comprehensive Guide | PrepForce AI', desc: 'Pass the Airport Security Force (ASF) written test with our ultimate guide. Syllabus breakdown, past papers, and study tips.', body: 'Preparing for the Airport Security Force (ASF) written test requires a focused approach. This exam typically covers English grammar, General Knowledge, Pakistan Studies, Islamic Studies, and basic computer applications. To succeed, students must practice mock test questions, solve past exam papers, and maintain structured study routines. Learn the ASI and Constable test patterns, time-management tips, and utilize PrepForce AI simulator mock exams to check your performance.' },
  { slug: 'fia-syllabus-guide', exam: 'FIA', title: 'FIA Syllabus Guide 2026 - Complete Preparation Plan | PrepForce AI', desc: 'Detailed FIA syllabus breakdown, marks distribution, and paper pattern for ASI, Constable, and SI posts.', body: 'The Federal Investigation Agency (FIA) written test is highly competitive. The syllabus contains General Knowledge (20%), Pakistan Studies & Islamiat (20%), English (20%), Computer Science & IT (20%), and Everyday Science (20%). This guide offers a subject-wise prep plan. Practice computer shortcuts, everyday science formulas, and history timelines. Read our solved past papers and register for our full simulator mock exams to guarantee top scores.' },
  { slug: 'pma-verbal-intelligence-guide', exam: 'PMA', title: 'Mastering PMA Verbal Intelligence Tests - Full Tips & MCQs | PrepForce AI', desc: 'Learn how to solve PMA verbal intelligence questions like analogies, sequence coding, and relationships.', body: 'Verbal intelligence tests are the first hurdle in the PMA Long Course Initial Test. Candidates are tested on their mental speed and logical reasoning. Topics include number series, coding-decoding, age calculations, directions, and word analogies. You must solve 84 questions in 30 minutes! Speed is key. This guide breaks down common shortcuts and tricks. Solve our online verbal quiz sets to build speed and accuracy.' },
  { slug: 'paf-initial-test-pattern', exam: 'PAF', type: 'PMA', title: 'PAF Initial Test Pattern & Syllabus Guide 2026 | PrepForce AI', desc: 'Pass the PAF GDP and Engineering initial written tests. Complete pattern guide and practice questions.', body: 'The Pakistan Air Force (PAF) initial test determines your eligibility to join the cadet academy. The written exam comprises Intelligence tests (Verbal & Non-Verbal) and Academic tests (Physics, Mathematics, and English). Candidates must pass each section individually. This article details the weightage of each chapter, tips for conceptual physics problems, and basic calculus rules. Take our free interactive PAF tests to check your preparation level.' },
  { slug: 'navy-recruitment-guide', exam: 'Navy', title: 'Pakistan Navy Recruitment Test Guide - Sailor & Officer | PrepForce AI', desc: 'Pass the Pak Navy Cadet and Sailor recruitment written tests. Full syllabus and solved past papers.', body: 'Joining the Pakistan Navy is a dream for many. The Navy initial recruitment test consists of intelligence tests followed by academic subjects (English, General Knowledge, Math, and Chemistry/Physics). Practice our timed Navy tests to build speed. This article guides you through physical tests, initial interview patterns, and solved academic MCQs to help you secure a position in the naval force.' },
  { slug: 'police-test-preparation-guide', exam: 'Police', title: 'Police Constable Written Test Preparation Guide | PrepForce AI', desc: 'How to prepare for Police Constable and ASI recruitment written exams. Solved MCQs and syllabus.', body: 'Police recruitment tests in Pakistan check basic aptitude, Urdu/English language skills, mathematics, and Pakistan general knowledge. With our comprehensive guide, learn exactly which chapters are important. Practice translation, basic percentage math, and general knowledge timelines. Take police mock tests online and analyze your score to secure your badge.' },
  { slug: 'mdcat-complete-guide', exam: 'MDCAT', title: 'MDCAT Complete Guide 2026 - Biology, Physics, Chemistry | PrepForce AI', desc: 'Pass MDCAT with 180+ marks. Ultimate preparation strategy, high-yield chapters, and free mock tests.', body: 'MDCAT (Medical & Dental College Admission Test) requires high precision. The paper comprises Biology (34%), Chemistry (27%), Physics (27%), English (10%), and Logical Reasoning (2%). High-yield biology chapters include Cell Structure, Genetics, and Bioenergetics. Chemistry organic equations are critical. This guide provides a full outline of PMC test rules, study timelines, and provides free MDCAT interactive quizzes.' },
  { slug: 'ecat-complete-guide', exam: 'ECAT', title: 'ECAT Complete Guide & Strategy - UET Entry Test | PrepForce AI', desc: 'UET ECAT entry test complete guide. Important chapters, marks distribution, and mathematics formulas.', body: 'The Engineering College Admission Test (ECAT) is crucial for securing entry into top public universities like UET. The paper is highly mathematical and tests analytical physics concepts. Focus on Integration, Conic Sections, Electrostatics, and Mechanics. Learn calculators tricks, past paper patterns, and practice full ECAT simulator tests to test your analytical speed.' }
];

// Helper: Normalize name to match DB subject casing
function getDbSubject(sub) {
  const norm = sub.toLowerCase();
  if (norm === 'biology') return 'Biology';
  if (norm === 'chemistry') return 'Chemistry';
  if (norm === 'computer' || norm === 'computer science') return 'Computer';
  if (norm === 'current affairs') return 'Current Affairs';
  if (norm === 'english') return 'English';
  if (norm === 'gk' || norm === 'general knowledge') return 'General Knowledge';
  if (norm === 'intelligence') return 'Intelligence';
  if (norm === 'islamic studies') return 'Islamic Studies';
  if (norm === 'mathematics' || norm === 'math') return 'Mathematics';
  if (norm === 'non verbal intelligence') return 'Non Verbal Intelligence';
  if (norm === 'pakistan studies') return 'Pakistan Studies';
  if (norm === 'physics') return 'Physics';
  if (norm === 'urdu') return 'Urdu';
  if (norm === 'verbal intelligence') return 'Verbal Intelligence';
  return 'General Knowledge';
}

// Helper: Capitalize
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Dynamic sitemap generator
exports.getSitemap = async (req, res) => {
  try {
    const host = req.get('host') || 'prepforceai.com';
    const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;

    let urls = [];

    // 1. Homepage
    urls.push(`<url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`);
    urls.push(`<url><loc>${baseUrl}/login</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>`);
    urls.push(`<url><loc>${baseUrl}/register</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>`);

    // 2. Static exam pages
    STATIC_EXAMS.forEach(e => {
      urls.push(`<url><loc>${baseUrl}/${e.slug}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`);
    });

    // 3. Static subject pages
    STATIC_SUBJECTS.forEach(s => {
      urls.push(`<url><loc>${baseUrl}/${s.slug}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`);
    });

    // 4. MCQ Categories
    MCQ_CATEGORIES.forEach(c => {
      urls.push(`<url><loc>${baseUrl}/${c.slug}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`);
    });

    // 5. Blogs
    STATIC_BLOGS.forEach(b => {
      urls.push(`<url><loc>${baseUrl}/blog/${b.slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
    });

    // 6. Location pages
    STATIC_LOCATION_EXAMS.forEach(exam => {
      STATIC_LOCATIONS.forEach(loc => {
        urls.push(`<url><loc>${baseUrl}/${exam}-preparation-${loc}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`);
      });
    });

    // Compile XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    res.header('Content-Type', 'application/xml');
    return res.status(200).send(sitemap);
  } catch (err) {
    console.error('Sitemap generation error:', err);
    return res.status(500).send('Error generating sitemap');
  }
};

// Retrieve SEO page content dynamically
exports.getSeoContent = async (req, res) => {
  const { slug } = req.params;
  try {
    let pageData = null;
    let queryFilter = { isActive: true };

    // --- CASE 1: Blog pages ---
    if (req.route.path.includes('/blog/')) {
      const blog = STATIC_BLOGS.find(b => b.slug === slug);
      if (!blog) {
        return res.status(404).json({ success: false, message: 'Blog article not found' });
      }

      // Query questions matching the blog's exam focus to show as recommendations
      const examNameRegex = new RegExp(blog.exam, 'i');
      const sampleQuestions = await Question.find({
        isActive: true,
        $or: [{ examName: examNameRegex }, { subject: examNameRegex }]
      }).limit(5).select('text options correctOptionIndex subject');

      const internalLinks = STATIC_EXAMS
        .filter(e => e.exam === blog.exam)
        .map(e => ({ label: e.title.split('|')[0].trim(), slug: e.slug }));

      return res.json({
        success: true,
        type: 'blog',
        title: blog.title,
        metaDescription: blog.desc,
        keywords: `${blog.exam} Guide, ${blog.exam} Prep, ${blog.exam} Past Papers`,
        h1: blog.title.split(' - ')[0],
        body: blog.body,
        exam: blog.exam,
        questions: sampleQuestions,
        breadcrumbs: [
          { label: 'Home', path: '/' },
          { label: 'Blog', path: '/blog/' + slug }
        ],
        internalLinks,
        schema: {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": blog.title,
          "description": blog.desc,
          "articleBody": blog.body,
          "author": {
            "@type": "Organization",
            "name": "PrepForce AI"
          }
        }
      });
    }

    // --- CASE 2: Location Pages ---
    // Match: e.g. "asf-preparation-lahore"
    const locationMatch = slug.match(/^([a-z\-]+)-preparation-([a-z]+)$/i);
    if (locationMatch) {
      const examAbbrev = locationMatch[1].toUpperCase();
      const city = capitalize(locationMatch[2]);
      
      const title = `${examAbbrev} Test Preparation Classes in ${city} | PrepForce AI`;
      const desc = `Join the best ${examAbbrev} preparation academy in ${city}. Solve online simulated exams, past papers, and verbal/non-verbal reasoning questions.`;
      
      // Pull questions for this exam
      const examRegex = new RegExp(examAbbrev, 'i');
      const questions = await Question.find({
        isActive: true,
        $or: [{ examName: examRegex }, { subject: examRegex }]
      }).limit(10).select('text options correctOptionIndex subject');

      const internalLinks = STATIC_LOCATIONS
        .filter(loc => loc !== locationMatch[2])
        .map(loc => ({
          label: `${examAbbrev} Prep in ${capitalize(loc)}`,
          slug: `${locationMatch[1]}-preparation-${loc}`
        }));

      return res.json({
        success: true,
        type: 'location',
        title,
        metaDescription: desc,
        keywords: `${examAbbrev} ${city}, ${examAbbrev} Preparation ${city}, ${examAbbrev} Academy ${city}`,
        h1: `${examAbbrev} Exam Preparation Center in ${city}`,
        exam: examAbbrev,
        city,
        questions,
        breadcrumbs: [
          { label: 'Home', path: '/' },
          { label: `${examAbbrev} Preparation`, path: `/${locationMatch[1]}-preparation` },
          { label: city, path: '/' + slug }
        ],
        internalLinks,
        schema: {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": `PrepForce AI ${examAbbrev} Center ${city}`,
          "description": desc,
          "address": {
            "@type": "PostalAddress",
            "addressLocality": city,
            "addressCountry": "PK"
          }
        }
      });
    }

    // --- CASE 3: Category MCQs ---
    // Match: e.g. "english-synonyms-mcqs"
    const categoryPage = MCQ_CATEGORIES.find(c => c.slug === slug);
    if (categoryPage) {
      const dbSubjectName = getDbSubject(categoryPage.subject);
      const matchRegex = new RegExp(categoryPage.match, 'i');

      const questions = await Question.find({
        isActive: true,
        subject: dbSubjectName,
        text: { $regex: matchRegex }
      }).limit(15).select('text options correctOptionIndex subject');

      // Related category links
      const internalLinks = MCQ_CATEGORIES
        .filter(c => c.subject === categoryPage.subject && c.slug !== slug)
        .map(c => ({ label: c.displayName + ' MCQs', slug: c.slug }));

      return res.json({
        success: true,
        type: 'category',
        title: categoryPage.title,
        metaDescription: categoryPage.desc,
        keywords: `${categoryPage.displayName}, ${categoryPage.displayName} MCQs, ${categoryPage.subject} Solved Questions`,
        h1: `${categoryPage.displayName} Solved MCQs`,
        subject: categoryPage.subject,
        questions,
        breadcrumbs: [
          { label: 'Home', path: '/' },
          { label: `${categoryPage.subject} MCQs`, path: `/${categoryPage.subject.toLowerCase()}-mcqs` },
          { label: categoryPage.displayName, path: '/' + slug }
        ],
        internalLinks,
        schema: {
          "@context": "https://schema.org",
          "@type": "Quiz",
          "name": categoryPage.displayName + " practice test",
          "description": categoryPage.desc
        }
      });
    }

    // --- CASE 4: Subject MCQs ---
    // Match: e.g. "english-mcqs"
    const subjectPage = STATIC_SUBJECTS.find(s => s.slug === slug);
    if (subjectPage) {
      const dbSubjectName = getDbSubject(subjectPage.subject);
      const questions = await Question.find({
        isActive: true,
        subject: dbSubjectName
      }).limit(15).select('text options correctOptionIndex subject');

      // Add links to specific categories for this subject
      const internalLinks = MCQ_CATEGORIES
        .filter(c => c.subject === subjectPage.subject)
        .map(c => ({ label: c.displayName + ' MCQs', slug: c.slug }));

      return res.json({
        success: true,
        type: 'subject',
        title: subjectPage.title,
        metaDescription: subjectPage.desc,
        keywords: `${subjectPage.subject} MCQs, ${subjectPage.subject} Exam Practice, Solved ${subjectPage.subject} Questions`,
        h1: `${subjectPage.subject} Solved MCQs & Online Tests`,
        subject: subjectPage.subject,
        questions,
        breadcrumbs: [
          { label: 'Home', path: '/' },
          { label: subjectPage.subject, path: '/' + slug }
        ],
        internalLinks,
        schema: {
          "@context": "https://schema.org",
          "@type": "Quiz",
          "name": `${subjectPage.subject} solved tests`,
          "description": subjectPage.desc
        }
      });
    }

    // --- CASE 5: Exam SEO Pages ---
    // Match: e.g. "asf-preparation"
    const examPage = STATIC_EXAMS.find(e => e.slug === slug);
    if (examPage) {
      const examNameRegex = new RegExp(examPage.exam, 'i');
      const questions = await Question.find({
        isActive: true,
        $or: [{ examName: examNameRegex }, { subject: examNameRegex }]
      }).limit(15).select('text options correctOptionIndex subject');

      // Related exam links
      const internalLinks = STATIC_EXAMS
        .filter(e => e.exam === examPage.exam && e.slug !== slug)
        .map(e => ({ label: e.title.split('|')[0].trim(), slug: e.slug }));

      return res.json({
        success: true,
        type: 'exam',
        title: examPage.title,
        metaDescription: examPage.desc,
        keywords: `${examPage.exam} Preparation, ${examPage.exam} Written Test, ${examPage.exam} Syllabus`,
        h1: `${examPage.exam} Test Preparation & Simulator 2026`,
        examName: examPage.exam,
        examType: examPage.type,
        questions,
        breadcrumbs: [
          { label: 'Home', path: '/' },
          { label: examPage.exam, path: '/' + slug }
        ],
        internalLinks,
        schema: {
          "@context": "https://schema.org",
          "@type": "EducationalOccupationalCredential",
          "name": `${examPage.exam} Exam Preparation`,
          "description": examPage.desc
        }
      });
    }

    // Fallback: If nothing matches
    return res.status(404).json({ success: false, message: 'Resource not found' });
  } catch (err) {
    console.error('SEO page load error:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
