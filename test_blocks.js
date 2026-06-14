const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const mcqParser = require('./src/utils/mcqParser');

const pdfPath = 'C:\\Users\\5500\\Downloads\\biology_500_mcqs_clean.pdf';
const buffer = fs.readFileSync(pdfPath);

async function run() {
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();

  const rawText = parsed.text || '';
  const cleanedText = mcqParser.cleanTextForParsing(rawText);
  
  // Show first 1500 chars of cleaned text
  console.log('--- CLEANED TEXT (first 1500 chars) ---');
  console.log(JSON.stringify(cleanedText.substring(0, 1500)));

  // Manually split into blocks like the parser does
  const blockSplitRegex = /(?:^|\n)(?=\s*(?:Q(?:uestion)?\s*\d+|\d+)\s*[\.:\)\]\–\-\s])/gi;
  const rawBlocks = cleanedText.split(blockSplitRegex);
  
  console.log('\n--- First 4 raw blocks (after split) ---');
  rawBlocks.slice(0, 5).forEach((block, i) => {
    console.log(`\nBlock ${i}:`);
    console.log(JSON.stringify(block.trim()));
  });
}

run().catch(console.error);
