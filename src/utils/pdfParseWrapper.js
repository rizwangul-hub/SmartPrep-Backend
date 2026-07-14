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

const loadCanvas = () => {
  try {
    const { createCanvas } = require('canvas');
    return { createCanvas };
  } catch (err) {
    console.warn('canvas unavailable:', err.message);
    return null;
  }
};

class NodeCanvasFactory {
  constructor(createCanvas) {
    this.createCanvas = createCanvas;
  }

  create(width, height) {
    const canvas = this.createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
    return { canvas: canvasAndContext.canvas, context: canvasAndContext.context };
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

const pdfParse = async (buffer) => {
  const pdfjsLib = loadPdfJs();
  if (!pdfjsLib) {
    throw new Error('pdfjs-dist is unavailable in this environment');
  }

  try {
    // pdfjs expects binary data as Uint8Array. Convert Node Buffer if necessary.
    let data = buffer;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) {
      data = new Uint8Array(buffer);
    }

    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.entry');
      } catch (workerErr) {
        // Worker entry may not be required in this environment.
      }
    }

    const loadingTask = pdfjsLib.getDocument({ data });
    const pdfDocument = await loadingTask.promise;
    let text = '';

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const content = await page.getTextContent({ normalizeWhitespace: true });
      
      const items = content.items;
      const linesMap = {};
      const tolerance = 4; // Group items within 4 points of Y-coordinate tolerance
      
      for (const item of items) {
        // transform[5] is Y-coordinate (bottom-to-top), transform[4] is X-coordinate (left-to-right)
        const x = item.transform[4];
        const y = item.transform[5];
        
        let foundKey = null;
        for (const keyStr of Object.keys(linesMap)) {
          if (Math.abs(parseFloat(keyStr) - y) <= tolerance) {
            foundKey = keyStr;
            break;
          }
        }
        
        if (foundKey !== null) {
          linesMap[foundKey].push({ text: item.str, x });
        } else {
          linesMap[String(y)] = [{ text: item.str, x }];
        }
      }
      
      // Sort lines by Y descending (top of page to bottom)
      const sortedYKeys = Object.keys(linesMap).map(Number).sort((a, b) => b - a);
      
      let pageText = '';
      for (const yKey of sortedYKeys) {
        // Sort items on this line by X ascending (left to right)
        const lineItems = linesMap[String(yKey)].sort((a, b) => a.x - b.x);
        pageText += lineItems.map(item => item.text).join(' ') + '\n';
      }
      
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

const renderPdfPagesToPngs = async (buffer, options = {}) => {
  const pdfjsLib = loadPdfJs();
  if (!pdfjsLib) {
    console.warn('Cannot render PDF pages: pdfjs-dist unavailable.');
    return [];
  }

  const canvasLib = loadCanvas();
  if (!canvasLib || !canvasLib.createCanvas) {
    console.warn('Cannot render PDF pages: canvas unavailable. Install the `canvas` package.');
    return [];
  }

  try {
    if (pdfjsLib.GlobalWorkerOptions) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.entry');
      } catch (workerErr) {
        // Worker entry may not be required in this environment.
      }
    }

    const data = Buffer.isBuffer(buffer) ? new Uint8Array(buffer) : buffer;
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdfDocument = await loadingTask.promise;

    const maxPages = options.maxPages || Math.min(pdfDocument.numPages, 5);
    const scale = options.scale || 1.5;
    const factory = new NodeCanvasFactory(canvasLib.createCanvas);
    const images = [];

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvasAndContext = factory.create(viewport.width, viewport.height);
      const renderContext = {
        canvasContext: canvasAndContext.context,
        viewport,
        canvasFactory: factory,
      };
      await page.render(renderContext).promise;
      images.push(canvasAndContext.canvas.toBuffer('image/png'));
      factory.destroy(canvasAndContext);
    }

    return images;
  } catch (err) {
    console.warn('pdf render failed:', err.message);
    return [];
  }
};

module.exports = {
  pdfParse,
  renderPdfPagesToPngs,
};
