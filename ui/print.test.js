"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const QuizCore = require("./quiz-core.js");

function loadApp() {
  const elements = new Map();
  const get = (selector) => {
    if (!elements.has(selector)) elements.set(selector, {
      hidden: selector === "[data-screen='results']",
      dataset: {}, style: { setProperty() {} },
      addEventListener(event, handler) { this[event] = handler; },
      replaceChildren(...children) { this.value = children[0]?.value; }, append() {},
      setAttribute() {}, removeAttribute() {}, classList: { toggle() {} }
    });
    return elements.get(selector);
  };
  const screens = ["home", "quiz", "results", "history"].map((name) => {
    const screen = get(`[data-screen='${name}']`);
    screen.dataset.screen = name;
    return screen;
  });
  let printed = 0;
  const document = {
    createElement: () => ({}),
    querySelector: get,
    querySelectorAll: (selector) => selector === "[data-screen]" ? screens : [],
    addEventListener() {}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "app.js"), "utf8"), {
    document, window: { QuizCore, print() { printed++; }, scrollTo() {} },
    fetch: async () => ({ ok: true, json: async () => [{ id: "test", name: "Test", bank: "First?|Yes|No|1\nSecond?|A|B|2" }] }),
    setTimeout, clearTimeout
  });
  return { get, prints: () => printed };
}

test("print is restricted to completed results and retains score and review", async () => {
  const app = loadApp();
  await new Promise(setImmediate);
  app.get("[data-print]").click();
  assert.equal(app.prints(), 0);
  app.get("[data-start]").click();
  app.get("[data-print]").click();
  assert.equal(app.prints(), 0);
  // Exercise the real keyboard handler separately in browser coverage;
  // this harness checks print gating and non-mutating native printing.
  const results = app.get("[data-screen='results']");
  results.hidden = false;
  app.get("[data-score-percent]").textContent = "50%";
  app.get("[data-review-list]").innerHTML = "Completed answer review";
  app.get("[data-print]").click();
  assert.equal(app.prints(), 1);
  assert.equal(app.get("[data-score-percent]").textContent, "50%");
  assert.equal(app.get("[data-review-list]").innerHTML, "Completed answer review");
});
