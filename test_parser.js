const mcqParser = require('./src/utils/mcqParser');

const text = `1. Which organelle is known as the powerhouse of the cell?
A) Mitochondria
B) Nucleus
C) Ribosome
D) Golgi apparatus
Answer: A
2. What is the primary pigment used by plants to absorb light during photosynthesis?
A) Carotenoid
B) Phycobilin
C) Hemoglobin
D) Chlorophyll
Answer: D
3. Which macromolecule is primarily responsible for storing genetic information?
A) Protein
B) Carbohydrate
C) DNA
D) RNA
Answer: C
4. What is the basic structural and functional unit of all living organisms?
A) Atom
B) Cell
C) Tissue
D) Organ
Answer: B

500 Premium Biology MCQ Test Bank Page 1 of 125

5. Which human organ system is responsible for pumping blood throughout the body?
A) Circulatory system
B) Respiratory system
C) Digestive system
D) Nervous system
Answer: A`;

console.log('=== RAW TEXT LINES (first 20) ===');
const lines = text.split('\n');
lines.slice(0, 20).forEach((l, i) => console.log(i, JSON.stringify(l)));

const cleaned = mcqParser.cleanTextForParsing(text);
console.log('\n=== CLEANED TEXT LINES (first 20) ===');
const cleanedLines = cleaned.split('\n');
cleanedLines.slice(0, 20).forEach((l, i) => console.log(i, JSON.stringify(l)));

const results = mcqParser.parseMCQs(cleaned);
console.log('\n=== RESULTS ===');
console.log('Total parsed:', results.length);
results.forEach((q, i) => {
  console.log(`Q${i+1}: ${JSON.stringify({
    text: q.text,
    options: q.options,
    correctOptionIndex: q.correctOptionIndex
  })}`);
});
