# Sprint 2 Acceptance Review

- Review date: 2026-11-12
- Evidence updated: 2026-11-12
- Reviewer: Maaya
- SRS version: Baseline v0.2
- Commit reviewed: Pending final release commit

## Functional requirements

| Requirement ID | Test case | Behavior checked | Result | Evidence | Defect issue/PR |
|---|---|---|---|---|---|
| OQS-F-001 | TC-UI-01 | Console menu / user interface | PASS | `bash tests/cli_tests.sh` — welcome, invalid-menu recovery, and exit flow | |
| OQS-F-002 | TC-LOAD-01 | Question-bank loader | PASS | `./quiz_tests` — valid question records load successfully | |
| OQS-F-003 | TC-LOAD-02 | Question-bank parser and validator | PASS | `./quiz_tests` — malformed question data, empty options, and incomplete records are rejected | |
| OQS-F-004 | TC-LOAD-03 | Question-bank loading / startup error handling | PASS | `./quiz_tests` — missing and empty question banks are rejected; invalid answer keys prevent quiz startup | |
| OQS-F-005 | TC-QUIZ-01 | Quiz session display | PASS | `./quiz_tests` — prompt options are displayed with one-based numbering | |
| OQS-F-006 | TC-INPUT-01 | Input handler | PASS | `./quiz_tests` — valid choices complete a session after invalid-input retries | |
| OQS-F-007 | TC-INPUT-02 | Input validation | PASS | `./quiz_tests` — out-of-range answers are rejected and the question is repeated | |
| OQS-F-008 | TC-INPUT-03 | Input handler / error recovery | PASS | Both suites — malformed, empty, decimal, and out-of-range answers are rejected; session recovers | |
| OQS-F-009 | TC-SCORE-01 | Scoring component | PASS | `./quiz_tests` — mixed correct and incorrect answers produce the expected score | |
| OQS-F-010 | TC-SCORE-02 | Scoring component | PASS | `./quiz_tests` — all correct answers produce the maximum score | |
| OQS-F-011 | TC-QUIZ-02 | Quiz session controller | PASS | `./quiz_tests` — every question is presented exactly once in sequence | |
| OQS-F-012 | TC-QUIZ-03 | Question display / answer-key handling | PASS | `./quiz_tests` — correct answer key is not revealed before submission | |
| OQS-F-013 | TC-SCORE-03 | Scoring component | PASS | `./quiz_tests` — all incorrect answers produce a zero score | |
| OQS-F-014 | TC-SCORE-04 | Results display / percentage calculation | PASS | `./quiz_tests` — percentage calculation and one-decimal-place rounding are tested | |
| OQS-F-015 | TC-RESULT-01 | Results display | PASS | `./quiz_tests` — perfect result summary displays 100 percent and no incorrect answers | |
| OQS-F-016 | TC-RESULT-02 | Console menu / session controller | PASS | `bash tests/cli_tests.sh` — replay starts a second quiz | |
| OQS-F-017 | TC-RESULT-03 | Session state management | PASS | `bash tests/cli_tests.sh` — replay resets the score | |
| OQS-F-018 | TC-LOAD-04 | Question-bank loader / diagnostic handling | PASS | `bash tests/cli_tests.sh` — malformed question bank fails safely with a startup diagnostic | |

## Non-functional requirements

| Requirement ID | Test case | Behavior checked | Result | Evidence | Defect issue/PR |
|---|---|---|---|---|---|
| OQS-NF-001 | TC-PERF-01 | Question-bank loader performance | NOT TESTED | No 10-run timing measurements for question banks of up to 100 questions recorded | |
| OQS-NF-002 | TC-PERF-02 | Quiz session response time | NOT TESTED | No timing measurements for 10 consecutive prompts recorded | |
| OQS-NF-003 | TC-REL-01 | Application error handling | PASS | Both suites — incomplete input and EOF are handled safely with documented diagnostics | |
| OQS-NF-004 | TC-DOC-01 | README / user documentation | NOT TESTED | Clean-checkout documentation walkthrough not recorded | |
| OQS-NF-005 | CI-BUILD-01 | Build configuration / CI | NOT TESTED | Local compilation succeeded; GitHub Actions verification pending | |

## Security requirements

| Requirement ID | Test case | Behavior checked | Result | Evidence | Defect issue/PR |
|---|---|---|---|---|---|
| OQS-SR-001 | TC-SEC-01 | Application data handling | NOT TESTED | No separate inspection evidence recorded for credentials or personal-data handling | |
| OQS-SR-002 | TC-SEC-02 | Input handler | NOT TESTED | Shell-like input and path-traversal security checks not demonstrated in the recorded output | |
| OQS-SR-003 | TC-SEC-03 | Question-bank validator | PASS | `./quiz_tests` — malformed question data is rejected before play | |
| OQS-SR-004 | TC-SEC-04 | Question display | PASS | `./quiz_tests` — correct-answer key is not revealed before submission | |
| OQS-SR-005 | TC-SEC-05 | Session state / persistence boundary | NOT TESTED | No separate inspection confirming that answer/result files are not created or modified | |

## Additional regression coverage

The following additional cases were also displayed as passing in the executed unit and CLI test suites:

- `TC-LOAD-05` — minimum option count, inclusive answer-key boundaries, malformed records, and invalid option counts.
- `TC-LOAD-06` — invalid answer-key text, answer-key range errors, incomplete records, and missing data.
- `TC-UNIT-01` — answer-count mismatch rejection.
- `TC-INT-01` — valid choices complete a session after invalid-input retries.
- `TC-INT-02` — complete load, quiz, score, and results flow.
- `TC-RESULT-04` — zero-score result boundary.
- `TC-RESULT-05` — inconsistent score totals are rejected.
- `TC-SCORE-05` — empty scoring input has a safe zero boundary.
- `TC-SCORE-06` — mixed-answer summary reports consistent correct, incorrect, total, and percentage values.
- `TC-SCORE-07` — incomplete answer sets, including skipped answers, are rejected.

### CLI integration test results

| Test case | Behavior checked | Result |
|---|---|---|
| TC-RESULT-02 | Replay starts a second quiz | PASS |
| TC-RESULT-03 | Replay resets the score | PASS |
| TC-RESULT-05 | Consistent result summary | PASS |
| TC-UI-01 | Welcome, invalid menu recovery, and exit flow | PASS |
| TC-INPUT-03 | Invalid answer rejection and session recovery | PASS |
| TC-REL-01 | EOF during a quiz exits with a clear diagnostic | PASS |
| TC-LOAD-04 | Malformed question bank fails safely | PASS |
| TC-INPUT-04 | EOF at menu and during quiz | PASS |

**CLI integration result: 8 PASS, 0 FAIL.**

### C++ unit test results

The `tests/quiz_tests.cpp` executable was compiled and executed successfully.

All test cases displayed in the terminal output passed. The suite covers:

- Question-bank loading and validation.
- Missing and malformed question-bank data.
- Answer-option boundaries and invalid input.
- Quiz flow and question sequencing.
- Scoring and percentage calculations.
- Result summaries and replay-state handling.
- EOF and incomplete-input handling.
- Answer-key confidentiality checks.

**C++ unit-test result: All displayed test cases PASS.**

## Additional regression coverage

The following additional cases were also displayed as passing in the executed unit and CLI test suites:
| Defect | Requirement ID | Description | GitHub issue/PR |
|---|---|---|---|
| None identified during executed regression tests | — | No failures were reported by either executed test suite. Untested requirements remain subject to separate verification. | |

- `TC-LOAD-05` — minimum option count, inclusive answer-key boundaries, malformed records, and invalid option counts.
- `TC-LOAD-06` — invalid answer-key text, answer-key range errors, incomplete records, and missing data.
- `TC-UNIT-01` — answer-count mismatch rejection.
- `TC-INT-01` — valid choices complete a session after invalid-input retries.
- `TC-INT-02` — complete load, quiz, score, and results flow.
- `TC-RESULT-04` — zero-score result boundary.
- `TC-RESULT-05` — inconsistent score totals are rejected.
- `TC-SCORE-05` — empty scoring input has a safe zero boundary.
- `TC-SCORE-06` — mixed-answer summary reports consistent correct, incorrect, total, and percentage values.
- `TC-SCORE-07` — incomplete answer sets, including skipped answers, are rejected.

### CLI integration test results

| Test case | Behavior checked | Result |
|---|---|---|
| TC-RESULT-02 | Replay starts a second quiz | PASS |
| TC-RESULT-03 | Replay resets the score | PASS |
| TC-RESULT-05 | Consistent result summary | PASS |
| TC-UI-01 | Welcome, invalid menu recovery, and exit flow | PASS |
| TC-INPUT-03 | Invalid answer rejection and session recovery | PASS |
| TC-REL-01 | EOF during a quiz exits with a clear diagnostic | PASS |
| TC-LOAD-04 | Malformed question bank fails safely | PASS |
| TC-INPUT-04 | EOF at menu exits gracefully | PASS |
| TC-INPUT-05 | EOF during quiz is handled safely | PASS |

**CLI integration result: 9 PASS, 0 FAIL.**

### C++ unit test results

The `tests/quiz_tests.cpp` executable was compiled and executed successfully.

The strict-build run displayed 45 PASS lines and no failures. The suite covers:

- Question-bank loading and validation.
- Missing and malformed question-bank data.
- Answer-option boundaries and invalid input.
- Quiz flow and question sequencing.
- Scoring and percentage calculations.
- Result summaries and replay-state handling.
- EOF and incomplete-input handling.
- Answer-key confidentiality checks.

**C++ unit-test result: 45 PASS output lines, 0 failures reported.**

### Strict CI-equivalent build

The following commands were executed successfully:

```bash
g++ -std=c++17 -Wall -Wextra -Wpedantic -Werror -Iinclude src/main.cpp src/quiz.cpp -o online_quiz

g++ -std=c++17 -Wall -Wextra -Wpedantic -Werror -Iinclude tests/quiz_tests.cpp src/quiz.cpp -o quiz_tests
