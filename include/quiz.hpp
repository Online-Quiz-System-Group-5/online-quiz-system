#pragma once

#include <cstddef>
#include <iosfwd>
#include <string>
#include <vector>

namespace oqs {

struct Question {
    std::string prompt;
    std::vector<std::string> options;
    std::size_t correctOption; // One-based option number.
};

struct Score {
    std::size_t correct;
    std::size_t total;
};

std::vector<Question> loadQuestions(const std::string& path);
Score calculateScore(const std::vector<Question>& questions,
                     const std::vector<std::size_t>& answers);
Score runSession(const std::vector<Question>& questions,
                 std::istream& input,
                 std::ostream& output);
void displayResults(const Score& score, std::ostream& output);

} // namespace oqs
