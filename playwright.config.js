
"use strict";

const { defineConfig, devices } = require("@playwright/test");

const projects = process.env.CI
  ? [
      {
        name: "chrome",
        use: { ...devices["Desktop Chrome"], channel: "chrome" }
      },
      {
        name: "edge",
        use: { ...devices["Desktop Edge"], channel: "msedge" }
      },
      {
        name: "firefox",
        use: { ...devices["Desktop Firefox"] }
      }
    ]
  : [
      {
        name: "chrome",
        use: { ...devices["Desktop Chrome"], channel: "chrome" }
      }
    ];

module.exports = defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure"
  },
  projects,
  webServer: {
    command: "node ui/server.js",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  }
});
