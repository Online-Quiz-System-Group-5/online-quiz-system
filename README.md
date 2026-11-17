# Group 5 Online Quiz System

A local multiple-choice quiz project for Group 5's allocated Problem Statement 14. The project includes the original C++17 command-line application and a browser-based interface that follows the same question-bank format and scoring rules.

## Features

- C++17 command-line quiz with question-bank validation and replay.
- Local account registration, sign-in/out, and session-protected profiles.
- Responsive browser UI with welcome, quiz, result, answer-review, and help screens.
- Load the sample bank or import another UTF-8 `.txt` question bank.
- Answer selection by mouse or number keys, progress display, safe exit, and replay.
- Automatic score calculation without revealing the answer key during the quiz.
- Local quiz history with the latest 20 score summaries and a clear-history control.
- Print completed results and answer review, or save them as a PDF using the browser print dialog.
- Filter answer review to incorrect or unanswered questions.
- C++ and browser-core unit/integration tests.

## Topics and quiz setup

Choose Astronomy, Politics & Civics, History, Geography, Physics, Chemistry,
Biology, Technology, Literature, or Sports. Each built-in topic contains 10
questions in `ui/topics.json`; choose 1–10 per quiz and optionally shuffle them.
Enable the per-question timer and choose 5–120 seconds in the same control.
Topic names are included in saved result metadata and history.

Use **Change file** to upload a UTF-8 `.txt` bank up to 5 MB. The file format
guide beside the control includes a downloadable example. Larger custom banks
are supported, but each quiz is limited to 10 questions. An unusable import
keeps the previously loaded bank available.

## Question-bank format

Each non-empty line contains the question, at least two options, and a one-based correct-option number, separated by `|`:

```text
Question text|Option one|Option two|Option three|2
```

The delimiter cannot appear inside a field. Blank lines are ignored. The C++ loader rejects empty prompts/options, invalid answer keys, missing files, empty banks, and records over 64 KiB.

## Run the command-line app

Requires a C++17 compiler. From the repository root:

```sh
g++ -std=c++17 -Wall -Wextra -Wpedantic -Iinclude src/main.cpp src/quiz.cpp -o online_quiz
./online_quiz
```

Pass an alternate question bank as the first argument:

```sh
./online_quiz data/questions.txt
```

## Run the web UI

Requires Node.js 18 or later. From the repository root:

```sh
node ui/server.js
```

Open <http://127.0.0.1:4173/>. The server binds only to the local computer, serves the UI files, and provides the existing sample bank at `/questions.txt`. Imported question banks and answers remain in the browser session. Accounts and sessions are stored by the local Node server; no remote identity service is required.

## Accounts and profiles (issue #72)

Use **Sign in → Create an account** to register a display name, email address,
and password. Passwords must contain 15–128 characters; spaces and passphrases
are supported. Registration signs the user in. **My profile** shows only the
session owner's name, email, and registration date; **Sign out** revokes that
session. `/profile` redirects guests to sign-in. Quiz-taking remains available
to guests.

Accounts and sessions persist across refreshes and server restarts in
`.quiz-data/accounts.json`, outside the public UI folder and ignored by Git.
The directory uses owner-only permissions and account files are written
atomically with mode 0600. Run **one server process per data directory**; this
small local JSON store is not a multi-process database. Back up this private
folder to retain accounts. If it is unreadable, the server refuses to start
rather than overwriting it.

Passwords use Node's asynchronous scrypt with a unique 16-byte random salt
(`N=32768, r=8, p=3`), following an
[OWASP scrypt configuration](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt).
Only password hashes are saved. Sessions use random 32-byte bearer tokens in
HttpOnly, SameSite=Strict cookies, with only their SHA-256 digests stored on the
server. Sessions expire after seven days, rotate on login, and are revoked on
logout. Mutations require a same-origin Origin header; registration/login
require JSON. Auth requests are size-limited and sign-in attempts are limited
to 20 per IP in 15 minutes. These rate limits are in memory and reset when the
server restarts.

The default server binds only to `127.0.0.1` for local HTTP use. For an HTTPS
adaptation, enable Secure cookies with `QUIZ_SECURE_COOKIES=1`; hosting publicly
also requires proper HTTPS/origin configuration and a production datastore.
This implementation does not include password reset, email verification,
social login, or profile editing. Emails are identifiers, not verified ownership.

**Quiz history and latest results remain browser-wide, device-local summaries.**
They are not account-private or synchronized. Signing out changes account/profile
access, not these existing guest features.

To isolate test accounts or choose another private storage directory:

```sh
QUIZ_DATA_DIR=/tmp/quiz-demo-accounts PORT=4188 node ui/server.js
```

Profiles are protected on the server by session identity; supplying another user
ID in a URL cannot select that user's profile. `GET /api/auth/session` returns
the current public user or null; `GET /api/profile` requires authentication.
`POST /api/auth/register`, `/api/auth/login`, and `/api/auth/logout` manage the
session. Credentials, hashes, salts, and session tokens are never included in
public profile responses.

## Tests

Build and run the C++ unit/integration harness:

```sh
g++ -std=c++17 -Wall -Wextra -Wpedantic -Iinclude tests/quiz_tests.cpp src/quiz.cpp -o quiz_tests
./quiz_tests
bash tests/cli_tests.sh
```

Run UI unit tests and server authentication/integration tests with Node.js:

```sh
npm run test:unit
```

Install the pinned browser-test dependency and run the full browser journey:

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

The browser suite starts the local UI server automatically and verifies question-bank
import, invalid-input recovery, quiz start and answers, scoring, answer review, and replay.
CI installs the same locked dependency and runs the suite in Chromium.

Run the history unit and browser checks with Node.js and Playwright:

```sh
node --test ui/history.test.js
PLAYWRIGHT_MODULE=/path/to/playwright PLAYWRIGHT_CHANNEL=chrome node ui/history.browser-check.js
```

History uses browser local storage and saves only date, question bank name, score, and
question count. It does not save questions or answers. Clearing history does not
clear the separate latest-result card.

Check printing in Chromium (requires Playwright test tooling):

```sh
npm install --prefix /tmp/quiz-browser-tools --no-save --package-lock=false playwright@1.64.1
/tmp/quiz-browser-tools/node_modules/.bin/playwright install chromium
PLAYWRIGHT_MODULE=/tmp/quiz-browser-tools/node_modules/playwright node ui/print.browser-check.js
```

The browser check completes a mixed-score quiz, verifies print-only results and review,
and writes A4 and Letter PDFs to the system temporary directory. To inspect manually,
complete a quiz and choose **Print results / Save PDF**. Check that navigation and
buttons are absent, all answers are readable, and review entries stay together across
pages. Browser-generated headers and footers can be disabled in the print dialog.
Native printing from the home screen or during a quiz prints no quiz content.

Run the review-filter browser check with Playwright:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright PLAYWRIGHT_CHANNEL=chrome node ui/review-filters.browser-check.js
```

GitHub Actions builds the C++ app and tests and runs the existing UI core tests on pushes and pull requests. Run the history, print, and review-filter browser checks with the commands above before requesting review.
