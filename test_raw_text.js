const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const pdfPath = 'C:\\Users\\5500\\Downloads\\biology_500_mcqs_clean.pdf';
const buffer = fs.readFileSync(pdfPath);

async function run() {
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();

  const text = parsed.text || '';
  console.log('Total chars extracted:', text.length);
  console.log('\n--- FIRST 2000 CHARS OF RAW TEXT ---');
  console.log(JSON.stringify(text.substring(0, 2000)));
  
  // Find every line that contains "Answer"
  const lines = text.split('\n');
  console.log('\n--- Lines containing "Answer" (first 20) ---');
  let count = 0;
  for (let i = 0; i < lines.length && count < 20; i++) {
    if (/answer/i.test(lines[i])) {
      console.log(`Line ${i}: ${JSON.stringify(lines[i])}`);
      count++;
    }
  }

  // Show raw chars around Q1 answer
  const q1Idx = text.indexOf('Mitochondria');
  if (q1Idx !== -1) {
    console.log('\n--- 400 chars around Q1 "Mitochondria" ---');
    console.log(JSON.stringify(text.substring(q1Idx - 50, q1Idx + 350)));
  }
}

run().catch(console.error);
