// Quick test: parse biology PDF and check correctOptionIndex
const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const mcqParser = require('./src/utils/mcqParser');

// Inline subject keyword check (matches controller logic)
const BIOLOGY_KEYWORDS = [
  "cell","dna","rna","enzyme","genetics","genetic","photosynthesis","respiration",
  "chromosome","organelle","organism","living","protein","hormone","blood","mitosis",
  "meiosis","ecosystem","bacteria","virus","nucleus","mitochondria","ribosome",
  "membrane","chloroplast","chlorophyll","pigment","macromolecule","carbohydrate",
  "lipid","nucleic acid","amino acid","evolution","tissue","organ","plant","animal",
  "reproduction","digestion","nervous system","neuron","mutation","osmosis","diffusion",
  "transpiration","stomata","xylem","phloem","algae","fungi","ecology","zoology",
  "botany","anatomy","physiology","biochemistry","structural unit","functional unit","powerhouse"
];

function classifyBiology(text) {
  const lower = text.toLowerCase();
  const matches = BIOLOGY_KEYWORDS.filter(kw => lower.includes(kw));
  return matches.length;
}

const pdfPath = 'C:\\Users\\5500\\Downloads\\biology_500_mcqs_clean.pdf';
const buffer = fs.readFileSync(pdfPath);

async function run() {
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();

  const cleanedText = mcqParser.cleanTextForParsing(parsed.text || '');
  const questions = mcqParser.parseMCQs(cleanedText);

  let validCount = 0;
  let invalidCount = 0;
  let missingAnswer = 0;
  let biologyCount = 0;

  for (const q of questions) {
    const hasAnswer = q.correctOptionIndex >= 0 && q.correctOptionIndex <= 3;
    const hasAllOptions = q.options.filter(o => o.length > 0).length === 4;
    
    if (hasAnswer && hasAllOptions) validCount++;
    else {
      invalidCount++;
      if (!hasAnswer) missingAnswer++;
    }
    
    if (classifyBiology(q.text) > 0) biologyCount++;
  }

  console.log('\n=== FINAL PIPELINE RESULTS ===');
  console.log(`Total parsed: ${questions.length}`);
  console.log(`✅ Valid (has answer + 4 options): ${validCount}`);
  console.log(`❌ Invalid: ${invalidCount}`);
  console.log(`   - Missing answer: ${missingAnswer}`);
  console.log(`🧬 Classified as Biology: ${biologyCount}`);
  
  console.log('\n--- First 5 questions ---');
  questions.slice(0, 5).forEach((q, i) => {
    console.log(`Q${i+1}: "${q.text.substring(0,60)}..."`);
    console.log(`     correctOptionIndex=${q.correctOptionIndex} | options=${q.options.filter(o=>o).length}`);
  });
}

run().catch(console.error);
