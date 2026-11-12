"use strict";

(function (root, factory) {
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  if (root) root.QuizCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function parseQuestionBank(contents) {
    if (typeof contents !== "string") throw new TypeError("Question bank must be text.");
    const questions = [];
    contents.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return;
      const fields = line.split("|");
      const lineNumber = index + 1;
      if (fields.length < 4) {
        throw new Error(`Line ${lineNumber}: add a question, at least two options, and the correct option number.`);
      }
      const prompt = fields[0].trim();
      const options = fields.slice(1, -1).map((option) => option.trim());
      if (!prompt) throw new Error(`Line ${lineNumber}: the question text is empty.`);
      const emptyOption = options.findIndex((option) => !option);
      if (emptyOption !== -1) throw new Error(`Line ${lineNumber}: option ${emptyOption + 1} is empty.`);
      const key = fields[fields.length - 1].trim();
      if (!/^\d+$/.test(key)) throw new Error(`Line ${lineNumber}: the correct option must be a whole number.`);
      const correctOption = Number(key);
      if (!Number.isSafeInteger(correctOption) || correctOption < 1 || correctOption > options.length) {
        throw new Error(`Line ${lineNumber}: the correct option must be from 1 to ${options.length}.`);
      }
      questions.push({ prompt, options, correctOption: correctOption - 1 });
    });
    if (!questions.length) throw new Error("This question bank has no usable questions.");
    return questions;
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

  return { parseQuestionBank, scoreQuiz };
});
