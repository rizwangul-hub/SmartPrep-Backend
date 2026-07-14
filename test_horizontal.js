const fs = require('fs');

function letterToIndex(char) {
  const c = char.toUpperCase();
  if (c === "A" || c === "1") return 0;
  if (c === "B" || c === "2") return 1;
  if (c === "C" || c === "3") return 2;
  if (c === "D" || c === "4") return 3;
  return -1;
}

function cleanOption(str) {
  return (str || "").replace(/^\s+|\s+$/g, "").trim();
}

function cleanQuestionText(text) {
  return text
    .replace(/^\s*(?:Q(?:uestion)?\s*\d+|\d+)\s*[:\.\)\]–\-]?\s+/i, "")
    .trim();
}

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

function parseAnswerKey(text) {
  const answerMap = {};
  if (!text) return answerMap;

  // Use [^\S\n] to restrict matching within the same line
  const pattern = /\b(?:Q\s*)?(\d+)[^\S\n]*[-:\.\)\]]*[^\S\n]+\(?([A-D1-4a-d])\)?/gi;
  let match;
  let count = 0;
  while ((match = pattern.exec(text)) !== null) {
    answerMap[match[1]] = match[2].toUpperCase();
    count++;
  }

  if (count >= 5) return answerMap;

  // Sequential fallback
  const letters = [];
  const lp = /\b([A-D])\b/gi;
  let lm;
  while ((lm = lp.exec(text)) !== null) letters.push(lm[1].toUpperCase());
  if (letters.length >= 5) {
    letters.forEach((l, i) => { answerMap[String(i + 1)] = l; });
  }
  return answerMap;
}

function parseBlock(block) {
  const OPTION_LINE = /^([A-D1-4a-d])\s*[\.\)\]\-\–]?\s+(.+)$/i;
  const PAREN_OPTION = /^\(([A-D1-4a-d])\)\s+(.+)$/i;
  const BRACKET_OPTION = /^\[([A-D1-4a-d])\]\s+(.+)$/i;

  const ANSWER_PATTERN = /^(?:✓\s*)?(?:Answer|Correct\s*Choice\s*Answer|Correct\s*Choice|Correct\s*Answer|Correct\s*Option|Ans(?:wer)?|Key|Correct)\s*[:=\-–]?\s*(.+)$/i;
  const INLINE_ANSWER_PATTERN = /(.*?)\s+(?:✓\s*)?(?:Answer|Correct\s*Choice\s*Answer|Correct\s*Choice|Correct\s*Answer|Correct\s*Option|Ans(?:wer)?|Key|Correct)\s*[:=\-–]?\s*(.+)$/i;

  const lines = block.split("\n").map(l => l.trim()).filter(Boolean);

  const qTextLines = [];
  const options = ["", "", "", ""];
  let extractedAnswerString = "";
  let inOptions = false;
  let isFirstLine = true;
  let hasFoundAnswer = false;

  for (const line of lines) {
    if (hasFoundAnswer) continue;

    let sourceLine = line;
    const inlineAnswerMatch = line.match(INLINE_ANSWER_PATTERN);
    if (inlineAnswerMatch) {
      sourceLine = inlineAnswerMatch[1].trim();
      extractedAnswerString = inlineAnswerMatch[2].trim();
      hasFoundAnswer = true;
    }

    const answerMatch = sourceLine.match(ANSWER_PATTERN);
    if (answerMatch) {
      extractedAnswerString = answerMatch[1].trim();
      isFirstLine = false;
      hasFoundAnswer = true;
      continue;
    }

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

    isFirstLine = false;
    if (!inOptions) {
      qTextLines.push(line);
    } else {
      if (!line.match(/^\d+[\.\)]\s/)) {
        const lastFilledIdx = options.map((o, i) => o ? i : -1).filter(i => i !== -1).pop();
        if (lastFilledIdx !== undefined && lastFilledIdx >= 0) {
          options[lastFilledIdx] += " " + cleanOption(line);
        }
      }
    }
  }

  // --- NEW FIX: Trailing letter extraction ---
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
  // -------------------------------------------

  const questionText = cleanQuestionText(qTextLines.join(" ").trim());
  const filledOptions = options.filter(o => o.length > 0);

  let correctOptionIndex = -1;
  if (extractedAnswerString) {
    const cleanLetter = extractedAnswerString.replace(/[\(\)\.\)\]\s]/g, "").toUpperCase();
    const idx = letterToIndex(cleanLetter);
    if (idx !== -1) {
      correctOptionIndex = idx;
    } else {
      const lowerAnswer = extractedAnswerString.toLowerCase().trim();
      for (let i = 0; i < 4; i++) {
        if (options[i] && options[i].toLowerCase().trim() === lowerAnswer) {
          correctOptionIndex = i;
          break;
        }
      }
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

function cleanTextForParsing(rawText) {
  if (!rawText) return "";

  const lines = rawText.split("\n");
  const ANSWER_PATTERN = /^\s*(?:✓\s*)?(?:answer|correct\s*answer|ans(?:wer)?|key)\s*[:=\-–]?\s*(.+)$/i;
  const threshold = Math.max(10, Math.ceil(lines.length / 150));
  
  const freq = {};
  for (const line of lines) {
    const t = line.trim().toLowerCase();
    if (
      t.length > 5 &&
      !t.match(/^\s*(?:[a-d1-4]|[A-D])[\.\)\]–\-]\s+/i) &&
      !t.match(/^\s*(?:q(?:uestion)?\s*\d+|\d+)\s*[:\.\)\]–\-]/i) &&
      !ANSWER_PATTERN.test(t)
    ) {
      freq[t] = (freq[t] || 0) + 1;
    }
  }

  const cleaned = [];
  for (const line of lines) {
    const t = line.trim();
    const tl = t.toLowerCase();

    if (t === "") { cleaned.push(""); continue; }

    if (t.length < 100) {
      if (t.match(/page\s*\d+\s*of\s*\d+/i)) continue;
      if (t.match(/^\d+\s*of\s*\d+$/i)) continue;
      if (t.match(/^-\s*\d+\s*-$/)) continue;
    }
    
    if (t.match(/^.{10,}\s+page\s+\d+\s+of\s+\d+$/i) && t.length < 150) {
      const stripped = t.replace(/\s+page\s+\d+\s+of\s+\d+$/i, "").trim();
      if (stripped) cleaned.push(stripped);
      continue;
    }

    if (
      tl.includes("www.") || tl.includes(".com") || tl.includes(".pk") ||
      tl.includes("copyright") || tl.includes("all rights reserved") ||
      tl.includes("visit:") || tl.includes("downloaded from")
    ) continue;

    if (freq[tl] && freq[tl] > threshold && !ANSWER_PATTERN.test(tl)) continue;

    cleaned.push(line);
  }

  let out = cleaned.join("\n");

  out = out.replace(/([^\n])\s+([A-D1-4a-d])\s*[\.\)\]\-–]\s+/g, "$1\n$2) ");
  out = out.replace(/\s+([A-D1-4a-d])\s*\.[^\S\n]*/g, "\n$1) ");
  
  // --- NEW FIX: Negative lookahead to protect "Answer Key" ---
  out = out.replace(/\s+Answer(?!\s*(?:Key|Sheet))\s*[:=\-–]?\s*/gi, "\nAnswer: ");
  // ------------------------------------------------------------

  out = out.replace(/([A-D])\)\s*([^\n]+?)\s+(?=[A-D]\)\s+)/g, "$1) $2\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

function parseMCQs(text) {
  if (!text) return [];

  const cleanText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const { mainText, answerKeyText } = extractAnswerKeySection(cleanText);
  const answerMap = parseAnswerKey(answerKeyText);
  
  console.log(`🔑 Separate answer key: ${Object.keys(answerMap).length} entries found.`);
  console.log('Parsed answer key map:', answerMap);

  const blockSplitRegex = /(?:^|\n)(?=\s*(?:Q(?:uestion)?\s*\d+|\d+)\s*[\.:\)\]–\-\s])/gi;
  const rawBlocks = mainText.split(blockSplitRegex);
  const parsedQuestions = [];

  for (const rawBlock of rawBlocks) {
    const block = rawBlock.trim();
    if (!block) continue;

    const hasOptions = /(?:^|\n)\s*(?:[A-D][\.\)\]–\-]?|\([A-D]\)|\[[A-D]\])\s+/im.test(block);
    const hasAnswerMarker = /(?:Answer|Ans|Correct|Key)\s*[:=\-–]?\s*\(?[A-D]\)?/i.test(block);
    
    if (!hasOptions && !hasAnswerMarker) continue;

    const qNumMatch = block.match(/^\s*(?:Q(?:uestion)?\s*(\d+)|(\d+))\s*[\.:\)\]–\-]?\s*/i);
    const questionNumber = qNumMatch ? (qNumMatch[1] || qNumMatch[2]) : null;
    
    console.log(`Block question number parsed as: "${questionNumber}"`);

    const { questionText, options, filledOptions, correctOptionIndex: inlineIdx } = parseBlock(block);

    let correctOptionIndex = inlineIdx;
    if (correctOptionIndex === -1 && questionNumber && answerMap[questionNumber]) {
      correctOptionIndex = letterToIndex(answerMap[questionNumber]);
      console.log(`Mapped question ${questionNumber} to key answer ${answerMap[questionNumber]} -> index ${correctOptionIndex}`);
    }

    if (filledOptions.length !== 4) continue;
    if (!questionText || questionText.length < 3) continue;

    parsedQuestions.push({
      text: questionText,
      options,
      correctOptionIndex,
      questionNumber,
    });
  }

  return parsedQuestions;
}

const text2 = `212. A quantity having magnitude and 
direction is called: 
A) Scalar\u2003B) Speed\u2003C) Vector\u2003D) Area

Answer Key (196–225)
212. C — Vector`;

console.log("\n=== Text 2 Parsing ===");
const clean2 = cleanTextForParsing(text2);
const res2 = parseMCQs(clean2);
console.log('Total parsed from text2:', res2.length);
res2.forEach((q, i) => console.log(`Q${i+1}:`, q));
