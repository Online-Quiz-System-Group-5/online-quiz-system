
"use strict";

(() => {
  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  const state = {
    questions: [],
    answers: [],
    index: 0,
    selected: null,
    source: "Sample question bank"
  };

  const screens = $$("[data-screen]");
  let toastTimer;

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function showScreen(name) {
    screens.forEach((screen) => {
      screen.hidden = screen.dataset.screen !== name;
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function announce(message) {
    const toast = $("[data-toast]");
    toast.textContent = message;
    toast.hidden = false;

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 2600);
  }

  function updateHome() {
    const ready = state.questions.length > 0;

    $("[data-start]").disabled = !ready;
    $("[data-home-count]").textContent =
      ready ? state.questions.length : "0";

    $("[data-source-name]").textContent = state.source;
  }

  function startQuiz() {
    if (!state.questions.length) {
      announce("Load a valid question bank first.");
      return;
    }

    window.QuizCore.resetQuizSession(state);

    state.answers = Array(state.questions.length).fill(null);

    showScreen("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    const question = state.questions[state.index];

    if (!question) {
      window.QuizCore.resetQuizSession(state);
      showScreen("home");
      updateHome();
      announce("Quiz session was reset.");
      return;
    }

    const count = state.questions.length;
    const number = state.index + 1;
    const percentage = Math.round((number / count) * 100);

    $("[data-question-index]").textContent =
      String(number).padStart(2, "0");

    $("[data-question-prompt]").textContent = question.prompt;

    $("[data-progress-text]").textContent =
      `QUESTION ${number} OF ${count}`;

    $("[data-progress-percent]").textContent = `${percentage}%`;

    const progress = $("[data-progress-bar]");

    progress.setAttribute(
      "aria-valuenow",
      String(Math.round(((number - 1) / count) * 100))
    );

    $(".progress-track span").style.width =
      `${Math.round(((number - 1) / count) * 100)}%`;

    $("[data-side-answered]").textContent =
      `${number - 1} answered`;

    $("[data-next]").innerHTML =
      number === count
        ? 'Finish quiz <span aria-hidden="true">✓</span>'
        : 'Continue <span aria-hidden="true">→</span>';

    $("[data-next]").disabled = state.selected === null;

    $("[data-options]").innerHTML = question.options
      .map((option, index) => `
        <button
          class="answer-option${state.selected === index ? " selected" : ""}"
          type="button"
          data-option="${index}"
          aria-pressed="${state.selected === index}"
        >
          <span class="option-key">${index + 1}</span>
          <span class="option-text">${escapeHTML(option)}</span>
          <span class="option-check" aria-hidden="true">✓</span>
        </button>
      `)
      .join("");

    $("[data-session-dots]").innerHTML =
      state.questions.map((_, index) => {
        const className =
          index < state.index
            ? "done"
            : index === state.index
              ? "current"
              : "";

        return `
          <span
            class="session-dot ${className}"
            aria-label="Question ${index + 1}${
              index < state.index
                ? ", answered"
                : index === state.index
                  ? ", current"
                  : ""
            }"
          ></span>
        `;
      }).join("");

    $$("[data-option]").forEach((button) => {
      button.addEventListener("click", () => {
        selectOption(Number(button.dataset.option));
      });
    });
  }

  function selectOption(index) {
    const question = state.questions[state.index];

    if (
      !question ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= question.options.length
    ) {
      return;
    }

    state.selected = index;

    $$("[data-option]").forEach((button) => {
      const selected = Number(button.dataset.option) === index;

      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    $("[data-next]").disabled = false;
  }

  function nextQuestion() {
    if (state.selected === null) return;

    if (!state.questions[state.index]) return;

    state.answers[state.index] = state.selected;

    if (state.index === state.questions.length - 1) {
      showResults();
      return;
    }

    state.index += 1;
    state.selected = null;

    renderQuestion();
  }

  function showResults() {
    const result = window.QuizCore.scoreQuiz(
      state.questions,
      state.answers
    );

    const heading =
      result.percentage === 100
        ? "Perfect round. Amazing."
        : result.percentage >= 70
          ? "Look at you go."
          : "Good work showing up.";

    $("[data-result-title]").textContent = heading;

    $("[data-result-subtitle]").textContent =
      result.percentage >= 70
        ? "Your results are ready. Take a moment to see how you did."
        : "Every question is a chance to learn. Review your answers and give it another go.";

    $("[data-score-percent]").textContent =
      `${result.percentage}%`;

    $("[data-score-correct]").textContent = result.correct;
    $("[data-score-incorrect]").textContent = result.incorrect;
    $("[data-score-total]").textContent = result.total;

    $("[data-review-count]").textContent =
      `${result.total} QUESTIONS`;

    $("[data-score-ring]").style.setProperty(
      "--score",
      `${result.percentage}%`
    );

    $("[data-review-list]").innerHTML =
      state.questions.map((question, index) => {
        const right =
          state.answers[index] === question.correctOption;

        return `
          <article class="review-item ${
            right ? "review-right" : "review-wrong"
          }">
            <span class="review-mark" aria-label="${
              right ? "Correct" : "Review"
            }">${right ? "✓" : "↗"}</span>

            <div class="review-content">
              <span class="review-number">
                QUESTION ${String(index + 1).padStart(2, "0")}
              </span>

              <h3>${escapeHTML(question.prompt)}</h3>

              <p>
                Your answer:
                <strong>
                  ${escapeHTML(question.options[state.answers[index]])}
                </strong>
              </p>

              ${
                right
                  ? ""
                  : `<p class="correct-answer">
                      Correct answer:
                      <strong>
                        ${escapeHTML(
                          question.options[question.correctOption]
                        )}
                      </strong>
                    </p>`
              }
            </div>

            <span class="review-status">
              ${right ? "CORRECT" : "REVIEW"}
            </span>
          </article>
        `;
      }).join("");

    showScreen("results");
  }

  // UI-11: Safely load the default question bank
  async function loadDefaultQuestions() {
    try {
      const response = await fetch("/questions.txt");

      await window.QuizCore.loadQuestionBankFromResponse(
        state,
        response,
        "Sample question bank"
      );

      $("[data-home-error]").hidden = true;

      updateHome();

    } catch (error) {
      const errorBox = $("[data-home-error]");

      errorBox.textContent =
        "Couldn't load the sample bank. Choose a valid .txt question file to continue.";

      errorBox.hidden = false;

      updateHome();
    }
  }

  // UI-11: Safe question file import
  $("#question-file").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];

    if (!file) return;

    const errorBox = $("[data-home-error]");
    errorBox.hidden = true;

    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error(
          "Please choose a question file smaller than 5 MB."
        );
      }

      const contents = await file.text();

      window.QuizCore.replaceQuestionBank(
        state,
        contents,
        file.name
      );

      updateHome();

      announce(`${state.questions.length} questions loaded`);

    } catch (error) {
      errorBox.textContent =
        error.message || "This file could not be read.";

      errorBox.hidden = false;

      updateHome();

    } finally {
      // Allows selecting the same file again
      event.target.value = "";
    }
  });

  // Main quiz controls
  $("[data-start]").addEventListener("click", startQuiz);

  $("[data-next]").addEventListener("click", nextQuestion);

  $("[data-retry]").addEventListener("click", startQuiz);

  $$("[data-home]").forEach((button) => {
    button.addEventListener("click", () => {
      window.QuizCore.resetQuizSession(state);
      showScreen("home");
    });
  });

  // UI-11: Reset state after quitting
  $$("[data-quit]").forEach((button) => {
    button.addEventListener("click", () => {
      if (
        window.confirm(
          "Exit this quiz? Your answers in this session will be cleared."
        )
      ) {
        window.QuizCore.resetQuizSession(state);
        showScreen("home");
      }
    });
  });

  // Help dialog
  const helpDialog = $("[data-help-dialog]");

  $("[data-help-open]").addEventListener("click", () => {
    helpDialog.showModal();
  });

  $$("[data-help-close]").forEach((button) => {
    button.addEventListener("click", () => {
      helpDialog.close();
    });
  });

  helpDialog.addEventListener("click", (event) => {
    if (event.target === helpDialog) {
      helpDialog.close();
    }
  });

  // Keyboard controls
  document.addEventListener("keydown", (event) => {
    if (helpDialog.open || $("[data-screen='quiz']").hidden) {
      return;
    }

    const question = state.questions[state.index];

    if (/^[1-9]$/.test(event.key)) {
      const option = Number(event.key) - 1;

      if (question && option < question.options.length) {
        selectOption(option);
      }

    } else if (
      event.key === "Enter" &&
      state.selected !== null
    ) {
      nextQuestion();
    }
  });

  // Initial application load
  loadDefaultQuestions();

})();
