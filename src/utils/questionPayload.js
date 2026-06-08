/**
 * Normalize bulk MCQ payloads from multiple common JSON shapes:
 * - [{ ... }, { ... }]
 * - { questions: [{ ... }] }
 * - { exam, questions: [{ ... }] }
 * - { text, options, ... }  (single MCQ)
 */
const normalizeQuestionsInput = (body) => {
  if (Array.isArray(body)) {
    return body.length ? body : null;
  }

  if (!body || typeof body !== "object") {
    return null;
  }

  if (Array.isArray(body.questions)) {
    return body.questions.length ? body.questions : null;
  }

  if (body.text || body.options) {
    return [body];
  }

  return null;
};

const extractExamFields = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { exam: "", examName: "", examId: "" };
  }

  return {
    exam: body.exam,
    examName: body.examName,
    examId: body.examId,
  };
};

module.exports = {
  normalizeQuestionsInput,
  extractExamFields,
};
