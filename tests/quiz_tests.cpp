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
                "TC-LOAD-03 empty question bank is rejected");
    {
        std::ofstream malformedFile(fixture);
        malformedFile << "Question?|Only one option|1\n";
    }
    checkThrows([&fixture] { oqs::loadQuestions(fixture); },
                "TC-LOAD-02 malformed question record is rejected");
    {
        std::ofstream malformedFile(fixture);
        malformedFile << "Question?|Option one||2\n";
    }
    checkThrows([&fixture] { oqs::loadQuestions(fixture); },
                "TC-LOAD-02 empty option is rejected");
    {
        std::ofstream malformedFile(fixture);
        malformedFile << "Question?|Option one|Option two|3\n";
    }
    checkThrows([&fixture] { oqs::loadQuestions(fixture); },
                "TC-LOAD-03 out-of-range answer key prevents starting a quiz");
    std::remove(fixture.c_str());

    {
        std::ofstream variedFile(fixture);
        variedFile << "Binary choice?|Yes|No|1\n"
                   << "Four choices?|A|B|C|D|4\n";
    }
    try {
        const auto varied = oqs::loadQuestions(fixture);
        check(varied.size() == 2 && varied[0].options.size() == 2 &&
                  varied[0].correctOption == 1 && varied[1].options.size() == 4 &&
                  varied[1].correctOption == 4,
              "TC-LOAD-02 valid records support different option counts");
    } catch (const std::exception&) {
        check(false, "TC-LOAD-02 valid records support different option counts");
    }
    {
        std::ofstream boundaryFile(fixture);
        boundaryFile << "Lower boundary?|Yes|No|1\n"
                     << "Upper boundary?|Yes|No|2"; // Final record without a newline.
    }
    try {
        const auto boundaries = oqs::loadQuestions(fixture);
        check(boundaries.size() == 2 && boundaries[0].options.size() == 2 &&
                  boundaries[0].correctOption == 1 && boundaries[1].correctOption == 2,
              "TC-LOAD-05 minimum option count and inclusive answer-key boundaries load");
    } catch (const std::exception&) {
        check(false, "TC-LOAD-05 minimum option count and inclusive answer-key boundaries load");
    }
    {
        std::ofstream invalidFile(fixture);
        invalidFile << "Question?|Only one option|1\n";
    }
    checkThrows([&fixture] { oqs::loadQuestions(fixture); },
                "TC-LOAD-05 fewer than two options is rejected");
    {
        std::ofstream invalidFile(fixture);
        invalidFile << "   |Option one|Option two|1\n";
    }
    checkThrows([&fixture] { oqs::loadQuestions(fixture); },
                "TC-LOAD-05 whitespace-only prompt is rejected");
    {
        std::ofstream invalidFile(fixture);
        invalidFile << "Question?|Option one|Option two|0\n";
    }
    checkThrows([&fixture] { oqs::loadQuestions(fixture); },
                "TC-LOAD-05 answer key below the one-based range is rejected");
    {
        std::ofstream invalidFile(fixture);
        invalidFile << "Question?|Option one|Option two|3\n";
    }
    checkThrows([&fixture] { oqs::loadQuestions(fixture); },
                "TC-LOAD-05 answer key above the available options is rejected");
    {
        std::ofstream invalidFile(fixture);
        invalidFile << "Question?|Option one|Option two|184467440737095516160\n";
    }
    checkThrows([&fixture] { oqs::loadQuestions(fixture); },
                "TC-LOAD-05 answer key integer overflow is rejected");
    {
        std::ofstream oversizedFile(fixture);
        oversizedFile << "Question?|" << std::string(64 * 1024, 'x') << "|1\n";
    }
    checkThrows([&fixture] { oqs::loadQuestions(fixture); },
                "TC-LOAD-04 oversized record is rejected safely");
    std::remove(fixture.c_str());

    const auto questions = sampleQuestions();
    const auto score = oqs::calculateScore(questions, {2, 1});
    check(score.correct == 1 && score.total == 2,
          "TC-SCORE-01 correct answers are counted accurately");
    check(score.correct == 1,
          "TC-SCORE-02 each correct response adds one and each incorrect adds zero");
    check(score.correct == 1 && score.total == questions.size(),
          "TC-SCORE-03 known response pattern returns expected count and total");
    checkThrows([&questions] { oqs::calculateScore(questions, {2}); },
                "TC-UNIT-01 answer count mismatch is rejected");
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
          "TC-QUIZ-03 and TC-SEC-04 answer key is not revealed before submission");
    const auto firstQuestion = output.str().find("Question 1: 2 + 2?");
    const auto secondQuestion = output.str().find("Question 2: Capital of France?");
    check(firstQuestion != std::string::npos && secondQuestion > firstQuestion &&
              output.str().find("Question 3:") == std::string::npos,
          "TC-QUIZ-02 session presents every question once in sequence");
    checkThrows([&questions] {
        std::istringstream incompleteInput("2\n");
        std::ostringstream incompleteOutput;
        oqs::runSession(questions, incompleteInput, incompleteOutput);
    }, "TC-REL-01 incomplete input ends safely");

    std::ostringstream results;
    oqs::displayResults({2, 2}, results);
    check(results.str().find("100.0%") != std::string::npos &&
              results.str().find("Incorrect answers: 0") != std::string::npos,
          "TC-RESULT-01 result summary and percentage are consistent");
    std::ostringstream roundedResults;
    oqs::displayResults({1, 3}, roundedResults);
    check(roundedResults.str().find("33.3%") != std::string::npos,
          "TC-SCORE-04 percentage is rounded to one decimal place");

    return failures == 0 ? 0 : 1;
}
