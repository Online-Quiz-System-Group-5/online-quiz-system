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
      if (answer === null) return count;
      if (!Number.isInteger(answer) || answer < 0 || answer >= question.options.length) {
        throw new Error(`Answer ${index + 1} is outside the available options.`);
      }
      return count + (answer === question.correctOption ? 1 : 0);
    }, 0);
    return { correct, total: questions.length, incorrect: questions.length - correct,
      percentage: questions.length ? Math.round((correct / questions.length) * 100) : 0 };
  }

  function isTimerExpired(deadline, now = Date.now()) {
    return Number.isFinite(deadline) && Number.isFinite(now) && now > deadline;
  }

  function resolveTimedAnswer(selected, deadline, now = Date.now()) {
    if (selected === null) return null;
    return deadline === null || now <= deadline ? selected : null;
  }

  function createTimerController({ setIntervalFn = setInterval, clearIntervalFn = clearInterval } = {}) {
    let handle = null;
    return {
      start(callback, intervalMs = 200) {
        this.cancel();
        handle = setIntervalFn(callback, intervalMs);
        return handle;
      },
      cancel() {
        if (handle !== null) {
          clearIntervalFn(handle);
          handle = null;
        }
      },
      get active() {
        return handle !== null;
      }
    };
  }

  const latestResultStorageKey = "quizroom.latest-result.v1";

  function saveLatestResult(storage, result, bankLabel, date = new Date()) {
    if (!storage || typeof storage.setItem !== "function" || !result
      || !Number.isInteger(result.correct) || !Number.isInteger(result.total)
      || !Number.isInteger(result.percentage) || typeof bankLabel !== "string") return false;
    const resultDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(resultDate.getTime())) return false;
    const summary = {
      correct: result.correct,
      total: result.total,
      percentage: result.percentage,
      date: resultDate.toISOString(),
      bankLabel: bankLabel.slice(0, 120)
    };
    try {
      storage.setItem(latestResultStorageKey, JSON.stringify(summary));
      return true;
    } catch {
      return false;
    }
  }

  function readLatestResult(storage) {
    if (!storage || typeof storage.getItem !== "function") return null;
    try {
      const saved = JSON.parse(storage.getItem(latestResultStorageKey));
      if (!saved || !Number.isInteger(saved.correct) || !Number.isInteger(saved.total)
        || !Number.isInteger(saved.percentage) || typeof saved.bankLabel !== "string"
        || typeof saved.date !== "string" || Number.isNaN(Date.parse(saved.date))) return null;
      return {
        correct: saved.correct,
        total: saved.total,
        percentage: saved.percentage,
        date: saved.date,
        bankLabel: saved.bankLabel.slice(0, 120)
      };
    } catch {
      return null;
    }
  }

  function clearLatestResult(storage) {
    if (!storage || typeof storage.removeItem !== "function") return false;
    try {
      storage.removeItem(latestResultStorageKey);
      return true;
    } catch {
      return false;
    }
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

  return { parseQuestionBank, inspectQuestionBank, scoreQuiz, prepareQuiz,
    isTimerExpired, resolveTimedAnswer, createTimerController,
    saveLatestResult, readLatestResult, clearLatestResult };
});
