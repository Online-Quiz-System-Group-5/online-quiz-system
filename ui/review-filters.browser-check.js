"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

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
    await page.addInitScript(() => {
      window.testNow = Date.now();
      Date.now = () => window.testNow;
    });
    await page.route("**/questions.txt", (route) => route.fulfill({
      body: "Correct question|Right|Wrong|1\nIncorrect question|Right|Wrong|1\nTimed question|Right|Wrong|1"
    }));
    await page.goto(url);
    await page.locator("[data-question-count]").fill("3");
    await page.locator("[data-timer-enabled]").check();
    await page.locator("[data-timer-seconds]").fill("5");
    await page.locator("[data-start]").click();
    await page.locator('[data-option="0"]').click();
    await page.locator("[data-next]").click();
    await page.locator('[data-option="1"]').click();
    await page.locator("[data-next]").click();
    await page.evaluate(() => { window.testNow += 6000; });
    await page.waitForTimeout(300);

    assert.equal(await page.locator(".review-item:visible").count(), 3);
    assert.deepEqual(await page.locator("[data-review-filter] span").allTextContents(), ["3", "1", "1"]);

    await page.locator('[data-review-filter="incorrect"]').click();
    assert.equal(await page.locator(".review-item:visible").count(), 1);
    assert.match(await page.locator(".review-item:visible").innerText(), /Incorrect question.*Your answer: Wrong.*Correct answer: Right.*INCORRECT/s);

    await page.locator('[data-review-filter="unanswered"]').click();
    assert.equal(await page.locator(".review-item:visible").count(), 1);
    assert.match(await page.locator(".review-item:visible").innerText(), /Timed question.*Not answered.*Correct answer: Right.*UNANSWERED/s);

    await page.locator("[data-retry]").click();
    for (let index = 0; index < 3; index += 1) {
      await page.locator('[data-option="0"]').click();
      await page.locator("[data-next]").click();
    }
    await page.locator('[data-review-filter="incorrect"]').click();
    assert.equal(await page.locator(".review-item:visible").count(), 0);
    assert.equal(await page.locator("[data-review-empty]").isVisible(), true);
    assert.match(await page.locator("[data-review-empty]").innerText(), /No incorrect answers/);
    assert.deepEqual(errors, []);
    console.log("PASS: all, incorrect, unanswered, correct-answer, empty, and non-empty review filter states");
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
