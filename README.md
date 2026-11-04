# Group 5 Online Quiz System

A console-based multiple-choice quiz application developed in C++17
for Group 5's allocated Problem Statement 14.

## Features

- Console-based quiz interface.
- Multiple-choice questions loaded from a local file.
- Input validation and error handling.
- Automatic score calculation.
- Quiz result summary with percentage.
- Option to replay the quiz.
- Unit and integration tests.

## Requirements

- C++17-compatible compiler.
- Git (optional, for repository operations).

## Build and Run

Run these commands from the repository root.

### Build the application

```bash
g++ -std=c++17 -Wall -Wextra -Wpedantic -Iinclude src/main.cpp src/quiz.cpp -o online_quiz