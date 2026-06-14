const fs = require('fs');
const path = require('path');

const loadPdfJs = () => {
  try {
    return require('pdfjs-dist/legacy/build/pdf.js');
  } catch (err) {
    console.warn('pdfjs-dist unavailable:', err.message);
    return null;
  }
};

const pdfParse = async (buffer) => {
  const pdfjsLib = loadPdfJs();
  if (!pdfjsLib) {
    throw new Error('pdfjs-dist is unavailable in this environment');
  }

  try {
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdfDocument = await loadingTask.promise;
    let text = '';

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(' ');
      text += pageText + '\n';
    }

    return {
      text,
      numpages: pdfDocument.numPages,
    };
  } catch (err) {
    console.warn('pdfjs-dist runtime error:', err.message);
    throw new Error('pdf parsing failed: ' + err.message);
  }
};

module.exports = {
  pdfParse,
};
