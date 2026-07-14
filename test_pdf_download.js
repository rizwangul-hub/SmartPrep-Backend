const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Resolve pdfParse from the backend utilities
const { pdfParse } = require('./src/utils/pdfParseWrapper.js');

async function main() {
  const url = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
  console.log('Downloading sample PDF from:', url);
  
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    console.log('Downloaded. Buffer size:', buffer.length);
    
    console.log('Running pdfParse...');
    const result = await pdfParse(buffer);
    console.log('Extraction success! Result keys:', Object.keys(result));
    console.log('Page count:', result.numpages);
    console.log('Extracted text:', JSON.stringify(result.text));
  } catch (err) {
    console.error('An error occurred during test:', err);
  }
}

main();
