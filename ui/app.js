"use strict";

(() => {
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const state = { bankQuestions: [], bankErrors: [], questions: [], answers: [], index: 0, selected: null, source: "Sample question bank", timerSeconds: 0, timerDeadline: null };
  const screens = $$('[data-screen]');
  const timerController = window.QuizCore.createTimerController();
  let toastTimer;

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
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
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  function updateHome() {
    const ready = state.bankQuestions.length > 0;
    const countInput = $("[data-question-count]");
    const available = state.bankQuestions.length;
    countInput.max = String(Math.max(1, available));
    const requestedCount = Number(countInput.value);
    if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > available) {
      countInput.value = String(Math.min(5, Math.max(1, available)));
    }
    $("[data-setup-help]").textContent = ready
      ? `Choose 1–${available} from your ${available} loaded questions.`
      : "Load a question bank to set the quiz length.";
    $("[data-start]").disabled = !ready;
    $("[data-home-count]").textContent = ready ? available : "0";
    $("[data-source-name]").textContent = state.source;
  }

  function renderBankPreview() {
    $("[data-preview-summary]").textContent = `${state.bankQuestions.length} usable question${state.bankQuestions.length === 1 ? "" : "s"}`;
    $("[data-preview-questions]").innerHTML = state.bankQuestions.map((question) => `
      <li>${escapeHTML(question.prompt)}<small>${question.options.length} options</small></li>`).join("");
    const errors = $("[data-preview-errors]");
    errors.innerHTML = state.bankErrors.length
      ? `<h3>Records needing attention</h3><ul>${state.bankErrors.map((error) => `<li>${escapeHTML(error.message)}</li>`).join("")}</ul>`
      : "";
    errors.hidden = state.bankErrors.length === 0;
  }

  function cancelQuestionTimer() {
    timerController.cancel();
    state.timerDeadline = null;
    const timer = $("[data-question-timer]");
    timer.hidden = true;
    timer.removeAttribute("data-urgent");
  }

  function updateQuestionTimer() {
    if (state.timerDeadline === null) return;
    const remaining = Math.max(0, Math.ceil((state.timerDeadline - Date.now()) / 1000));
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    $("[data-timer-value]").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    $("[data-question-timer]").setAttribute("data-urgent", String(remaining <= 5));
    if (window.QuizCore.isTimerExpired(state.timerDeadline, Date.now())) timeoutQuestion();
  }

  function startQuestionTimer() {
    cancelQuestionTimer();
    if (state.timerSeconds <= 0) return;
    state.timerDeadline = Date.now() + state.timerSeconds * 1000;
    $("[data-question-timer]").hidden = false;
    updateQuestionTimer();
    if (state.timerDeadline !== null) timerController.start(updateQuestionTimer, 200);
  }

  function advanceQuestion(answer) {
    state.answers[state.index] = answer;
    cancelQuestionTimer();
    if (state.index === state.questions.length - 1) {
      showResults();
      return;
    }
    state.index += 1;
    state.selected = null;
    renderQuestion();
  }

  function timeoutQuestion() {
    const deadline = state.timerDeadline;
    if (deadline === null || !window.QuizCore.isTimerExpired(deadline, Date.now())) return;
    const answer = state.selected;
    advanceQuestion(answer);
    if (answer === null) announce("Time is up. This question was recorded as unanswered.");
  }

  function startQuiz() {
    if (!state.bankQuestions.length) return;
    const timerEnabled = $("[data-timer-enabled]").checked;
    const timerSeconds = Number($("[data-timer-seconds]").value);
    if (timerEnabled && (!Number.isInteger(timerSeconds) || timerSeconds < 5 || timerSeconds > 120)) {
      const errorBox = $("[data-home-error]");
      errorBox.textContent = "Choose a timer from 5 to 120 seconds per question.";
      errorBox.hidden = false;
      return;
    }
    cancelQuestionTimer();
    state.timerSeconds = timerEnabled ? timerSeconds : 0;
    const count = Number($("[data-question-count]").value);
    try {
      state.questions = window.QuizCore.prepareQuiz(state.bankQuestions, {
        count,
        shuffle: $("[data-shuffle]").checked
      });
    } catch (error) {
      const errorBox = $("[data-home-error]");
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      return;
    }
    $("[data-home-error]").hidden = true;
    state.answers = Array(state.questions.length).fill(null);
    state.index = 0;
    state.selected = null;
    showScreen("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    const question = state.questions[state.index];
    const count = state.questions.length;
    const number = state.index + 1;
    const percentage = Math.round((number / count) * 100);
    $("[data-question-index]").textContent = String(number).padStart(2, "0");
    $("[data-question-prompt]").textContent = question.prompt;
    $("[data-progress-text]").textContent = `QUESTION ${number} OF ${count}`;
    $("[data-progress-percent]").textContent = `${percentage}%`;
    const progress = $("[data-progress-bar]");
    progress.setAttribute("aria-valuenow", String(Math.round(((number - 1) / count) * 100)));
    $(".progress-track span").style.width = `${Math.round(((number - 1) / count) * 100)}%`;
    $("[data-side-answered]").textContent = `${number - 1} answered`;
    $("[data-next]").innerHTML = number === count ? 'Finish quiz <span aria-hidden="true">✓</span>' : 'Continue <span aria-hidden="true">→</span>';
    $("[data-next]").disabled = state.selected === null;
    $("[data-options]").innerHTML = question.options.map((option, index) => `
      <button class="answer-option${state.selected === index ? " selected" : ""}" type="button" data-option="${index}" aria-pressed="${state.selected === index}">
        <span class="option-key">${index + 1}</span><span class="option-text">${escapeHTML(option)}</span><span class="option-check" aria-hidden="true">✓</span>
      </button>`).join("");
    $("[data-session-dots]").innerHTML = state.questions.map((_, index) => {
      const className = index < state.index ? "done" : index === state.index ? "current" : "";
      return `<span class="session-dot ${className}" aria-label="Question ${index + 1}${index < state.index ? ", answered" : index === state.index ? ", current" : ""}"></span>`;
    }).join("");
    $$("[data-option]").forEach((button) => {
      button.addEventListener("click", () => selectOption(Number(button.dataset.option)));
    });
    startQuestionTimer();
  }

  function selectOption(index) {
    if (state.timerDeadline !== null && window.QuizCore.isTimerExpired(state.timerDeadline, Date.now())) {
      timeoutQuestion();
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
    if (state.timerDeadline !== null && window.QuizCore.isTimerExpired(state.timerDeadline, Date.now())) {
      timeoutQuestion();
      return;
    }
    advanceQuestion(state.selected);
  }

  function showResults() {
    cancelQuestionTimer();
    const result = window.QuizCore.scoreQuiz(state.questions, state.answers);
    const heading = result.percentage === 100 ? "Perfect round. Amazing." : result.percentage >= 70 ? "Look at you go." : "Good work showing up.";
    $("[data-result-title]").textContent = heading;
    $("[data-result-subtitle]").textContent = result.percentage >= 70
      ? "Your results are ready. Take a moment to see how you did."
      : "Every question is a chance to learn. Review your answers and give it another go.";
    $("[data-score-percent]").textContent = `${result.percentage}%`;
    $("[data-score-correct]").textContent = result.correct;
    $("[data-score-incorrect]").textContent = result.incorrect;
    $("[data-score-total]").textContent = result.total;
    $("[data-review-count]").textContent = `${result.total} QUESTIONS`;
    $("[data-score-ring]").style.setProperty("--score", `${result.percentage}%`);
    $("[data-review-list]").innerHTML = state.questions.map((question, index) => {
      const answer = state.answers[index];
      const right = answer !== null && answer === question.correctOption;
      return `<article class="review-item ${right ? "review-right" : "review-wrong"}">
        <span class="review-mark" aria-label="${right ? "Correct" : "Review"}">${right ? "✓" : "↗"}</span>
        <div class="review-content"><span class="review-number">QUESTION ${String(index + 1).padStart(2, "0")}</span>
          <h3>${escapeHTML(question.prompt)}</h3>
          <p>Your answer: <strong>${answer === null ? "Not answered" : escapeHTML(question.options[answer])}</strong></p>
          ${right ? "" : `<p class="correct-answer">Correct answer: <strong>${escapeHTML(question.options[question.correctOption])}</strong></p>`}
        </div><span class="review-status">${right ? "CORRECT" : "REVIEW"}</span>
      </article>`;
    }).join("");
    showScreen("results");
  }

  async function loadDefaultQuestions() {
    try {
      const response = await fetch("/questions.txt");
      if (!response.ok) throw new Error("Sample file could not be loaded.");
      state.bankQuestions = window.QuizCore.parseQuestionBank(await response.text());
      state.bankErrors = [];
      state.source = "Sample question bank";
      updateHome();
    } catch (error) {
      $("[data-home-error]").textContent = "Couldn't load the sample bank. Choose a valid .txt question file to continue.";
      $("[data-home-error]").hidden = false;
      updateHome();
    }
  }

  $("#question-file").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const errorBox = $("[data-home-error]");
    errorBox.hidden = true;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Please choose a question file smaller than 5 MB.");
      const report = window.QuizCore.inspectQuestionBank(await file.text());
      state.bankQuestions = report.questions;
      state.bankErrors = report.errors;
      state.source = file.name;
      updateHome();
      renderBankPreview();
      if (report.errors.length) {
        errorBox.textContent = state.bankQuestions.length
          ? `${report.errors.length} invalid record${report.errors.length === 1 ? " was" : "s were"} skipped. Open the preview for line details.`
          : "No usable questions were found. Open the preview to see the line details.";
        errorBox.hidden = false;
      } else {
        announce(`${state.bankQuestions.length} questions loaded`);
      }
    } catch (error) {
      errorBox.textContent = error.message || "This file could not be read.";
      errorBox.hidden = false;
    } finally {
      event.target.value = "";
    }
  });

  $("[data-start]").addEventListener("click", startQuiz);
  const timerEnabledInput = $("[data-timer-enabled]");
  const timerSettings = $("[data-timer-setting]");
  const timerSecondsInput = $("[data-timer-seconds]");
  timerSettings.hidden = !timerEnabledInput.checked;
  timerSecondsInput.disabled = !timerEnabledInput.checked;
  timerEnabledInput.addEventListener("change", () => {
    timerSettings.hidden = !timerEnabledInput.checked;
    timerSecondsInput.disabled = !timerEnabledInput.checked;
    $("[data-home-error]").hidden = true;
  });
  $("[data-preview-toggle]").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const panel = $("[data-bank-preview]");
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
    button.textContent = panel.hidden ? "Preview questions" : "Hide preview";
    renderBankPreview();
  });
  $("[data-question-count]").addEventListener("input", () => {
    const countInput = $("[data-question-count]");
    const count = Number(countInput.value);
    const errorBox = $("[data-home-error]");
    if (!Number.isInteger(count) || count < 1 || count > state.bankQuestions.length) {
      errorBox.textContent = `Choose a whole number from 1 to ${state.bankQuestions.length}.`;
      errorBox.hidden = false;
      $("[data-start]").disabled = true;
      return;
    }
    errorBox.hidden = true;
    $("[data-start]").disabled = state.bankQuestions.length === 0;
  });
  $("[data-next]").addEventListener("click", nextQuestion);
  $("[data-retry]").addEventListener("click", startQuiz);
  $$('[data-home]').forEach((button) => button.addEventListener("click", () => showScreen("home")));
  $$('[data-quit]').forEach((button) => button.addEventListener("click", () => {
    if (window.confirm("Exit this quiz? Your answers in this session will be cleared.")) {
      cancelQuestionTimer();
      state.answers = [];
      state.index = 0;
      state.selected = null;
      showScreen("home");
    }
  }));

  const helpDialog = $("[data-help-dialog]");
  $("[data-help-open]").addEventListener("click", () => helpDialog.showModal());
  $$('[data-help-close]').forEach((button) => button.addEventListener("click", () => helpDialog.close()));
  helpDialog.addEventListener("click", (event) => {
    if (event.target === helpDialog) helpDialog.close();
  });

  document.addEventListener("keydown", (event) => {
    if (helpDialog.open || $("[data-screen='quiz']").hidden) return;
    const question = state.questions[state.index];
    if (/^[1-9]$/.test(event.key)) {
      const option = Number(event.key) - 1;
      if (question && option < question.options.length) selectOption(option);
    } else if (event.key === "Enter" && state.selected !== null) {
      nextQuestion();
    }
  });

  loadDefaultQuestions();
})();
