# Sprint 2 Acceptance Review

- Review date: 2026-11-05
- Reviewer: Maaya
- SRS version: Baseline v0.2
- Commit reviewed: 04f34f8

## Functional requirements

| Requirement ID | Test case | Behavior checked | Result | Evidence | Defect issue/PR |
|---|---|---|---|---|---|
| OQS-F-001 | TC-UI-01 | Console menu / user interface | PASS | `bash tests/cli_tests.sh` — PASS: welcome, invalid-menu recovery, and exit flow | |
| OQS-F-002 | TC-LOAD-01 | Question-bank loader | NOT TESTED | | |
| OQS-F-003 | TC-LOAD-02 | Question-bank parser and validator | NOT TESTED | | |
| OQS-F-004 | TC-LOAD-03 | Question-bank loading / startup error handling | NOT TESTED | | |
| OQS-F-005 | TC-QUIZ-01 | Quiz session display | NOT TESTED | | |
| OQS-F-006 | TC-INPUT-01 | Input handler | NOT TESTED | | |
| OQS-F-007 | TC-INPUT-02 | Input validation | NOT TESTED | | |
| OQS-F-008 | TC-INPUT-03 | Input handler / error recovery | PASS | `bash tests/cli_tests.sh` — PASS: invalid quiz answer is rejected and session recovers | |
| OQS-F-009 | TC-SCORE-01 | Scoring component | NOT TESTED | | |
| OQS-F-010 | TC-SCORE-02 | Scoring component | NOT TESTED | | |
| OQS-F-011 | TC-QUIZ-02 | Quiz session controller | NOT TESTED | | |
| OQS-F-012 | TC-QUIZ-03 | Question display / answer-key handling | NOT TESTED | | |
| OQS-F-013 | TC-SCORE-03 | Scoring component | NOT TESTED | | |
| OQS-F-014 | TC-SCORE-04 | Results display / percentage calculation | NOT TESTED | | |
| OQS-F-015 | TC-RESULT-01 | Results display | NOT TESTED | | |
| OQS-F-016 | TC-RESULT-02 | Console menu / session controller | PASS | `bash tests/cli_tests.sh` — PASS: replay starts a second quiz | |
| OQS-F-017 | TC-RESULT-03 | Session state management | PASS | `bash tests/cli_tests.sh` — PASS: replay resets the score | |
| OQS-F-018 | TC-LOAD-04 | Question-bank loader / diagnostic handling | PASS | `bash tests/cli_tests.sh` — PASS: malformed question bank fails safely with a startup diagnostic | |

## Non-functional requirements

| Requirement ID | Test case | Behavior checked | Result | Evidence | Defect issue/PR |
|---|---|---|---|---|---|
| OQS-NF-001 | TC-PERF-01 | Question-bank loader / CI | NOT TESTED | | |
| OQS-NF-002 | TC-PERF-02 | Quiz session controller | NOT TESTED | | |
| OQS-NF-003 | TC-REL-01 | Application error handling | PASS | `bash tests/cli_tests.sh` — PASS: end-of-input during a quiz terminates with a clear diagnostic | |
| OQS-NF-004 | TC-DOC-01 | README / user documentation | NOT TESTED | | |
| OQS-NF-005 | CI-BUILD-01 | Build configuration / CI | NOT TESTED | | |

## Security requirements

| Requirement ID | Test case | Behavior checked | Result | Evidence | Defect issue/PR |
|---|---|---|---|---|---|
| OQS-SR-001 | TC-SEC-01 | Application data handling | NOT TESTED | | |
| OQS-SR-002 | TC-SEC-02 | Input handler | NOT TESTED | | |
| OQS-SR-003 | TC-SEC-03 | Question-bank validator | NOT TESTED | | |
| OQS-SR-004 | TC-SEC-04 | Question display | NOT TESTED | | |
| OQS-SR-005 | TC-SEC-05 | Session state / persistence boundary | NOT TESTED | | |

## Defects found

| Defect | Requirement ID | Description | GitHub issue/PR |
|---|---|---|---|

## Review summary

- Requirements checked: 6
- Passed: 6
- Failed: 0
- Not tested: 22
- Known limitations: Only the CLI tests shown in the terminal output were reviewed. The full acceptance checklist, all requirement-to-test mappings, and the remaining functional, non-functional, and security requirements have not yet been verified.