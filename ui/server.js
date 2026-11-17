"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const { createAuth, AuthError } = require("../server/auth.js");

const uiRoot = __dirname;
const questionBankPath = path.resolve(uiRoot, "../data/questions.txt");
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function json(response, status, body, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  response.end(JSON.stringify(body));
}
async function readBody(request) {
  if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json") throw new AuthError(415, "Send JSON data.");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    chunks.push(chunk);
    if (size > 8192) throw new AuthError(413, "Request is too large.");
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AuthError(400, "Invalid JSON data."); }
}

function createServer(auth) {
return http.createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "same-origin");
  response.setHeader("X-Frame-Options", "DENY");
  let url;
  try {
    url = new URL(request.url, "http://localhost");
    const host = new URL(`http://${request.headers.host}`).hostname;
    if (!["127.0.0.1", "localhost", "[::1]"].includes(host)) return json(response, 403, { error: "Host is not allowed." });
  } catch { return json(response, 400, { error: "Invalid request URL." }); }
  if (url.pathname.startsWith("/api/")) {
    try {
      if (request.method === "GET" && url.pathname === "/api/auth/session") {
        return json(response, 200, { user: auth.current(request) });
      }
      if (request.method === "GET" && url.pathname === "/api/profile") {
        const user = auth.current(request);
        if (!user) throw new AuthError(401, "Sign in to view your profile.");
        // Identity comes only from the validated session, never a query or body ID.
        return json(response, 200, { user });
      }
      if (request.method !== "POST" || !["/api/auth/register", "/api/auth/login", "/api/auth/logout"].includes(url.pathname)) {
        return json(response, 404, { error: "Endpoint not found." });
      }
      const protocol = request.socket.encrypted ? "https" : "http";
      if (request.headers.origin !== `${protocol}://${request.headers.host}`) throw new AuthError(403, "Request origin is not allowed.");
      if (url.pathname === "/api/auth/logout") {
        await auth.logout(request);
        return json(response, 200, { user: null }, { "Set-Cookie": auth.cookie("", true) });
      }
      const body = await readBody(request);
      const result = url.pathname.endsWith("register") ? await auth.register(body, request) : await auth.login(body, request);
      return json(response, url.pathname.endsWith("register") ? 201 : 200, { user: result.user }, { "Set-Cookie": auth.cookie(result.token) });
    } catch (error) {
      return json(response, error instanceof AuthError ? error.status : 500, { error: error instanceof AuthError ? error.message : "Unable to complete your request. Please try again." });
    }
  }
  if (url.pathname === "/profile" || url.pathname === "/profile/") {
    if (!auth.current(request)) {
      response.writeHead(302, { Location: "/?auth=login", "Cache-Control": "no-store" });
      return response.end();
    }
    response.setHeader("Cache-Control", "no-store");
    request.url = "/";
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method not allowed");
    return;
  }

  let requestedPath;
  try {
    requestedPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad request");
    return;
  }

  const filePath = requestedPath === "/questions.txt"
    ? questionBankPath
    : path.resolve(uiRoot, `.${requestedPath === "/" ? "/index.html" : requestedPath}`);
  if (requestedPath !== "/questions.txt" && !filePath.startsWith(`${uiRoot}${path.sep}`)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : contents);
  });
});
}

const requestedPort = Number(process.env.PORT || 4173);

async function start() {
  const auth = await createAuth({
    dataDir: path.resolve(process.env.QUIZ_DATA_DIR || path.join(__dirname, "../.quiz-data")),
    secureCookies: process.env.QUIZ_SECURE_COOKIES === "1"
  });
  const server = createServer(auth);
  function listen(port) {
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE" && !process.env.PORT) return listen(port + 1);
      throw error;
    });
    server.listen(port, "127.0.0.1", () => {
      process.stdout.write(`Quizroom UI ready at http://127.0.0.1:${server.address().port}/\n`);
    });
  }
  listen(requestedPort);
}
if (require.main === module) start().catch(() => {
  process.stderr.write("Unable to start Quizroom. Check the account data directory and permissions.\n");
  process.exitCode = 1;
});
module.exports = { createServer };
