#include "quiz.hpp"

#include <cstdio>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {
int failures = 0;

void check(bool condition, const std::string& name) {
    if (condition) {
        std::cout << "PASS: " << name << '\n';
    } else {
        std::cerr << "FAIL: " << name << '\n';
        ++failures;
    }
}

template <typename Function>
void checkThrows(Function function, const std::string& name) {
    try {
        function();
        check(false, name);
    } catch (const std::exception&) {
        check(true, name);
    }
}

std::vector<oqs::Question> sampleQuestions() {
    return {{"2 + 2?", {"3", "4", "5"}, 2},
            {"Capital of France?", {"Rome", "Paris", "Berlin"}, 2}};
}
} // namespace

int main() {
    const std::string fixture = "test_question_bank.tmp";
    {
        std::ofstream file(fixture);
        file << "2 + 2?|3|4|5|2\nCapital of France?|Rome|Paris|Berlin|2\n";
    }
    try {
        const auto loaded = oqs::loadQuestions(fixture);
        check(loaded.size() == 2 && loaded[0].correctOption == 2,
              "TC-LOAD-01 loads valid questions and answer key");
    } catch (const std::exception&) {
        check(false, "TC-LOAD-01 loads valid questions and answer key");
    }
    std::remove(fixture.c_str());

    checkThrows([] { oqs::loadQuestions("file-that-does-not-exist.tmp"); },
                "TC-LOAD-03 missing question bank is rejected");

    {
        std::ofstream emptyFile(fixture);
    }
    checkThrows([&fixture] { oqs::loadQuestions(fixture); },
                "TC-LOAD-04 empty question bank is rejected");
    {
        std::ofstream malformedFile(fixture);
        malformedFile << "Question?|Only one option|1\n";
    }
    checkThrows([&fixture] { oqs::loadQuestions(fixture); },
                "TC-LOAD-05 malformed question record is rejected");
    std::remove(fixture.c_str());

    const auto questions = sampleQuestions();
    const auto score = oqs::calculateScore(questions, {2, 1});
    check(score.correct == 1 && score.total == 2,
          "TC-SCORE-01 correct answers are counted accurately");
    checkThrows([&questions] { oqs::calculateScore(questions, {2}); },
                "TC-SCORE-02 answer count mismatch is rejected");
    checkThrows([&questions] { oqs::calculateScore(questions, {4, 1}); },
                "TC-INPUT-02 out-of-range answer is rejected by scoring");

    std::istringstream input("x\n4\n2\n1\n");
    std::ostringstream output;
    const auto sessionScore = oqs::runSession(questions, input, output);
    check(sessionScore.correct == 1 && sessionScore.total == 2,
          "TC-INT-01 session retries invalid input and completes");
    check(output.str().find("Invalid choice") != std::string::npos,
          "TC-INPUT-03 malformed and out-of-range inputs produce feedback");
    check(output.str().find("Correct answer") == std::string::npos,
          "TC-SEC-04 answer key is not revealed during the session");

    std::ostringstream results;
    oqs::displayResults({2, 2}, results);
    check(results.str().find("100.0%") != std::string::npos &&
              results.str().find("Incorrect answers: 0") != std::string::npos,
          "TC-RESULT-01 result summary and percentage are consistent");

    return failures == 0 ? 0 : 1;
}
