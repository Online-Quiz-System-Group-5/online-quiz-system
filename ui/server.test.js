"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, "server.js")], {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    let errors = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`UI server did not start. ${output} ${errors}`));
    }, 5000);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      const match = output.match(/127\.0\.0\.1:(\d+)\//);
      if (!match) return;
      clearTimeout(timeout);
      resolve({
        child,
        baseUrl: `http://127.0.0.1:${match[1]}`,
        stop: () => child.kill()
      });
    });
    child.stderr.on("data", (chunk) => { errors += chunk.toString(); });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`UI server exited with ${code}. ${output} ${errors}`));
      }
    });
  });
}

test("serves the browser UI, styles, scripts, and sample question bank", async (t) => {
  const server = await startServer();
  t.after(() => server.stop());

  const [page, styles, app, core, bank] = await Promise.all([
    fetch(`${server.baseUrl}/`),
    fetch(`${server.baseUrl}/styles.css`),
    fetch(`${server.baseUrl}/app.js`),
    fetch(`${server.baseUrl}/quiz-core.js`),
    fetch(`${server.baseUrl}/questions.txt`)
  ]);

  for (const response of [page, styles, app, core, bank]) assert.equal(response.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);
  assert.match(styles.headers.get("content-type"), /text\/css/);
  assert.match(app.headers.get("content-type"), /javascript/);
  assert.match(core.headers.get("content-type"), /javascript/);
  assert.match(await page.text(), /data-history-open/);
  assert.match(await app.text(), /appendResultHistory/);
  assert.match(await bank.text(), /\|/);
});

test("rejects unsupported methods and paths safely", async (t) => {
  const server = await startServer();
  t.after(() => server.stop());

  const method = await fetch(`${server.baseUrl}/`, { method: "POST" });
  const missing = await fetch(`${server.baseUrl}/missing-file.js`);
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("allow"), "GET, HEAD");
  assert.equal(missing.status, 404);
});
