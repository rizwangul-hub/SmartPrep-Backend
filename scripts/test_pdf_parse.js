const fs = require('fs');
const path = require('path');
const { pdfParse } = require('../src/utils/pdfParseWrapper');

function extractJpegsFromPdf(buffer) {
  const jpegs = [];
  let pos = 0;
  while (true) {
    const subtypeIdx = buffer.indexOf('/Subtype', pos);
    if (subtypeIdx === -1) break;
    pos = subtypeIdx + 8;

    const nextSlice = buffer.slice(subtypeIdx, subtypeIdx + 50).toString('ascii');
    if (!nextSlice.match(/\/Subtype\s*\/Image/)) {
      continue;
    }

    const streamIdx = buffer.indexOf('stream', subtypeIdx);
    if (streamIdx === -1) continue;

    const endstreamIdx = buffer.indexOf('endstream', streamIdx);
    if (endstreamIdx === -1) continue;

    let streamStart = streamIdx + 6;
    if (buffer[streamStart] === 13 && buffer[streamStart + 1] === 10) {
      streamStart += 2;
    } else if (buffer[streamStart] === 10) {
      streamStart += 1;
    }

    const dictStart = buffer.lastIndexOf('<<', subtypeIdx);
    const dictEnd = buffer.indexOf('>>', subtypeIdx);
    if (dictStart !== -1 && dictEnd !== -1 && dictStart < streamIdx) {
      const dictText = buffer.slice(dictStart, dictEnd).toString('ascii');
      if (dictText.includes('/DCTDecode') || dictText.includes('/DCT')) {
        const imgBuffer = buffer.slice(streamStart, endstreamIdx);
        jpegs.push(imgBuffer);
      }
    }
    pos = endstreamIdx + 9;
  }
  return jpegs;
}

async function run(filePath) {
  try {
    const abs = path.resolve(filePath);
    console.log('Reading', abs);
    const buffer = fs.readFileSync(abs);

    console.log('Calling pdfParse...');
    try {
      const parsed = await pdfParse(buffer);
      console.log('Pages:', parsed.numpages);
      const snippet = (parsed.text || '').slice(0, 2000);
      console.log('Extracted text snippet (first 2000 chars):\n');
      console.log(snippet || '[no text]');
    } catch (err) {
      console.error('pdfParse error:', err.message);
    }

    console.log('\nSearching for embedded JPEG streams...');
    const jpegs = extractJpegsFromPdf(buffer);
    console.log('Embedded JPEG count:', jpegs.length);
    if (jpegs.length > 0) {
      const outDir = path.join(__dirname, 'pdf_jpegs');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
      jpegs.forEach((b, i) => {
        const outPath = path.join(outDir, `img_${i + 1}.jpg`);
        fs.writeFileSync(outPath, b);
        console.log('Wrote', outPath);
      });
    }

    console.log('\nDone.');
  } catch (err) {
    console.error('Fatal error:', err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  const fp = process.argv[2];
  if (!fp) {
    console.error('Usage: node test_pdf_parse.js <path-to-pdf>');
    process.exit(2);
  }
  run(fp);
}
