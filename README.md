# Group 5 Online Quiz System

Console-based multiple-choice quiz game for Group 5's allocated Problem Statement 14. The assignment describes a C/C++ console application; this Sprint 1 prototype uses C++17 as a proposed implementation baseline.

## Build and run

Requires a C++17 compiler. From the repository root:

```sh
g++ -std=c++17 -Wall -Wextra -Wpedantic -Iinclude src/main.cpp src/quiz.cpp -o online_quiz
./online_quiz
```

Pass a question-bank path as the first argument to use another file:

```sh
./online_quiz data/questions.txt
```

## Question-bank format

Each non-empty line has the question, at least two options, and the one-based correct option number, separated by `|`:

```text
Question text|Option one|Option two|Option three|2
```

The delimiter cannot appear inside a field in this first version. The loader rejects empty prompts/options, invalid answer keys, missing files, and empty banks.

## Tests

Build and run the lightweight unit/integration test harness:

```sh
g++ -std=c++17 -Wall -Wextra -Wpedantic -Iinclude tests/quiz_tests.cpp src/quiz.cpp -o quiz_tests
./quiz_tests
```

GitHub Actions builds the application and runs the same test executable on each push and pull request. See `docs/SRS_Group5_Online_Quiz_System.docx` for the working requirements draft.

## Current scope

One local player, one correct answer per multiple-choice question, local file input, score summary, and a start/exit menu. There are no accounts, network services, leaderboard, or persistent player results in this version.
