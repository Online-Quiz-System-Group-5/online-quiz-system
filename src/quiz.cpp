#include "quiz.hpp"

#include <fstream>
#include <iomanip>
#include <istream>
#include <ostream>
#include <sstream>
#include <stdexcept>
#include <utility>

namespace oqs {
namespace {

constexpr std::size_t kMaximumRecordLength = 64 * 1024;

std::vector<std::string> splitRecord(const std::string& line) {
    std::vector<std::string> fields;
    std::istringstream stream(line);
    std::string field;
    while (std::getline(stream, field, '|')) {
        fields.push_back(field);
    }
    if (!line.empty() && line.back() == '|') {
        fields.emplace_back();
    }
    return fields;
}

bool isBlank(const std::string& value) {
    return value.find_first_not_of(" \t\r\n") == std::string::npos;
}

std::size_t parseCorrectOption(const std::string& value,
                              std::size_t optionCount,
                              std::size_t lineNumber) {
    std::size_t consumed = 0;
    unsigned long parsed = 0;
    try {
        parsed = std::stoul(value, &consumed);
    } catch (const std::exception&) {
        throw std::runtime_error("line " + std::to_string(lineNumber) +
                                 ": correct option must be a whole number from 1 to " +
                                 std::to_string(optionCount));
    }
    if (consumed != value.size()) {
        throw std::runtime_error("line " + std::to_string(lineNumber) +
                                 ": correct option must be a whole number from 1 to " +
                                 std::to_string(optionCount));
    }
    if (parsed < 1 || parsed > optionCount) {
        throw std::runtime_error("line " + std::to_string(lineNumber) +
                                 ": correct option is outside the valid range 1-" +
                                 std::to_string(optionCount));
    }
    return static_cast<std::size_t>(parsed);
}

} // namespace

std::vector<Question> loadQuestions(const std::string& path) {
    std::ifstream file(path);
    if (!file) {
        throw std::runtime_error("cannot open question bank: " + path);
    }

    std::vector<Question> questions;
    std::string line;
    std::size_t lineNumber = 0;
    while (true) {
        line.clear();
        char character = '\0';
        bool readAnyCharacter = false;
        while (file.get(character)) {
            readAnyCharacter = true;
            if (character == '\n') {
                break;
            }
            if (line.size() >= kMaximumRecordLength) {
                throw std::runtime_error("question bank record exceeds the 64 KiB limit");
            }
            line.push_back(character);
        }
        if (file.bad()) {
            throw std::runtime_error("error while reading question bank: " + path);
        }
        if (!readAnyCharacter) {
            break;
        }
        ++lineNumber;
        if (isBlank(line)) {
            continue;
        }

        const auto fields = splitRecord(line);
        if (fields.size() < 4) {
            throw std::runtime_error("line " + std::to_string(lineNumber) +
                                     ": incomplete question record; expected a prompt, at least two non-empty options, and a correct-option number");
        }
        if (isBlank(fields.front())) {
            throw std::runtime_error("line " + std::to_string(lineNumber) +
                                     ": question prompt is empty; add text before the first '|' delimiter");
        }
        for (std::size_t i = 1; i + 1 < fields.size(); ++i) {
            if (isBlank(fields[i])) {
                throw std::runtime_error("line " + std::to_string(lineNumber) +
                                         ": option " + std::to_string(i) +
                                         " is empty; add text for every answer option");
            }
        }

        Question question;
        question.prompt = fields.front();
        question.options.assign(fields.begin() + 1, fields.end() - 1);
        question.correctOption = parseCorrectOption(fields.back(), question.options.size(), lineNumber);
        questions.push_back(std::move(question));
    }

    if (questions.empty()) {
        throw std::runtime_error("question bank contains no questions");
    }
    return questions;
}

Score calculateScore(const std::vector<Question>& questions,
                     const std::vector<std::size_t>& answers) {
    if (questions.size() != answers.size()) {
        throw std::invalid_argument("answer count must match question count");
    }
    Score score{0, questions.size()};
    for (std::size_t i = 0; i < questions.size(); ++i) {
        if (answers[i] < 1 || answers[i] > questions[i].options.size()) {
            throw std::invalid_argument("answer is outside the option range");
        }
        if (answers[i] == questions[i].correctOption) {
            ++score.correct;
        }
    }
    return score;
}

Score runSession(const std::vector<Question>& questions,
                 std::istream& input,
                 std::ostream& output) {
    if (questions.empty()) {
        throw std::invalid_argument("a quiz session needs at least one question");
    }

    std::vector<std::size_t> answers;
    answers.reserve(questions.size());
    for (std::size_t i = 0; i < questions.size(); ++i) {
        output << "\nQuestion " << (i + 1) << ": " << questions[i].prompt << '\n';
        for (std::size_t option = 0; option < questions[i].options.size(); ++option) {
            output << "  " << (option + 1) << ". " << questions[i].options[option] << '\n';
        }

        while (true) {
            output << "Your answer (1-" << questions[i].options.size() << "): ";
            std::string line;
            if (!std::getline(input, line)) {
                throw std::runtime_error("input ended before the quiz was complete");
            }
            std::istringstream answerStream(line);
            long answer = 0;
            char trailing = '\0';
            if (!(answerStream >> answer) || (answerStream >> trailing) || answer < 1 ||
                static_cast<std::size_t>(answer) > questions[i].options.size()) {
                output << "Invalid choice. Enter a number shown above.\n";
                continue;
            }
            answers.push_back(static_cast<std::size_t>(answer));
            break;
        }
    }
    return calculateScore(questions, answers);
}

void displayResults(const Score& score, std::ostream& output) {
    if (score.correct > score.total) {
        throw std::invalid_argument("correct answer count cannot exceed total questions");
    }
    const std::size_t incorrect = score.total - score.correct;
    const double percentage = score.total == 0
                                  ? 0.0
                                  : 100.0 * static_cast<double>(score.correct) /
                                        static_cast<double>(score.total);
    output << "\nQuiz results\n"
           << "Correct answers: " << score.correct << '\n'
           << "Incorrect answers: " << incorrect << '\n'
           << "Total questions: " << score.total << '\n'
           << "Score: " << std::fixed << std::setprecision(1) << percentage << "%\n";
}

} // namespace oqs
