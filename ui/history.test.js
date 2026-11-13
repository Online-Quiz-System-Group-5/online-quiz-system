"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { addHistoryEntry, readHistory, clearHistory, historyLimit } = require("./quiz-core.js");

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data
  };
}

test("history stores metadata only, newest first, and caps at 20", () => {
  const storage = memoryStorage();
  for (let index = 0; index < historyLimit + 2; index++) {
    const result = { correct: 1, total: 2, percentage: 50, answers: [0, 1], prompt: "private" };
    assert.equal(addHistoryEntry(storage, result, `Bank ${index}`, new Date(Date.UTC(2026, 0, index + 1))), true);
  }
  const saved = readHistory(storage);
  assert.equal(saved.status, "ok");
  assert.equal(saved.entries.length, historyLimit);
  assert.equal(saved.entries[0].bankLabel, "Bank 21");
  assert.equal(saved.entries.at(-1).bankLabel, "Bank 2");
  assert.deepEqual(Object.keys(saved.entries[0]).sort(), ["bankLabel", "correct", "date", "percentage", "total"]);
  assert.equal(JSON.stringify([...storage.data.values()]).includes("private"), false);
  assert.equal(clearHistory(storage), true);
  assert.deepEqual(readHistory(storage), { entries: [], status: "ok" });
});

test("corrupt, partial, and unavailable storage is handled", () => {
  const storage = memoryStorage();
  assert.deepEqual(readHistory(storage), { entries: [], status: "ok" });
  storage.setItem("quizroom.history.v1", "not json");
  assert.deepEqual(readHistory(storage), { entries: [], status: "corrupt" });
  storage.setItem("quizroom.history.v1", JSON.stringify([
    { correct: 1, total: 1, percentage: 100, date: "2026-11-13T00:00:00.000Z", bankLabel: "Valid", question: "private" },
    { correct: 5, total: 1, percentage: 500, date: "wrong", bankLabel: "Invalid" }
  ]));
  const partial = readHistory(storage);
  assert.equal(partial.status, "corrupt");
  assert.equal(partial.entries.length, 1);
  assert.equal(partial.entries[0].question, undefined);
  assert.deepEqual(readHistory(null), { entries: [], status: "unavailable" });
  assert.equal(addHistoryEntry({ setItem() { throw Error("blocked"); } }, { correct: 1, total: 1, percentage: 100 }, "Bank"), false);
});
