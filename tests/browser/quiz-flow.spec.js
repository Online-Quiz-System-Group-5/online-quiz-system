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
    if (message.type() === "error") {
      errors.push(
        `console: ${message.text()} | URL: ${message.location().url}`
      );
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() === 404) {
      console.log("404 RESOURCE:", response.url());
    }
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
  await expect(page.locator("[data-start]")).toBeEnabled();
  await expect(page.locator("[data-source-name]")).toHaveText("Astronomy");

  await importBank(page, "recovered-bank.txt", validBank);
  await expect(page.locator("[data-home-error]")).toBeHidden();
  await expect(page.locator("[data-source-name]")).toHaveText("recovered-bank.txt");
  await expect(page.locator("[data-home-count]")).toHaveText("3");
  await expect(page.locator("[data-start]")).toBeEnabled();
});

test("learner selects a topic, completes ten questions, and saves topic metadata", async ({ page }) => {
  await expect(page.locator("[data-topic] option:not([disabled])")).toHaveCount(10);
  await expect(page.getByText("Local session", { exact: true })).toHaveCount(0);
  await page.locator("[data-topic]").selectOption("chemistry");
  await expect(page.locator("[data-source-name]")).toHaveText("Chemistry");
  await expect(page.locator("[data-question-count]")).toHaveValue("10");
  await page.locator("[data-question-count]").fill("11");
  await expect(page.locator("[data-start]")).toBeDisabled();
  await page.locator("[data-question-count]").fill("10");
  await page.locator("[data-start]").click();
  await expect(page.locator("[data-question-prompt]")).toContainText("atomic number");
  for (let i = 0; i < 10; i++) {
    await page.locator('[data-option="0"]').click();
    await page.locator("[data-next]").click();
  }
  await expect(page.locator("[data-score-total]")).toHaveText("10");
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).toContain("Chemistry");
});

test("mobile setup combines timer controls and explains custom uploads", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".timer-setup [data-timer-seconds]")).toBeVisible();
  await expect(page.locator("[data-timer-seconds]")).toBeDisabled();
  await page.locator("[data-timer-enabled]").check();
  await expect(page.locator("[data-timer-seconds]")).toBeEnabled();
  await page.locator("[data-timer-seconds]").fill("5");
  await page.locator("[data-question-count]").fill("1");
  await page.locator("[data-start]").click();
  await expect(page.locator("[data-question-timer]")).toBeVisible();
  await expect(page.locator("[data-screen='results']")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("[data-score-total]")).toHaveText("1");
  await page.locator("[data-home]").first().click();
  await page.locator(".upload-guide summary").click();
  await expect(page.locator(".upload-guide")).toContainText("UTF-8");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download example .txt file" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("question-template.txt");
  await importBank(page, "too-large-quiz.txt", Array.from({length: 12}, (_, i) => `Question ${i}?|A|B|1`).join("\n"));
  await expect(page.locator("[data-question-count]")).toHaveAttribute("max", "10");
  await expect(page.locator("[data-topic]")).toHaveValue("custom");
  await page.locator("[data-topic]").selectOption("sports");
  await expect(page.locator("[data-source-name]")).toHaveText("Sports");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/quizroom-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "/tmp/quizroom-desktop.png", fullPage: true });
});
