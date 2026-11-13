"use strict";

const { test, expect } = require("@playwright/test");

const browserErrors = new WeakMap();

const validBank = [
  "Capital of France?|Paris|Rome|1",
  "What is 2 + 2?|3|4|2",
  "What color is a clear daytime sky?|Blue|Green|1"
].join("\n");

async function importBank(page, name, contents) {
  await page.locator("#question-file").setInputFiles({
    name,
    mimeType: "text/plain",
    buffer: Buffer.from(contents)
  });
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => errors.push(`request: ${request.url()} (${request.failure()?.errorText})`));
  await page.goto("/");
  await expect(page.locator("[data-home-count]")).not.toHaveText("Loading…");
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page), "browser console, page, and network errors").toEqual([]);
});

test("learner imports a bank, completes a quiz, reviews the score, and replays", async ({ page }) => {
  await expect(page.locator("[data-screen='home']")).toBeVisible();
  await importBank(page, "browser-session.txt", validBank);
  await expect(page.locator("[data-source-name]")).toHaveText("browser-session.txt");
  await expect(page.locator("[data-home-count]")).toHaveText("3");

  await page.locator("[data-question-count]").fill("0");
  await expect(page.locator("[data-home-error]")).toContainText("whole number from 1 to 3");
  await expect(page.locator("[data-start]")).toBeDisabled();
  await page.locator("[data-question-count]").fill("3");
  await expect(page.locator("[data-home-error]")).toBeHidden();
  await expect(page.locator("[data-start]")).toBeEnabled();

  await page.locator("[data-start]").click();
  await expect(page.locator("[data-question-prompt]")).toHaveText("Capital of France?");
  await page.locator('[data-option="0"]').click();
  await page.locator("[data-next]").click();
  await expect(page.locator("[data-question-prompt]")).toHaveText("What is 2 + 2?");
  await page.locator('[data-option="0"]').click();
  await page.locator("[data-next]").click();
  await page.locator('[data-option="0"]').click();
  await page.locator("[data-next]").click();

  await expect(page.locator("[data-screen='results']")).toBeVisible();
  await expect(page.locator("[data-score-percent]")).toHaveText("67%");
  await expect(page.locator("[data-score-correct]")).toHaveText("2");
  await expect(page.locator("[data-score-incorrect]")).toHaveText("1");
  await expect(page.locator("[data-score-total]")).toHaveText("3");
  await expect(page.locator(".review-item")).toHaveCount(3);
  await expect(page.locator(".review-item").nth(1)).toContainText("Your answer: 3");
  await expect(page.locator(".review-item").nth(1)).toContainText("Correct answer: 4");

  await page.locator("[data-retry]").click();
  await expect(page.locator("[data-screen='quiz']")).toBeVisible();
  await expect(page.locator("[data-question-prompt]")).toHaveText("Capital of France?");
  await expect(page.locator("[data-side-answered]")).toHaveText("0 answered");
  await expect(page.locator("[data-next]")).toBeDisabled();
});

test("learner recovers after importing invalid question data", async ({ page }) => {
  await importBank(page, "broken-bank.txt", "Broken record|Only one option|1");
  await expect(page.locator("[data-home-error]")).toContainText("No usable questions were found");
  await expect(page.locator("[data-start]")).toBeDisabled();

  await importBank(page, "recovered-bank.txt", validBank);
  await expect(page.locator("[data-home-error]")).toBeHidden();
  await expect(page.locator("[data-source-name]")).toHaveText("recovered-bank.txt");
  await expect(page.locator("[data-home-count]")).toHaveText("3");
  await expect(page.locator("[data-start]")).toBeEnabled();
});
