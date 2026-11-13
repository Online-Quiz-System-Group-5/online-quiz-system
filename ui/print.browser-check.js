"use strict";

// Run with PLAYWRIGHT_MODULE pointing to an installed playwright package.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const os = require("node:os");

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
    const bank = Array.from({ length: 30 }, (_, index) =>
      `Question ${index + 1}: ${"Readable long question text. ".repeat(8)}|Yes|No|1`).join("\n");
    await page.route("**/questions.txt", (route) => route.fulfill({ body: bank }));
    await page.goto(url);
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator("[data-screen]:visible").count(), 0);
    await page.emulateMedia({ media: "screen" });
    await page.locator("[data-question-count]").fill("30");
    await page.locator("[data-start]").click();
    for (let index = 0; index < 30; index++) {
      await page.locator(`[data-option="${index % 2}"]`).click();
      await page.locator("[data-next]").click();
    }
    assert.equal(await page.locator("[data-score-percent]").textContent(), "50%");
    await page.evaluate(() => { window.printCalls = 0; window.print = () => window.printCalls++; });
    await page.locator("[data-print]").click();
    assert.equal(await page.evaluate(() => window.printCalls), 1);
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator("[data-screen]:visible").count(), 1);
    assert.equal(await page.locator(".topbar:visible, .site-footer:visible, .results-actions:visible").count(), 0);
    assert.equal(await page.locator(".review-item:visible").count(), 30);
    const style = await page.locator(".review-item").first().evaluate((el) => ({
      breakInside: getComputedStyle(el).breakInside,
      color: getComputedStyle(el).color,
      fontSize: getComputedStyle(el.querySelector("p")).fontSize,
      fits: el.scrollWidth <= el.clientWidth
    }));
    assert.equal(style.breakInside, "avoid");
    assert.equal(style.color, "rgb(0, 0, 0)");
    assert.ok(parseFloat(style.fontSize) >= 14);
    assert.ok(style.fits);
    for (const format of ["A4", "Letter"]) {
      await page.pdf({ path: path.join(os.tmpdir(), `quiz-print-${format}.pdf`), format, displayHeaderFooter: false });
    }
    await page.emulateMedia({ media: "screen" });
    await page.locator("[data-retry]").click();
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator("[data-screen]:visible").count(), 0);
    assert.deepEqual(errors, []);
    console.log("PASS: completed quiz, native print action, print visibility, legibility, long review, A4/Letter PDFs, and replay privacy");
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
