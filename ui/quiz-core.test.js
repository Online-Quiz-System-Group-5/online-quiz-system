"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseQuestionBank, scoreQuiz } = require("./quiz-core.js");

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
