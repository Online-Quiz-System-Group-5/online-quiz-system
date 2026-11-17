"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const topics = require("./topics.json");
const { parseQuestionBank, prepareQuiz } = require("./quiz-core.js");

test("catalogue has ten distinct topics and 100 valid distinct questions", () => {
  assert.equal(topics.length, 10);
  assert.equal(new Set(topics.map(t => t.id)).size, 10);
  const prompts = new Set();
  for (const topic of topics) {
    const questions = parseQuestionBank(topic.bank);
    assert.equal(questions.length, 10, topic.name);
    for (const question of questions) {
      assert.equal(question.options.length, 4);
      assert.equal(new Set(question.options).size, 4);
      prompts.add(question.prompt);
    }
  }
  assert.equal(prompts.size, 100);
});

test("large imported banks allow at most ten questions per attempt", () => {
  const questions = topics.flatMap(topic => parseQuestionBank(topic.bank));
  assert.equal(prepareQuiz(questions).length, 10);
  assert.equal(prepareQuiz(questions, { count: 1 }).length, 1);
  assert.equal(prepareQuiz(questions, { count: 10 }).length, 10);
  assert.throws(() => prepareQuiz(questions, { count: 11 }), /between 1 and 10/);
});
