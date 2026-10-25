#include "quiz.hpp"

#include <exception>
#include <iostream>
#include <string>

int main(int argc, char* argv[]) {
    const std::string questionPath = argc > 1 ? argv[1] : "data/questions.txt";
    if (argc > 2) {
        std::cerr << "Usage: online_quiz [question-bank-file]\n";
        return 2;
    }

    std::vector<oqs::Question> questions;
    try {
        questions = oqs::loadQuestions(questionPath);
    } catch (const std::exception& error) {
        std::cerr << "Unable to start quiz: " << error.what() << '\n';
        return 1;
    }

    std::cout << "Online Quiz System\n";
    while (true) {
        std::cout << "\n1. Start quiz\n2. Exit\nChoose: ";
        std::string choice;
        if (!std::getline(std::cin, choice)) {
            std::cout << '\n';
            return 0;
        }
        if (choice == "2") {
            return 0;
        }
        if (choice != "1") {
            std::cout << "Invalid choice. Enter 1 or 2.\n";
            continue;
        }

        try {
            const auto score = oqs::runSession(questions, std::cin, std::cout);
            oqs::displayResults(score, std::cout);
        } catch (const std::exception& error) {
            std::cerr << "Quiz session ended: " << error.what() << '\n';
            return 1;
        }
    }
}
