"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } = require("node:crypto");
const { promisify } = require("node:util");
const deriveKey = promisify(scrypt);
const SCRYPT = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
const COOKIE = "quizroom_session";

class AuthError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}
function digest(token) { return createHash("sha256").update(token).digest("hex"); }
function sessionToken(request) {
  const token = (request.headers.cookie || "").split(";").map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
function credentials(body, registering) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AuthError(400, "Enter your email address and password.");
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError(400, "Enter a valid email address.");
  if (!password || password.length > 128 || (registering && password.length < 15)) throw new AuthError(400, registering ? "Use a password between 15 and 128 characters." : "Enter your password (up to 128 characters).");
  if (registering && (!name || name.length > 80)) throw new AuthError(400, "Enter a display name between 1 and 80 characters.");
  return { email, password, name };
}

// One local Node server owns this store. Never place it inside the public ui directory.
async function createAuth({ dataDir, now = Date.now, secureCookies = false }) {
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
  const storePath = path.join(dataDir, "accounts.json");
  let data;
  try {
    data = JSON.parse(await fs.readFile(storePath, "utf8"));
    if (data.version !== 1 || !Array.isArray(data.users) || !Array.isArray(data.sessions)) throw new Error("Invalid account store");
  } catch (error) {
    if (error.code !== "ENOENT") throw error; // Fail closed; never overwrite unreadable accounts.
    data = { version: 1, users: [], sessions: [] };
  }
  let queue = Promise.resolve();
  function transaction(change) {
    const operation = queue.then(async () => {
      const next = structuredClone(data);
      next.sessions = next.sessions.filter(s => s.expiresAt > now());
      const result = change(next);
      const temporary = `${storePath}.${randomBytes(8).toString("hex")}.tmp`;
      try {
        await fs.writeFile(temporary, JSON.stringify(next), { mode: 0o600, flag: "wx" });
        await fs.rename(temporary, storePath);
      } finally { await fs.rm(temporary, { force: true }); }
      data = next;
      return result;
    });
    queue = operation.catch(() => {});
    return operation;
  }
  const dummySalt = randomBytes(16).toString("hex");
  const attempts = new Map();
  let hashing = 0;
  async function hash(password, salt) {
    if (hashing >= 2) throw new AuthError(503, "Sign-in is busy. Please try again shortly.");
    hashing++;
    try { return await deriveKey(password, salt, 64, SCRYPT); }
    finally { hashing--; }
  }
  function limit(ip) {
    const time = now();
    for (const [key, entry] of attempts) if (entry.until <= time) attempts.delete(key);
    const entry = attempts.get(ip) || { count: 0, until: time + 15 * 60 * 1000 };
    if (++entry.count > 20) throw new AuthError(429, "Too many sign-in attempts. Try again in 15 minutes.");
    attempts.set(ip, entry);
  }
  function current(request) {
    const token = sessionToken(request);
    if (!token) return null;
    const session = data.sessions.find(s => s.hash === digest(token) && s.expiresAt > now());
    const user = session && data.users.find(u => u.id === session.userId);
    return user ? publicUser(user) : null;
  }
  function cookie(token, clear = false) {
    return `${COOKIE}=${clear ? "" : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_AGE / 1000}${secureCookies ? "; Secure" : ""}`;
  }
  function startSession(next, userId, previousToken) {
    if (previousToken) next.sessions = next.sessions.filter(s => s.hash !== digest(previousToken));
    const token = randomBytes(32).toString("hex");
    // Bound retained sessions per account without storing bearer tokens on disk.
    const existing = next.sessions.filter(s => s.userId === userId).slice(-9);
    next.sessions = next.sessions.filter(s => s.userId !== userId).concat(existing);
    next.sessions.push({ hash: digest(token), userId, expiresAt: now() + SESSION_AGE });
    return token;
  }
  async function register(body, request) {
    limit(request.socket.remoteAddress);
    const input = credentials(body, true);
    const salt = randomBytes(16).toString("hex");
    const passwordHash = (await hash(input.password, salt)).toString("hex");
    return transaction(next => {
      if (next.users.some(u => u.email === input.email)) throw new AuthError(409, "An account already uses this email. Sign in instead.");
      const user = { id: randomUUID(), name: input.name, email: input.email, createdAt: new Date(now()).toISOString(), password: { algorithm: "scrypt", N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, salt, hash: passwordHash } };
      next.users.push(user);
      return { user: publicUser(user), token: startSession(next, user.id, sessionToken(request)) };
    });
  }
  async function login(body, request) {
    limit(request.socket.remoteAddress);
    const input = credentials(body, false);
    const user = data.users.find(u => u.email === input.email);
    const actual = await hash(input.password, user?.password.salt || dummySalt);
    const expected = user ? Buffer.from(user.password.hash, "hex") : Buffer.alloc(64);
    if (!timingSafeEqual(actual, expected) || !user) throw new AuthError(401, "Email or password is incorrect.");
    return transaction(next => ({ user: publicUser(user), token: startSession(next, user.id, sessionToken(request)) }));
  }
  async function logout(request) {
    const token = sessionToken(request);
    if (token) await transaction(next => { next.sessions = next.sessions.filter(s => s.hash !== digest(token)); });
  }
  return { current, cookie, register, login, logout };
}
module.exports = { createAuth, AuthError };
