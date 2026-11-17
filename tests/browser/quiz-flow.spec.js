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

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(dimensions.document, "page should not overflow horizontally").toBeLessThanOrEqual(dimensions.viewport);
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
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "/tmp/quizroom-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "/tmp/quizroom-desktop.png", fullPage: true });
});

test("mobile quiz answers, navigation, review filters, and replay are touch-friendly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await importBank(page, "mobile-session.txt", validBank);
  await page.locator("[data-question-count]").fill("3");
  await page.locator("[data-start]").click();

  await expect(page.locator("[data-screen='quiz']")).toBeVisible();
  await expect(page.locator("[data-next]")).toBeDisabled();
  await expectNoHorizontalOverflow(page);

  const firstAnswer = page.locator('[data-option="0"]');
  await firstAnswer.click();
  await expect(firstAnswer).toHaveAttribute("aria-pressed", "true");
  await expect(firstAnswer).toHaveClass(/selected/);
  await expect(page.locator("[data-next]")).toBeEnabled();
  await expectNoHorizontalOverflow(page);

  await page.locator("[data-next]").click();
  await expect(page.locator("[data-question-prompt]")).toHaveText("What is 2 + 2?");
  await expect(page.locator("[data-next]")).toBeDisabled();
  await page.locator('[data-option="0"]').click();
  await page.locator("[data-next]").click();

  await expect(page.locator("[data-question-prompt]")).toHaveText("What color is a clear daytime sky?");
  await page.locator('[data-option="0"]').click();
  await page.locator("[data-next]").click();

  await expect(page.locator("[data-screen='results']")).toBeVisible();
  await expect(page.locator("[data-score-total]")).toHaveText("3");
  await expectNoHorizontalOverflow(page);

  await page.locator('[data-review-filter="incorrect"]').click();
  await expect(page.locator('[data-review-filter="incorrect"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".review-item:visible")).toHaveCount(1);
  await page.locator('[data-review-filter="all"]').click();
  await expect(page.locator(".review-item:visible")).toHaveCount(3);

  await page.locator("[data-retry]").click();
  await expect(page.locator("[data-screen='quiz']")).toBeVisible();
  await expect(page.locator("[data-question-index]")).toHaveText("01");
  await expect(page.locator("[data-side-answered]")).toHaveText("0 answered");
  await expect(page.locator("[data-next]")).toBeDisabled();
  await expectNoHorizontalOverflow(page);
});
test("base theme, header layout, and result styles remain loaded", async ({ page }) => {
  const theme = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      violet: root.getPropertyValue("--violet").trim(),
      boxSizing: getComputedStyle(document.querySelector(".setup-count input")).boxSizing,
      headerDisplay: getComputedStyle(document.querySelector(".topbar")).display,
      bodyMargin: getComputedStyle(document.body).margin,
      titleColor: getComputedStyle(document.querySelector(".hero-copy h1 span")).color,
      font: getComputedStyle(document.body).fontFamily
    };
  });
  expect(theme.violet).toBe("#6958e8");
  expect(theme.boxSizing).toBe("border-box");
  expect(theme.headerDisplay).toBe("flex");
  expect(theme.bodyMargin).toBe("0px");
  expect(theme.titleColor).toBe("rgb(105, 88, 232)");
  expect(theme.font).toContain("Segoe UI");
  await page.locator("[data-question-count]").fill("1");
  await page.locator("[data-start]").click();
  await page.locator('[data-option="0"]').click();
  await page.locator("[data-next]").click();
  await expect(page.locator(".review-item")).toHaveCSS("display", "grid");
  await expect(page.locator(".score-card").first()).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("keyboard numbers select and Enter submits once, including from a focused answer", async ({ page }) => {
  await importBank(page, "keyboard.txt", validBank);
  await page.locator("[data-question-count]").fill("3");
  await page.locator("[data-start]").click();
  await expect(page.locator("[data-question-prompt]")).toBeFocused();
  await expect(page.locator("[data-keyboard-hint]")).toContainText("Enter");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-question-index]")).toHaveText("01");
  await page.keyboard.press("9");
  await page.keyboard.press("0");
  await expect(page.locator("[data-next]")).toBeDisabled();
  await page.keyboard.press("Control+1");
  await expect(page.locator("[data-next]")).toBeDisabled();
  await page.keyboard.press("1");
  await expect(page.locator('[data-option="0"]')).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-question-index]")).toHaveText("02");
  await expect(page.locator("[data-question-prompt]")).toBeFocused();
  await expect(page.locator("[data-next]")).toBeDisabled();
  await page.locator('[data-option="1"]').focus();
  await page.keyboard.press("Space");
  await expect(page.locator('[data-option="1"]')).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-question-index]")).toHaveText("03");
  await expect(page.locator("[data-next]")).toBeDisabled();
  await page.keyboard.press("1");
  await page.locator("[data-next]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-screen='results']")).toBeVisible();
  await expect(page.locator("[data-score-percent]")).toHaveText("100%");
});

test("help retains native Enter and Escape and blocks quiz shortcuts", async ({ page }) => {
  await importBank(page, "keyboard-dialog.txt", validBank);
  await page.locator("[data-start]").click();
  await page.keyboard.press("1");
  await page.locator("[data-help-open]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-help-dialog]")).toBeVisible();
  await page.keyboard.press("2");
  await expect(page.locator('[data-option="0"]')).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-help-dialog]")).not.toBeVisible();
  await expect(page.locator("[data-question-index]")).toHaveText("01");
  await page.locator("[data-question-prompt]").focus();
  await page.evaluate(() => document.querySelector("[data-question-prompt]").dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, cancelable: true })
  ));
  await expect(page.locator("[data-question-index]")).toHaveText("01");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-question-index]")).toHaveText("02");
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-option="0"]')).toBeFocused();
});
