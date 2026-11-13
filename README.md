# Group 5 Online Quiz System

A local multiple-choice quiz project for Group 5's allocated Problem Statement 14. The project includes the original C++17 command-line application and a browser-based interface that follows the same question-bank format and scoring rules.

## Features

- C++17 command-line quiz with question-bank validation and replay.
- Responsive browser UI with welcome, quiz, result, answer-review, and help screens.
- Load the sample bank or import another UTF-8 `.txt` question bank.
- Answer selection by mouse or number keys, progress display, safe exit, and replay.
- Automatic score calculation without revealing the answer key during the quiz.
- Local quiz history with the latest 20 score summaries and a clear-history control.
- C++ and browser-core unit/integration tests.

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

Open <http://127.0.0.1:4173/>. The server binds only to the local computer, serves the UI files, and provides the existing sample bank at `/questions.txt`. Imported question banks and answers remain in the browser session; the UI has no account or remote service.

## Tests

Build and run the C++ unit/integration harness:

```sh
g++ -std=c++17 -Wall -Wextra -Wpedantic -Iinclude tests/quiz_tests.cpp src/quiz.cpp -o quiz_tests
./quiz_tests
bash tests/cli_tests.sh
```

Run UI parsing/scoring tests with Node.js:

```sh
node --test ui/quiz-core.test.js
```

Run the history unit and browser checks with Node.js and Playwright:

```sh
node --test ui/history.test.js
PLAYWRIGHT_MODULE=/path/to/playwright PLAYWRIGHT_CHANNEL=chrome node ui/history.browser-check.js
```

History uses browser local storage and saves only date, question bank name, score, and
question count. It does not save questions or answers. Clearing history does not
clear the separate latest-result card.

GitHub Actions builds the C++ app and tests and runs the UI unit tests on pushes and pull requests.
