"use strict";

(function (root, factory) {
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  if (root) root.QuizCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function parseQuestionLine(line, lineNumber) {
    const fields = line.split("|");
    if (fields.length < 4) {
      return { error: `Line ${lineNumber}: add a question, at least two options, and the correct option number.` };
    }
    const prompt = fields[0].trim();
    const options = fields.slice(1, -1).map((option) => option.trim());
    if (!prompt) return { error: `Line ${lineNumber}: the question text is empty.` };
    const emptyOption = options.findIndex((option) => !option);
    if (emptyOption !== -1) return { error: `Line ${lineNumber}: option ${emptyOption + 1} is empty.` };
    const key = fields[fields.length - 1].trim();
    if (!/^\d+$/.test(key)) return { error: `Line ${lineNumber}: the correct option must be a whole number.` };
    const correctOption = Number(key);
    if (!Number.isSafeInteger(correctOption) || correctOption < 1 || correctOption > options.length) {
      return { error: `Line ${lineNumber}: the correct option must be from 1 to ${options.length}.` };
    }
    return { question: { prompt, options, correctOption: correctOption - 1 } };
  }

  function inspectQuestionBank(contents) {
    if (typeof contents !== "string") throw new TypeError("Question bank must be text.");
    const questions = [];
    const errors = [];
    contents.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return;
      const lineNumber = index + 1;
      const result = parseQuestionLine(line, lineNumber);
      if (result.error) errors.push({ line: lineNumber, message: result.error });
      else questions.push(result.question);
    });
    if (!questions.length && !errors.length) errors.push({ line: null, message: "This question bank has no usable questions." });
    return { questions, errors };
  }

  function parseQuestionBank(contents) {
    const report = inspectQuestionBank(contents);
    if (report.errors.length) throw new Error(report.errors[0].message);
    if (!report.questions.length) throw new Error("This question bank has no usable questions.");
    return report.questions;
  }

  function scoreQuiz(questions, answers) {
    if (!Array.isArray(questions) || !Array.isArray(answers) || questions.length !== answers.length) {
      throw new Error("There must be one answer for every question.");
    }
    const correct = questions.reduce((count, question, index) => {
      const answer = answers[index];
      if (!Number.isInteger(answer) || answer < 0 || answer >= question.options.length) {
        throw new Error(`Answer ${index + 1} is outside the available options.`);
      }
      return count + (answer === question.correctOption ? 1 : 0);
    }, 0);
    return { correct, total: questions.length, incorrect: questions.length - correct,
      percentage: questions.length ? Math.round((correct / questions.length) * 100) : 0 };
  }

  function prepareQuiz(questions, options = {}) {
    if (!Array.isArray(questions) || !questions.length) {
      throw new Error("Load at least one question before starting a quiz.");
    }
    const count = options.count === undefined ? questions.length : options.count;
    if (!Number.isInteger(count) || count < 1 || count > questions.length) {
      throw new Error(`Choose between 1 and ${questions.length} questions.`);
    }

    const selected = [...questions];
    if (options.shuffle) {
      const random = options.random || Math.random;
      for (let index = selected.length - 1; index > 0; index -= 1) {
        const value = random();
        if (!Number.isFinite(value) || value < 0 || value >= 1) {
          throw new Error("The shuffle random source must return a value from 0 to less than 1.");
        }
        const swapIndex = Math.floor(value * (index + 1));
        [selected[index], selected[swapIndex]] = [selected[swapIndex], selected[index]];
      }
    }
    return selected.slice(0, count);
  }

  return { parseQuestionBank, inspectQuestionBank, scoreQuiz, prepareQuiz };
});
