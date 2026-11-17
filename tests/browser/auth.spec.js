"use strict";
const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const password = "A memorable demo passphrase 2026";
const dialog = page => page.locator("[data-auth-dialog]");
async function openRegister(page) {
  await page.goto("/");
  await page.locator("[data-account-nav]").click();
  await page.locator("[data-auth-toggle]").click();
}
async function register(page, name, email) {
  await openRegister(page);
  await page.getByLabel("Display name", { exact: true }).fill(name);
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.locator("[data-auth-submit]").click();
  await expect(page.locator("[data-profile-name]")).toHaveText(name);
}

test("registration, refresh, logout, invalid login, and returning login work through the UI", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const email = `learner-${randomUUID()}@example.com`;
  await page.goto("/");
  await expect(page.locator("[data-latest-result]")).toBeHidden();
  await page.goto("/profile");
  await expect(page).toHaveURL(/auth=login/);
  await expect(dialog(page)).toBeVisible();
  await page.locator("[data-auth-toggle]").click();
  const refreshed = page.waitForResponse(response => response.url().endsWith("/api/auth/session"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await refreshed;
  await expect(page.locator("[data-name-field]")).toBeVisible();
  await page.locator("[data-auth-submit]").click();
  expect(await page.locator("[data-auth-email]").evaluate(input => input.validity.valueMissing)).toBe(true);
  await expect(page.locator("[data-profile-panel]")).toBeHidden();
  await page.getByLabel("Display name", { exact: true }).fill("Demo Learner");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.locator("[data-profile-name]")).toHaveText("Demo Learner");
  await expect(page.locator("[data-profile-email]")).toHaveText(email);
  await page.screenshot({ path: "/tmp/quiz-auth-profile.png", fullPage: true });
  await page.reload();
  await expect(page.locator("[data-profile-email]")).toHaveText(email);
  const cookies = await page.context().cookies();
  expect(cookies.find(cookie => cookie.name === "quizroom_session")).toMatchObject({ httpOnly: true, sameSite: "Strict" });
  expect(await page.evaluate(() => document.cookie)).not.toContain("quizroom_session");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(password);
  await page.locator("[data-auth-logout]").click();
  await expect(page.locator("[data-auth-status]")).toHaveText("You have signed out.");
  await page.locator("[data-auth-email]").fill(email);
  await page.locator("[data-auth-password]").fill("incorrect password");
  await page.locator("[data-auth-submit]").click();
  await expect(page.locator("[data-auth-error]")).toHaveText("Email or password is incorrect.");
  await page.locator("[data-auth-password]").fill(password);
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-profile-name]")).toHaveText("Demo Learner");
  await page.locator("[data-auth-close]").click();
  await page.goto("/profile");
  await expect(page.locator("[data-profile-email]")).toHaveText(email);
  await expect(page).toHaveURL(/\/profile$/);
  await page.locator("[data-auth-logout]").click();
  expect((await page.request.get("/api/profile")).status()).toBe(401);
  await page.reload();
  await expect(page.locator("[data-account-nav]")).toHaveText("Sign in");
  expect(errors).toEqual([]);
});

test("two users have isolated profiles, duplicate registration is rejected, and mobile auth fits", async ({ page, browser }) => {
  const emailA = `alice-${randomUUID()}@example.com`;
  const emailB = `bob-${randomUUID()}@example.com`;
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page, "Alice", emailA);
  const alice = (await (await page.request.get("/api/profile")).json()).user;
  const other = await browser.newContext();
  try {
    const second = await other.newPage();
    await second.setViewportSize({ width: 390, height: 844 });
    await openRegister(second);
    await second.locator("[data-auth-name]").fill("Duplicate");
    await second.locator("[data-auth-email]").fill(emailA);
    await second.locator("[data-auth-password]").fill(password);
    await second.locator("[data-auth-submit]").click();
    await expect(second.locator("[data-auth-error]")).toContainText("already uses this email");
    await second.locator("[data-auth-name]").fill("Bob");
    await second.locator("[data-auth-email]").fill(emailB);
    await second.locator("[data-auth-password]").fill(password);
    await second.locator("[data-auth-submit]").click();
    await expect(second.locator("[data-profile-name]")).toHaveText("Bob");
    const bob = (await (await second.request.get(`/api/profile?userId=${alice.id}`)).json()).user;
    expect(bob.email).toBe(emailB);
    expect(bob.id).not.toBe(alice.id);
    expect((await second.request.get(`/api/profile/${alice.id}`)).status()).toBe(404);
    await expect(page.locator("[data-profile-email]")).toHaveText(emailA);
    expect(await second.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await second.screenshot({ path: "/tmp/quiz-auth-mobile.png", fullPage: true });
    await second.locator("[data-auth-close]").click();
    await second.locator("[data-account-nav]").focus();
    await second.keyboard.press("Enter");
    await expect(dialog(second)).toBeVisible();
    await second.keyboard.press("Escape");
    await expect(dialog(second)).not.toBeVisible();
    await expect(second.locator("[data-account-nav]")).toBeFocused();
  } finally { await other.close(); }
});
