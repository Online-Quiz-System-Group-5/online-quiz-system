"use strict";

const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const path = require("node:path");

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    env: { ...process.env, PORT: "0" }, stdio: ["ignore", "pipe", "inherit"]
  });
  let browser;
  try {
    const [output] = await once(server.stdout, "data");
    const url = output.toString().match(/http:\/\/[^\s]+/)[0];
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/questions.txt", (route) => route.fulfill({ body: "Question?|Yes|No|1" }));
    await page.goto(url);
    await page.locator("[data-history-open]").first().click();
    assert.equal(await page.locator("[data-history-empty]").isVisible(), true);
    await page.locator("[data-history-back]").click();
    await page.locator("[data-start]").click();
    assert.equal(await page.locator("[data-history-nav]").isVisible(), false);
    await page.locator('[data-option="0"]').click();
    await page.locator("[data-next]").click();
    await page.locator("[data-history-open]").first().click();
    assert.equal(await page.locator(".history-entry").count(), 1);
    assert.match(await page.locator(".history-entry").innerText(), /Sample question bank.*100%.*1 of 1 correct.*1 questions/s);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("quizroom.history.v1")));
    assert.deepEqual(Object.keys(stored[0]).sort(), ["bankLabel", "correct", "date", "percentage", "total"]);
    await page.locator("[data-history-clear]").click();
    assert.equal(await page.locator("[data-history-empty]").isVisible(), true);
    assert.equal(await page.locator(".history-entry").count(), 0);
    await page.evaluate(() => localStorage.setItem("quizroom.history.v1", "damaged"));
    await page.reload();
    await page.locator("[data-history-open]").first().click();
    assert.match(await page.locator("[data-history-warning]").innerText(), /damaged/);
    await page.evaluate(() => {
      const entries = Array.from({ length: 20 }, (_, index) => ({
        correct: 1, total: 1, percentage: 100,
        date: new Date(2026, 0, index + 1).toISOString(), bankLabel: `Bank ${index}`
      }));
      localStorage.setItem("quizroom.history.v1", JSON.stringify(entries));
    });
    await page.reload();
    await page.locator("[data-history-open]").first().click();
    assert.equal(await page.locator(".history-entry").count(), 20);
    assert.equal(await page.locator("[data-history-full]").isVisible(), true);
    assert.deepEqual(errors, []);
    console.log("PASS: empty, completed, metadata-only, clear, corrupt, and full history browser states");
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
