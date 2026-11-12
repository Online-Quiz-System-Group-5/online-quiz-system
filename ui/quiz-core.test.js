"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseQuestionBank, inspectQuestionBank, scoreQuiz, prepareQuiz, isTimerExpired, resolveTimedAnswer, createTimerController, saveLatestResult, readLatestResult, clearLatestResult, readResultHistory, appendResultHistory, clearResultHistory, maxResultHistoryEntries } = require("./quiz-core.js");

test("loads multiple records and converts one-based keys", () => {
  const questions = parseQuestionBank("First?|A|B|2\r\nSecond?|Yes|No|Maybe|1\r\n");
  assert.equal(questions.length, 2);
  assert.equal(questions[0].correctOption, 1);
  assert.equal(questions[1].options.length, 3);
});

test("ignores blank lines and accepts a bank without a final newline", () => {
  const questions = parseQuestionBank("\nPrompt|One|Two|1\n\nOther|A|B|2");
  assert.equal(questions.length, 2);
});

test("rejects empty banks and incomplete or empty fields with a line", () => {
  assert.throws(() => parseQuestionBank(" \n"), /no usable questions/i);
  assert.throws(() => parseQuestionBank("Only prompt|one|1"), /Line 1/);
  assert.throws(() => parseQuestionBank("|one|two|1"), /question text is empty/i);
  assert.throws(() => parseQuestionBank("Prompt|one||1"), /option 2 is empty/i);
});

test("rejects non-numeric and out-of-range answer keys", () => {
  assert.throws(() => parseQuestionBank("Prompt|a|b|two"), /whole number/i);
  assert.throws(() => parseQuestionBank("Prompt|a|b|3"), /from 1 to 2/i);
});

test("scores quiz answers and rounds percentage to a whole number", () => {
  const questions = parseQuestionBank("First?|A|B|2\nSecond?|Yes|No|1\nThird?|A|B|2");
  assert.deepEqual(scoreQuiz(questions, [1, 0, 0]), { correct: 2, total: 3, incorrect: 1, percentage: 67 });
});

test("rejects missing and invalid answers", () => {
  const questions = parseQuestionBank("Prompt|a|b|1");
  assert.throws(() => scoreQuiz(questions, []), /one answer for every question/i);
  assert.throws(() => scoreQuiz(questions, [2]), /outside the available options/i);
});

test("counts timed-out questions as unanswered without rejecting the full quiz", () => {
  const questions = parseQuestionBank("Prompt|A|B|1");
  assert.deepEqual(scoreQuiz(questions, [null]), { correct: 0, total: 1, incorrect: 1, percentage: 0 });
});

test("accepts a last-second answer at the deadline and times out after it", () => {
  const deadline = 1000;
  assert.equal(resolveTimedAnswer(1, deadline, deadline), 1);
  assert.equal(resolveTimedAnswer(1, deadline, deadline + 1), null);
  assert.equal(resolveTimedAnswer(null, deadline, deadline - 1), null);
  assert.equal(isTimerExpired(deadline, deadline), false);
  assert.equal(isTimerExpired(deadline, deadline + 1), true);
});

test("cancels a running question timer when the quiz exits", () => {
  let cleared = null;
  const timer = createTimerController({
    setIntervalFn: (callback, interval) => ({ callback, interval }),
    clearIntervalFn: (handle) => { cleared = handle; }
  });
  const handle = timer.start(() => {}, 200);
  assert.equal(timer.active, true);
  timer.cancel();
  assert.equal(cleared, handle);
  assert.equal(timer.active, false);
});

test("stores only latest score metadata and can clear it", () => {
  const values = new Map();
  const storage = {
    setItem: (key, value) => values.set(key, value),
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key)
  };
  assert.equal(saveLatestResult(storage, { correct: 2, total: 3, percentage: 67 }, "Sample bank", new Date("2026-11-12T12:00:00Z")), true);
  const raw = JSON.parse(values.values().next().value);
  assert.deepEqual(Object.keys(raw).sort(), ["bankLabel", "correct", "date", "percentage", "total"]);
  assert.deepEqual(readLatestResult(storage), {
    correct: 2,
    total: 3,
    percentage: 67,
    date: "2026-11-12T12:00:00.000Z",
    bankLabel: "Sample bank"
  });
  assert.equal(clearLatestResult(storage), true);
  assert.equal(readLatestResult(storage), null);
});

test("handles corrupted or unavailable result storage safely", () => {
  const storage = { getItem: () => "not-json", setItem: () => { throw new Error("blocked"); } };
  assert.equal(readLatestResult(storage), null);
  assert.equal(readLatestResult(null), null);
  assert.equal(saveLatestResult(storage, { correct: 1, total: 1, percentage: 100 }, "Bank"), false);
});

test("records score history metadata and retains only the newest entries", () => {
  const values = new Map();
  const storage = {
    setItem: (key, value) => values.set(key, value),
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key)
  };
  for (let index = 0; index < maxResultHistoryEntries + 2; index += 1) {
    assert.equal(appendResultHistory(storage, { correct: 1, total: 2, percentage: 50 }, `Bank ${index}`, new Date(2026, 0, index + 1)), true);
  }
  const history = readResultHistory(storage);
  assert.equal(history.status, "ok");
  assert.equal(history.entries.length, maxResultHistoryEntries);
  assert.equal(history.entries[0].bankLabel, "Bank 21");
  assert.equal(history.entries.at(-1).bankLabel, "Bank 2");
  assert.deepEqual(Object.keys(history.entries[0]).sort(), ["bankLabel", "correct", "date", "percentage", "total"]);
  assert.equal(clearResultHistory(storage), true);
  assert.deepEqual(readResultHistory(storage), { entries: [], status: "ok" });
});

test("marks corrupted and unavailable histories for the UI to explain", () => {
  assert.deepEqual(readResultHistory(null), { entries: [], status: "unavailable" });
  assert.deepEqual(readResultHistory({ getItem: () => "not-json" }), { entries: [], status: "corrupt" });
  const partiallyValid = readResultHistory({ getItem: () => JSON.stringify([
    { correct: 1, total: 1, percentage: 100, date: "2026-11-12T00:00:00.000Z", bankLabel: "Good" },
    { answers: [0], question: "Should not be stored" }
  ]) });
  assert.equal(partiallyValid.status, "corrupt");
  assert.equal(partiallyValid.entries.length, 1);
});

test("prepares the requested quiz length and keeps answer keys attached", () => {
  const bank = parseQuestionBank("First|A|B|1\nSecond|C|D|2\nThird|E|F|1");
  const quiz = prepareQuiz(bank, { count: 2 });
  assert.equal(quiz.length, 2);
  assert.deepEqual(quiz, bank.slice(0, 2));
  assert.deepEqual(prepareQuiz(bank, { count: 1 }), bank.slice(0, 1));
  assert.deepEqual(prepareQuiz(bank, { count: 3 }), bank);
  assert.equal(bank.length, 3);
});

test("shuffles question records before selecting the requested count", () => {
  const bank = parseQuestionBank("First|A|B|1\nSecond|C|D|2\nThird|E|F|1");
  const values = [0, 0];
  const quiz = prepareQuiz(bank, { count: 2, shuffle: true, random: () => values.shift() });
  assert.deepEqual(quiz.map((question) => question.prompt), ["Second", "Third"]);
  assert.deepEqual(quiz.map((question) => question.correctOption), [1, 0]);
  assert.deepEqual(bank.map((question) => question.prompt), ["First", "Second", "Third"]);
});

test("rejects quiz sizes below one, above the bank, and for an empty bank", () => {
  const bank = parseQuestionBank("Only|A|B|1");
  assert.throws(() => prepareQuiz(bank, { count: 0 }), /between 1 and 1/i);
  assert.throws(() => prepareQuiz(bank, { count: 2 }), /between 1 and 1/i);
  assert.throws(() => prepareQuiz([], { count: 1 }), /at least one question/i);
});

test("previews valid questions and reports each malformed record with its line", () => {
  const report = inspectQuestionBank("Good question?|A|B|1\nBroken question|only two fields\nAnother good one|X|Y|Z|2");
  assert.deepEqual(report.questions.map(({ prompt, options }) => ({ prompt, optionCount: options.length })), [
    { prompt: "Good question?", optionCount: 2 },
    { prompt: "Another good one", optionCount: 3 }
  ]);
  assert.deepEqual(report.errors, [{
    line: 2,
    message: "Line 2: add a question, at least two options, and the correct option number."
  }]);
});

test("reports an empty question bank without losing line-specific errors", () => {
  assert.deepEqual(inspectQuestionBank("\n\n").errors, [{
    line: null,
    message: "This question bank has no usable questions."
  }]);
  assert.equal(inspectQuestionBank("Broken|record").questions.length, 0);
  assert.equal(inspectQuestionBank("Broken|record").errors[0].line, 1);
});
