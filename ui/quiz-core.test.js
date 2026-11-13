
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseQuestionBank,
  scoreQuiz,
  replaceQuestionBank,
  loadQuestionBankFromResponse
} = require("./quiz-core.js");

// TEST 1: Load multiple records
test("loads multiple records and converts one-based keys", () => {
  const questions = parseQuestionBank(
    "First?|A|B|2\r\nSecond?|Yes|No|Maybe|1\r\n"
  );

  assert.equal(questions.length, 2);
  assert.equal(questions[0].correctOption, 1);
  assert.equal(questions[1].options.length, 3);
});

// TEST 2: Ignore blank lines
test("ignores blank lines and accepts a bank without a final newline", () => {
  const questions = parseQuestionBank(
    "\nPrompt|One|Two|1\n\nOther|A|B|2"
  );

  assert.equal(questions.length, 2);
});

// TEST 3: Reject empty and incomplete question banks
test("rejects empty banks and incomplete or empty fields with a line", () => {
  assert.throws(
    () => parseQuestionBank(" \n"),
    /no usable questions/i
  );

  assert.throws(
    () => parseQuestionBank("Only prompt|one|1"),
    /Line 1/
  );

  assert.throws(
    () => parseQuestionBank("|one|two|1"),
    /question text is empty/i
  );

  assert.throws(
    () => parseQuestionBank("Prompt|one||1"),
    /option 2 is empty/i
  );
});

// TEST 4: Reject invalid answer keys
test("rejects non-numeric and out-of-range answer keys", () => {
  assert.throws(
    () => parseQuestionBank("Prompt|a|b|two"),
    /whole number/i
  );

  assert.throws(
    () => parseQuestionBank("Prompt|a|b|3"),
    /from 1 to 2/i
  );
});

// TEST 5: Calculate quiz score
test("scores quiz answers and rounds percentage to a whole number", () => {
  const questions = parseQuestionBank(
    "First?|A|B|2\nSecond?|Yes|No|1\nThird?|A|B|2"
  );

  assert.deepEqual(
    scoreQuiz(questions, [1, 0, 0]),
    {
      correct: 2,
      total: 3,
      incorrect: 1,
      percentage: 67
    }
  );
});

// TEST 6: Reject missing and invalid answers
test("rejects missing and invalid answers", () => {
  const questions = parseQuestionBank("Prompt|a|b|1");

  assert.throws(
    () => scoreQuiz(questions, []),
    /one answer for every question/i
  );

  assert.throws(
    () => scoreQuiz(questions, [2]),
    /outside the available options/i
  );
});

// TEST 7: Failed import must preserve existing question bank
test("failed import preserves existing valid question bank", () => {
  const questions = parseQuestionBank("Old?|A|B|1");

  const state = {
    questions,
    source: "old.txt",
    answers: [1],
    index: 0,
    selected: 1
  };

  assert.throws(
    () => replaceQuestionBank(state, " ", "empty.txt"),
    /no usable questions/i
  );

  assert.strictEqual(state.questions, questions);
  assert.equal(state.source, "old.txt");
  assert.deepEqual(state.answers, [1]);
});

// TEST 8: Successful import resets quiz session
test("successful import replaces bank and resets quiz session", () => {
  const state = {
    questions: parseQuestionBank("Old?|A|B|1"),
    source: "old.txt",
    answers: [1],
    index: 0,
    selected: 1
  };

  replaceQuestionBank(state, "New?|X|Y|2", "new.txt");

  assert.equal(state.questions[0].prompt, "New?");
  assert.equal(state.source, "new.txt");
  assert.deepEqual(state.answers, []);
  assert.equal(state.index, 0);
  assert.equal(state.selected, null);
});

// TEST 9: Failed sample fetch preserves existing questions
test("failed sample fetch preserves existing question bank", async () => {
  const questions = parseQuestionBank("Old?|A|B|1");

  const state = {
    questions,
    source: "old.txt",
    answers: [],
    index: 0,
    selected: null
  };

  await assert.rejects(
    loadQuestionBankFromResponse(
      state,
      { ok: false },
      "Sample question bank"
    ),
    /could not be loaded/i
  );

  assert.strictEqual(state.questions, questions);
  assert.equal(state.source, "old.txt");
});

// TEST 10: Empty sample response preserves existing questions
test("empty sample response preserves existing question bank", async () => {
  const questions = parseQuestionBank("Old?|A|B|1");

  const state = {
    questions,
    source: "old.txt",
    answers: [],
    index: 0,
    selected: null
  };

  await assert.rejects(
    loadQuestionBankFromResponse(
      state,
      { ok: true, text: async () => " " },
      "Sample question bank"
    ),
    /no usable questions/i
  );

  assert.strictEqual(state.questions, questions);
  assert.equal(state.source, "old.txt");
});
