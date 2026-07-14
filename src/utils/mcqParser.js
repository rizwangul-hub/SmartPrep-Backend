// backend/src/utils/mcqParser.js  – v3 (robust multi-format parser)

/**
 * Remove question number prefixes like "1.", "Q1.", "Question 1:", etc.
 */
function cleanQuestionText(text) {
  return text
    .replace(/^\s*(?:Q(?:uestion)?\s*\d+|\d+)\s*[:\.\)\]–\-]?\s+/i, "")
    .trim();
}

/**
 * Trim whitespace from option text.
 */
function cleanOption(str) {
  return (str || "").replace(/^\s+|\s+$/g, "").trim();
}

/**
 * Splits text into the main body and a separate answer-key section (if found).
 * Only splits if the answer-key heading is found past 30% of the document.
 */
function extractAnswerKeySection(text) {
  const headingPatterns = [
    /ANSWER\s*KEY/i,
    /ANSWERS\s*SHEET/i,
    /CORRECT\s*ANSWERS?/i,
    /KEY\s*ANSWERS?/i,
    /^ANSWERS\s*$/im,
  ];

  let foundIndex = -1;
  let headingLength = 0;
  for (const regex of headingPatterns) {
    const match = text.match(regex);
    if (match && match.index > text.length * 0.30) {
      if (match.index > foundIndex) {
        foundIndex = match.index;
        headingLength = match[0].length;
      }
    }
  }

  if (foundIndex !== -1) {
    return {
      mainText: text.substring(0, foundIndex),
      answerKeyText: text.substring(foundIndex + headingLength),
    };
  }
  return { mainText: text, answerKeyText: "" };
}

/**
 * Parse a separate answer-key block like:
 *   1-B  2. A  3: D  [4] C  Q5: (A)  1.A  1)B
 */
function parseAnswerKey(text) {
  const answerMap = {};
  if (!text) return answerMap;

  const pattern = /\b(?:Q\s*)?(\d+)[^\S\n]*[-:\.\)\]]*[^\S\n]+\(?([A-D1-4a-d])\)?/gi;
  let match;
  let count = 0;
  while ((match = pattern.exec(text)) !== null) {
    answerMap[match[1]] = match[2].toUpperCase();
    count++;
  }

  if (count >= 5) return answerMap;

  // Sequential fallback: just letters in order
  const letters = [];
  const lp = /\b([A-D])\b/gi;
  let lm;
  while ((lm = lp.exec(text)) !== null) letters.push(lm[1].toUpperCase());
  if (letters.length >= 5) {
    letters.forEach((l, i) => { answerMap[String(i + 1)] = l; });
  }
  return answerMap;
}

/**
 * Convert answer letter/number to 0-based index.
 */
function letterToIndex(char) {
  const c = char.toUpperCase();
  if (c === "A" || c === "1") return 0;
  if (c === "B" || c === "2") return 1;
  if (c === "C" || c === "3") return 2;
  if (c === "D" || c === "4") return 3;
  return -1;
}

/**
 * Core line-by-line parser for a single MCQ block.
 * Handles all known formats:
 *   A) text   A. text   (A) text   [A] text   A- text
 *   Answer: A  /  Ans: B  /  Correct Answer: C
 */
function parseBlock(block) {
  // Regexes for option lines (anchored to start of line)
  const OPTION_LINE = /^([A-D1-4a-d])\s*[\.\)\]\-\–]?\s+(.+)$/i;
  const PAREN_OPTION = /^\(([A-D1-4a-d])\)\s+(.+)$/i;
  const BRACKET_OPTION = /^\[([A-D1-4a-d])\]\s+(.+)$/i;

  // Answer marker (updated to support optional checkmark and trailing text/answers)
  const ANSWER_PATTERN = /^(?:✓\s*)?(?:Answer|Correct\s*Choice\s*Answer|Correct\s*Choice|Correct\s*Answer|Correct\s*Option|Ans(?:wer)?|Key|Correct)\s*[:=\-–]?\s*(.+)$/i;
  const INLINE_ANSWER_PATTERN = /(.*?)\s+(?:✓\s*)?(?:Answer|Correct\s*Choice\s*Answer|Correct\s*Choice|Correct\s*Answer|Correct\s*Option|Ans(?:wer)?|Key|Correct)\s*[:=\-–]?\s*(.+)$/i;

  const lines = block.split("\n").map(l => l.trim()).filter(Boolean);

  const qTextLines = [];
  const options = ["", "", "", ""];  // indexed 0=A, 1=B, 2=C, 3=D
  let extractedAnswerString = "";
  let inOptions = false;
  let isFirstLine = true;
  let hasFoundAnswer = false;

  for (const line of lines) {
      if (hasFoundAnswer) continue;

      // Split inline answer marker if it occurs on the same line as an option or text.
      let sourceLine = line;
      const inlineAnswerMatch = line.match(INLINE_ANSWER_PATTERN);
      if (inlineAnswerMatch) {
        sourceLine = inlineAnswerMatch[1].trim();
        extractedAnswerString = inlineAnswerMatch[2].trim();
        hasFoundAnswer = true;
      }

      // 1. Check for answer line first
      const answerMatch = sourceLine.match(ANSWER_PATTERN);
      if (answerMatch) {
        extractedAnswerString = answerMatch[1].trim();
        isFirstLine = false;
        hasFoundAnswer = true;
        continue; // skip this line from question/option collection
      }

      // 2. Check for option line
      let optMatch = null;
      if (!isFirstLine) {
        optMatch =
          sourceLine.match(OPTION_LINE) ||
          sourceLine.match(PAREN_OPTION) ||
          sourceLine.match(BRACKET_OPTION);
      }
    if (optMatch) {
      inOptions = true;
      const letter = optMatch[1].toUpperCase();
      const optText = cleanOption(optMatch[2]);
      const idx = letterToIndex(letter);
      if (idx !== -1) options[idx] = optText;
      isFirstLine = false;
      continue;
    }

    // 3. If we're not yet in options section, it's question text
    isFirstLine = false;
    if (!inOptions) {
      qTextLines.push(line);
    } else {
      // Continuation of a multi-line option (rare, append to last option)
      // Only if it doesn't look like a new question start
      if (!line.match(/^\d+[\.\)]\s/)) {
        const lastFilledIdx = options.map((o, i) => o ? i : -1).filter(i => i !== -1).pop();
        if (lastFilledIdx !== undefined && lastFilledIdx >= 0) {
          options[lastFilledIdx] += " " + cleanOption(line);
        }
      }
    }
  }

  // Extract trailing letter answer if no explicit answer marker has been found
  if (!extractedAnswerString) {
    const lastIdx = options.map((o, i) => o ? i : -1).filter(i => i !== -1).pop();
    if (lastIdx !== undefined && lastIdx >= 0) {
      const lastOpt = options[lastIdx];
      const trailingLetterMatch = lastOpt.match(/\s+([A-D])\s*$/i);
      if (trailingLetterMatch) {
        extractedAnswerString = trailingLetterMatch[1].toUpperCase();
        options[lastIdx] = lastOpt.replace(/\s+([A-D])\s*$/, "").trim();
      }
    }
  }

  const questionText = cleanQuestionText(qTextLines.join(" ").trim());
  const filledOptions = options.filter(o => o.length > 0);

  // Resolve correct option index
  let correctOptionIndex = -1;
  if (extractedAnswerString) {
    // Try to see if it's a letter (e.g. "A", "B", "C", "D", "A)", etc.)
    const cleanLetter = extractedAnswerString.replace(/[\(\)\.\)\]\s]/g, "").toUpperCase();
    const idx = letterToIndex(cleanLetter);
    if (idx !== -1) {
      correctOptionIndex = idx;
    } else {
      // If it's the option text, find which option index matches it
      const lowerAnswer = extractedAnswerString.toLowerCase().trim();
      for (let i = 0; i < 4; i++) {
        if (options[i] && options[i].toLowerCase().trim() === lowerAnswer) {
          correctOptionIndex = i;
          break;
        }
      }
      // Substring/partial match fallback
      if (correctOptionIndex === -1) {
        for (let i = 0; i < 4; i++) {
          if (options[i] && (options[i].toLowerCase().includes(lowerAnswer) || lowerAnswer.includes(options[i].toLowerCase()))) {
            correctOptionIndex = i;
            break;
          }
        }
      }
    }
  }

  return { questionText, options, filledOptions, correctOptionIndex };
}

/**
 * Main exported parser.
 * @param {string} text  - Raw extracted text from PDF/DOCX/TXT
 * @returns {Array}      - Array of parsed question objects
 */
function parseMCQs(text) {
  if (!text) return [];

  // Normalize line endings
  const cleanText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Detect and split off separate answer key
  const { mainText, answerKeyText } = extractAnswerKeySection(cleanText);
  const answerMap = parseAnswerKey(answerKeyText);
  const hasAnswerKey = Object.keys(answerMap).length >= 5;
  console.log(`🔑 Separate answer key: ${Object.keys(answerMap).length} entries found.`);

  // Split into question blocks using lookahead on question numbers
  // Handles: "1.", "1)", "Q1.", "Question 1:", bare "1 " at start of line
  const blockSplitRegex = /(?:^|\n)(?=\s*(?:Q(?:uestion)?\s*\d+|\d+)\s*[\.:\)\]–\-\s])/gi;
  const rawBlocks = mainText.split(blockSplitRegex);

  const parsedQuestions = [];

  for (const rawBlock of rawBlocks) {
    const block = rawBlock.trim();
    if (!block) continue;

    // Quick sanity check: skip blocks with no option markers
    const hasOptions = /(?:^|\n)\s*(?:[A-D][\.\)\]–\-]?|\([A-D]\)|\[[A-D]\])\s+/im.test(block);
    const hasAnswerMarker = /(?:Answer|Ans|Correct|Key)\s*[:=\-–]?\s*\(?[A-D]\)?/i.test(block);
    if (!hasOptions && !hasAnswerMarker) continue;

    // Extract question number
    const qNumMatch = block.match(/^\s*(?:Q(?:uestion)?\s*(\d+)|(\d+))\s*[\.:\)\]–\-]?\s*/i);
    const questionNumber = qNumMatch ? (qNumMatch[1] || qNumMatch[2]) : null;

    // Parse the block line by line
    const { questionText, options, filledOptions, correctOptionIndex: inlineIdx } = parseBlock(block);

    // Determine correct answer: inline first, then answer map fallback
    let correctOptionIndex = inlineIdx;
    if (correctOptionIndex === -1 && questionNumber && answerMap[questionNumber]) {
      correctOptionIndex = letterToIndex(answerMap[questionNumber]);
    }

    // Skip blocks that don't have exactly 4 options
    if (filledOptions.length !== 4) continue;

    // Skip blocks without question text
    if (!questionText || questionText.length < 3) continue;

    parsedQuestions.push({
      text: questionText,
      options,          // array of 4 strings [A, B, C, D]
      correctOptionIndex,
      questionNumber,
      originalBlock: block,
    });
  }

  console.log(`✅ Parsed ${parsedQuestions.length} valid MCQs from document.`);
  return parsedQuestions;
}

/**
 * Pre-process raw text: remove page headers, footers, watermarks.
 */
function cleanTextForParsing(rawText) {
  if (!rawText) return "";

  const lines = rawText.split("\n");

  // Count line frequencies to strip repeating headers/footers
  // IMPORTANT: Never count answer lines — they appear hundreds of times legitimately
  const ANSWER_PATTERN = /^\s*(?:✓\s*)?(?:answer|correct\s*answer|ans(?:wer)?|key)\s*[:=\-–]?\s*(.+)$/i;
  
  // Calculate dynamic threshold based on document size
  // Headers/footers repeat on almost every page. For a 100-page document, they repeat 100 times.
  // We want to avoid deleting common question phrases or duplicated question parts.
  const threshold = Math.max(10, Math.ceil(lines.length / 150));
  
  const freq = {};
  for (const line of lines) {
    const t = line.trim().toLowerCase();
    if (
      t.length > 5 &&
      !t.match(/^\s*(?:[a-d1-4]|[A-D])[\.\)\]–\-]\s+/i) &&
      !t.match(/^\s*(?:q(?:uestion)?\s*\d+|\d+)\s*[:\.\)\]–\-]/i) &&
      !ANSWER_PATTERN.test(t)   // ← never count answer lines
    ) {
      freq[t] = (freq[t] || 0) + 1;
    }
  }

  const cleaned = [];
  for (const line of lines) {
    const t = line.trim();
    const tl = t.toLowerCase();

    // Remove blank lines (keep 1)
    if (t === "") { cleaned.push(""); continue; }

    // Remove page numbers: "Page 1 of 125", "500 Premium Biology MCQ Test Bank Page 1 of 125"
    // Apply length check (< 100) to prevent false positives matching a full page of text
    if (t.length < 100) {
      if (t.match(/page\s*\d+\s*of\s*\d+/i)) continue;
      if (t.match(/^\d+\s*of\s*\d+$/i)) continue;
      if (t.match(/^-\s*\d+\s*-$/)) continue;
    }
    
    // Remove standalone "Page N" at end of long lines like "... Page 1 of 125"
    if (t.match(/^.{10,}\s+page\s+\d+\s+of\s+\d+$/i) && t.length < 150) {
      const stripped = t.replace(/\s+page\s+\d+\s+of\s+\d+$/i, "").trim();
      if (stripped) cleaned.push(stripped);
      continue;
    }

    // Remove website/copyright watermarks
    if (
      tl.includes("www.") || tl.includes(".com") || tl.includes(".pk") ||
      tl.includes("copyright") || tl.includes("all rights reserved") ||
      tl.includes("visit:") || tl.includes("downloaded from")
    ) continue;

    // Remove lines that repeat more than the calculated dynamic threshold
    // BUT never remove answer lines — they legitimately repeat hundreds of times
    if (freq[tl] && freq[tl] > threshold && !ANSWER_PATTERN.test(tl)) continue;

    cleaned.push(line);
  }

  // Collapse excessive blank lines
  let out = cleaned.join("\n");

  // Normalize inline Option markers into their own lines.
  // Example: "A) One B) Two C) Three D) Four" -> separate lines for each option.
  out = out.replace(/([^\n])\s+([A-D1-4a-d])\s*[\.\)\]\-–]\s+/g, "$1\n$2) ");
  out = out.replace(/\s+([A-D1-4a-d])\s*\.[^\S\n]*/g, "\n$1) ");
  out = out.replace(/\s+Answer(?!\s*(?:Key|Sheet))\s*[:=\-–]?\s*/gi, "\nAnswer: ");

  // Split combined option lines like "A) text B) text" into multiple lines.
  out = out.replace(/([A-D])\)\s*([^\n]+?)\s+(?=[A-D]\)\s+)/g, "$1) $2\n");

  // Collapse excessive blank lines
  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

module.exports = { parseMCQs, cleanTextForParsing };
