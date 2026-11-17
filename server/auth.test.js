"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { request: httpRequest } = require("node:http");
const { createAuth } = require("./auth");
const { createServer } = require("../ui/server");
const password = "A long demo passphrase 2026";

async function fixture(t, options = {}) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "quiz-auth-"));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  const auth = await createAuth({ dataDir, ...options });
  const server = createServer(auth);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(route, body, cookie, extra = {}) {
    return fetch(base + route, {
      method: body === undefined ? "GET" : "POST", redirect: "manual",
      headers: { Origin: base, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...extra },
      ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) })
    });
  }
  return { auth, dataDir, request, base };
}
function cookie(response) { return response.headers.get("set-cookie").split(";")[0]; }

test("accounts use salted hashes, login rotates sessions, profiles are isolated, and logout revokes", async t => {
  const { request, dataDir } = await fixture(t);
  assert.equal((await request("/api/profile")).status, 401);
  let response = await request("/api/auth/register", { name: "Alice", email: " Alice@Example.com ", password });
  assert.equal(response.status, 201);
  const aliceCookie = cookie(response);
  const alice = (await response.json()).user;
  assert.equal(alice.email, "alice@example.com");
  assert.equal(alice.password, undefined);
  assert.match(response.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  assert.match(response.headers.get("cache-control"), /no-store/);
  response = await request("/api/auth/register", { name: "Bob", email: "bob@example.com", password });
  const bobCookie = cookie(response);
  const bob = (await response.json()).user;
  assert.notEqual(alice.id, bob.id);
  response = await request(`/api/profile?userId=${bob.id}`, undefined, aliceCookie);
  assert.deepEqual((await response.json()).user, alice);
  assert.deepEqual((await (await request("/api/profile", undefined, bobCookie)).json()).user, bob);
  assert.equal((await request(`/api/profile/${alice.id}`, undefined, bobCookie)).status, 404);
  assert.equal((await request("/profile")).status, 302);
  assert.equal((await request("/profile", undefined, aliceCookie)).status, 200);
  assert.equal((await request("/api/profile", undefined, "quizroom_session=" + "0".repeat(64))).status, 401);
  const saved = await fs.readFile(path.join(dataDir, "accounts.json"), "utf8");
  assert.equal(saved.includes(password), false);
  assert.equal(saved.includes(aliceCookie.split("=")[1]), false);
  const users = JSON.parse(saved).users;
  assert.equal(users[0].password.algorithm, "scrypt");
  assert.notEqual(users[0].password.salt, users[1].password.salt);
  assert.notEqual(users[0].password.hash, users[1].password.hash);
  assert.equal((await fs.stat(path.join(dataDir, "accounts.json"))).mode & 0o777, 0o600);
  response = await request("/api/auth/login", { email: "alice@example.com", password: "wrong" });
  assert.equal(response.status, 401);
  const invalidMessage = await response.json();
  response = await request("/api/auth/login", { email: "unknown@example.com", password: "wrong" });
  assert.deepEqual(await response.json(), invalidMessage);
  response = await request("/api/auth/login", { email: "ALICE@example.com", password }, aliceCookie);
  const renewed = cookie(response);
  assert.notEqual(renewed, aliceCookie);
  assert.equal((await request("/api/profile", undefined, aliceCookie)).status, 401);
  response = await request("/api/auth/logout", {}, renewed);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await request("/api/profile", undefined, renewed)).status, 401);
  assert.equal((await request("/api/profile", undefined, bobCookie)).status, 200);
});

test("input validation, duplicate email, CSRF, request limits, and private files", async t => {
  const { request, base } = await fixture(t);
  for (const body of [{}, { email: "bad", password }, { name: "A", email: "a@example.com", password: "short" }, { name: " ", email: "a@example.com", password }, [], null]) {
    assert.equal((await request("/api/auth/register", body)).status, 400);
  }
  const account = { name: "A", email: "a@example.com", password };
  assert.equal((await request("/api/auth/register", account)).status, 201);
  assert.equal((await request("/api/auth/register", account)).status, 409);
  assert.equal((await request("/api/auth/register", account, null, { Origin: "https://evil.example" })).status, 403);
  assert.equal((await request("/api/auth/login", "{bad")).status, 400);
  const hostileHostStatus = await new Promise((resolve, reject) => {
    const req = httpRequest(base + "/api/auth/session", { headers: { Host: "evil.example" } }, response => {
      response.resume();
      resolve(response.statusCode);
    });
    req.on("error", reject);
    req.end();
  });
  assert.equal(hostileHostStatus, 403);
  assert.equal((await request("/api/auth/login", "x".repeat(9000))).status, 413);
  assert.equal((await request("/api/auth/login", account, null, { "Content-Type": "text/plain" })).status, 415);
  assert.equal((await request("/.quiz-data/accounts.json")).status, 404);
  assert.equal((await request("/server/auth.js")).status, 404);
  assert.equal((await request("/api/profile", undefined, "quizroom_session=malformed")).status, 401);
});

test("accounts and sessions survive a server restart; expired sessions cannot access profiles", async t => {
  let time = Date.now();
  const { request, dataDir } = await fixture(t, { now: () => time });
  const response = await request("/api/auth/register", { name: "Persistent", email: "persist@example.com", password });
  const sessionCookie = cookie(response);
  const restarted = await createAuth({ dataDir, now: () => time });
  const fakeRequest = { headers: { cookie: sessionCookie }, socket: { remoteAddress: "test" } };
  assert.equal(restarted.current(fakeRequest).email, "persist@example.com");
  await restarted.logout(fakeRequest);
  const loggedIn = await restarted.login({ email: "persist@example.com", password }, { headers: {}, socket: { remoteAddress: "test" } });
  fakeRequest.headers.cookie = `quizroom_session=${loggedIn.token}`;
  assert.equal(restarted.current(fakeRequest).name, "Persistent");
  time += 8 * 24 * 60 * 60 * 1000;
  assert.equal(restarted.current(fakeRequest), null);
  assert.match(restarted.cookie("", true), /Max-Age=0/);
  const secure = await createAuth({ dataDir, secureCookies: true });
  assert.match(secure.cookie("test"), /; Secure$/);
});

test("concurrent registration does not overwrite accounts or create duplicate emails", async t => {
  const { request, dataDir } = await fixture(t);
  const accounts = ["one", "two"];
  const responses = await Promise.all(accounts.map(name => request("/api/auth/register", { name, email: `${name}@example.com`, password })));
  assert.deepEqual(responses.map(r => r.status), [201, 201]);
  assert.equal(JSON.parse(await fs.readFile(path.join(dataDir, "accounts.json"))).users.length, 2);
  const duplicate = await Promise.all([1, 2].map(() => request("/api/auth/register", { name: "Same", email: "same@example.com", password })));
  assert.deepEqual(duplicate.map(r => r.status).sort(), [201, 409]);
});

test("rate limits reject repeated attempts and unreadable stores fail closed", async t => {
  let time = Date.now();
  const { request, dataDir } = await fixture(t, { now: () => time });
  for (let i = 0; i < 20; i++) assert.equal((await request("/api/auth/login", {})).status, 400);
  assert.equal((await request("/api/auth/login", {})).status, 429);
  time += 16 * 60 * 1000;
  assert.equal((await request("/api/auth/login", {})).status, 400);
  await fs.writeFile(path.join(dataDir, "accounts.json"), "broken store");
  await assert.rejects(createAuth({ dataDir }));
  assert.equal(await fs.readFile(path.join(dataDir, "accounts.json"), "utf8"), "broken store");
});
