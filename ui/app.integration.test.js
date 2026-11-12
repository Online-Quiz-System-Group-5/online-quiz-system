"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const QuizCore = require("./quiz-core.js");

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

class FakeElement {
  constructor(selector, document) {
    this.selector = selector;
    this.document = document;
    this.listeners = new Map();
    this.attributes = new Map();
    this.style = { setProperty() {} };
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = "";
    this.textContent = "";
    this._innerHTML = "";
    this.classList = {
      toggle() {},
      add() {},
      remove() {}
    };
  }

  set innerHTML(value) {
    this._innerHTML = value;
    if (this.selector === "[data-options]") {
      const indices = [...value.matchAll(/data-option="(\d+)"/g)].map((match) => Number(match[1]));
      this.document.options = indices.map((index) => {
        const option = new FakeElement(`[data-option="${index}"]`, this.document);
        option.dataset.option = String(index);
        return option;
      });
    }
  }

  get innerHTML() { return this._innerHTML; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, callback) {
    const callbacks = this.listeners.get(name) || [];
    callbacks.push(callback);
    this.listeners.set(name, callbacks);
  }
  dispatch(name, extra = {}) {
    for (const callback of this.listeners.get(name) || []) {
      callback({ currentTarget: this, target: this, ...extra });
    }
  }
  showModal() { this.open = true; }
  close() { this.open = false; }
}

function createDocument() {
  const elements = new Map();
  const document = {
    options: [],
    screens: ["home", "quiz", "results", "history"].map((name) => {
      const screen = new FakeElement(`[data-screen='${name}']`, null);
      screen.dataset.screen = name;
      return screen;
    }),
    querySelector(selector) {
      if (selector === "[data-screen='home']") return this.screens[0];
      if (selector === "[data-screen='quiz']") return this.screens[1];
      if (selector === "[data-screen='results']") return this.screens[2];
      if (selector === "[data-screen='history']") return this.screens[3];
      if (!elements.has(selector)) elements.set(selector, new FakeElement(selector, this));
      return elements.get(selector);
    },
    querySelectorAll(selector) {
      if (selector === "[data-screen]") return this.screens;
      if (selector === "[data-option]") return this.options;
      if (selector === "[data-home]") return [this.querySelector("[data-brand-home]"), this.querySelector("[data-results-home]")];
      if (selector === "[data-quit]") return [this.querySelector("[data-quit-main]"), this.querySelector("[data-quit-side]")];
      if (selector === "[data-help-close]") return [this.querySelector("[data-help-close]")];
      if (selector === "[data-history-open]") return [this.querySelector("[data-history-nav]"), this.querySelector("[data-history-card]")];
      if (selector === "[data-history-home]") return [this.querySelector("[data-history-back]"), this.querySelector("[data-history-empty-back]")];
      return [];
    },
    addEventListener() {}
  };
  document.screens.forEach((screen) => { screen.document = document; });
  return document;
}

test("UI app runs a quiz, stores metadata, and shows and clears history", async () => {
  const document = createDocument();
  const storage = new MemoryStorage();
  const window = {
    QuizCore,
    localStorage: storage,
    scrollTo() {},
    confirm: () => true
  };
  const context = {
    document,
    window,
    fetch: async () => ({ ok: true, text: async () => "First?|A|B|1\nSecond?|C|D|2\nThird?|E|F|1" }),
    setTimeout: () => 1,
    clearTimeout() {},
    console,
    Date,
    Number,
    Math
  };

  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "app.js"), "utf8"), context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(document.querySelector("[data-home-count]").textContent, 3);

  document.querySelector("[data-question-count]").value = "2";
  document.querySelector("[data-start]").dispatch("click");
  assert.equal(document.screens[1].hidden, false);
  assert.match(document.querySelector("[data-question-prompt]").textContent, /First/);

  document.options[0].dispatch("click");
  document.querySelector("[data-next]").dispatch("click");
  assert.match(document.querySelector("[data-question-prompt]").textContent, /Second/);
  document.options[1].dispatch("click");
  document.querySelector("[data-next]").dispatch("click");

  assert.equal(document.screens[2].hidden, false);
  assert.equal(document.querySelector("[data-score-percent]").textContent, "100%");
  assert.deepEqual([...storage.values.keys()].sort(), ["quizroom.latest-result.v1", "quizroom.result-history.v1"]);
  assert.equal(JSON.stringify([...storage.values.values()]).includes("answers"), false);

  document.querySelector("[data-history-nav]").dispatch("click");
  assert.equal(document.screens[3].hidden, false);
  assert.match(document.querySelector("[data-history-list]").innerHTML, /Sample question bank/);
  document.querySelector("[data-history-clear]").dispatch("click");
  assert.equal(document.querySelector("[data-history-empty]").hidden, false);
});
