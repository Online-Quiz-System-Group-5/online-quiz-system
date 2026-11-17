"use strict";

(() => {
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const state = { bankQuestions: [], bankErrors: [], questions: [], answers: [], index: 0, selected: null, source: "Sample question bank", timerSeconds: 0, timerDeadline: null };
  const screens = $$('[data-screen]');
  const timerController = window.QuizCore.createTimerController();
  let toastTimer;
  let topicBanks = [];

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function showScreen(name) {
    screens.forEach((screen) => {
      screen.hidden = screen.dataset.screen !== name;
    });
    $("[data-history-nav]").hidden = name === "quiz";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function announce(message) {
    const toast = $("[data-toast]");
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  function getBrowserStorage() {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  function updateLatestResult() {
    const panel = $("[data-latest-result]");
    const saved = window.QuizCore.readLatestResult(getBrowserStorage());
    panel.hidden = !saved;
    if (!saved) return;
    $("[data-latest-score]").textContent = `${saved.percentage}%`;
    $("[data-latest-count]").textContent = `${saved.correct} of ${saved.total} correct`;
    $("[data-latest-bank]").textContent = saved.bankLabel;
    const date = $("[data-latest-date]");
    date.dateTime = saved.date;
    date.textContent = new Date(saved.date).toLocaleString();
  }

  function updateHistory() {
    const history = window.QuizCore.readHistory(getBrowserStorage());
    $("[data-history-list]").innerHTML = history.entries.map((entry) => `
      <li class="history-entry"><time datetime="${escapeHTML(entry.date)}">${escapeHTML(new Date(entry.date).toLocaleString())}</time>
        <strong>${escapeHTML(entry.bankLabel)}</strong>
        <span>${entry.percentage}% · ${entry.correct} of ${entry.total} correct · ${entry.total} questions</span></li>`).join("");
    $("[data-history-empty]").hidden = history.entries.length > 0;
    $("[data-history-full]").hidden = history.entries.length < window.QuizCore.historyLimit;
    const warning = $("[data-history-warning]");
    warning.hidden = history.status === "ok";
    warning.textContent = history.status === "corrupt"
      ? "Some saved history was damaged. Any valid entries are shown. Clear history to remove damaged data."
      : "This browser does not allow local storage, so history is unavailable.";
    $("[data-history-clear]").hidden = history.status === "unavailable"
      || (history.status === "ok" && history.entries.length === 0);
  }

  function updateHome() {
    const ready = state.bankQuestions.length > 0;
    const countInput = $("[data-question-count]");
    const available = Math.min(10, state.bankQuestions.length);
    countInput.max = String(Math.max(1, available));
    const requestedCount = Number(countInput.value);
    if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > available) {
      countInput.value = String(Math.max(1, available));
    }
    $("[data-setup-help]").textContent = ready
      ? `Choose 1–${available} from your ${state.bankQuestions.length} loaded questions.`
      : "Load a question bank to set the quiz length.";
    $("[data-start]").disabled = !ready;
    $("[data-home-count]").textContent = ready ? state.bankQuestions.length : "0";
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
    const optionCount = question.options.length;

$("[data-keyboard-hint]").innerHTML =
  optionCount === 1
    ? `<kbd>1</kbd> to choose`
    : `<kbd>1</kbd>–<kbd>${optionCount}</kbd> to choose`;
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

  function applyReviewFilter(filter) {
    const filters = ["all", "incorrect", "unanswered"];
    if (!filters.includes(filter)) return;
    let visible = 0;
    $$("[data-review-state]").forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.reviewState !== filter;
      if (!item.hidden) visible += 1;
    });
    $$("[data-review-filter]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.reviewFilter === filter));
    });
    $("[data-review-count]").textContent = filter === "all"
      ? `${visible} QUESTIONS`
      : `${visible} ${filter.toUpperCase()}`;
    const empty = $("[data-review-empty]");
    empty.hidden = visible > 0;
    empty.textContent = filter === "incorrect"
      ? "No incorrect answers in this attempt."
      : "No unanswered questions in this attempt.";
  }

  function showResults() {
    cancelQuestionTimer();
    const result = window.QuizCore.scoreQuiz(state.questions, state.answers);
    const resultSaved = window.QuizCore.saveLatestResult(getBrowserStorage(), result, state.source);
    const historySaved = window.QuizCore.addHistoryEntry(getBrowserStorage(), result, state.source);
    updateLatestResult();
    updateHistory();
    const heading = result.percentage === 100 ? "Perfect round. Amazing." : result.percentage >= 70 ? "Look at you go." : "Good work showing up.";
    $("[data-result-title]").textContent = heading;
    $("[data-result-subtitle]").textContent = result.percentage >= 70
      ? "Your results are ready. Take a moment to see how you did."
      : "Every question is a chance to learn. Review your answers and give it another go.";
    $("[data-score-percent]").textContent = `${result.percentage}%`;
    $("[data-score-correct]").textContent = result.correct;
    $("[data-score-incorrect]").textContent = result.incorrect;
    $("[data-score-total]").textContent = result.total;
    $("[data-score-ring]").style.setProperty("--score", `${result.percentage}%`);
    $("[data-review-list]").innerHTML = state.questions.map((question, index) => {
      const answer = state.answers[index];
      const reviewState = window.QuizCore.getReviewState(question, answer);
      const right = reviewState === "correct";
      const status = reviewState === "unanswered" ? "UNANSWERED" : right ? "CORRECT" : "INCORRECT";
      return `<article class="review-item ${right ? "review-right" : "review-wrong"}" data-review-state="${reviewState}">
        <span class="review-mark" aria-label="${status}">${right ? "✓" : "↗"}</span>
        <div class="review-content"><span class="review-number">QUESTION ${String(index + 1).padStart(2, "0")}</span>
          <h3>${escapeHTML(question.prompt)}</h3>
          <p>Your answer: <strong>${answer === null ? "Not answered" : escapeHTML(question.options[answer])}</strong></p>
          ${right ? "" : `<p class="correct-answer">Correct answer: <strong>${escapeHTML(question.options[question.correctOption])}</strong></p>`}
        </div><span class="review-status">${status}</span>
      </article>`;
    }).join("");
    const reviewStates = state.questions.map((question, index) => window.QuizCore.getReviewState(question, state.answers[index]));
    $("[data-filter-all-count]").textContent = String(result.total);
    $("[data-filter-incorrect-count]").textContent = String(reviewStates.filter((value) => value === "incorrect").length);
    $("[data-filter-unanswered-count]").textContent = String(reviewStates.filter((value) => value === "unanswered").length);
    applyReviewFilter("all");
    showScreen("results");
    if (!resultSaved || !historySaved) announce("Your result is shown, but this browser could not save all score details for later.");
  }

  function selectTopic(id) {
    const topic = topicBanks.find((entry) => entry.id === id);
    if (!topic) return;
    state.bankQuestions = window.QuizCore.parseQuestionBank(topic.bank);
    state.bankErrors = [];
    state.source = topic.name;
    $("[data-home-error]").hidden = true;
    updateHome();
    renderBankPreview();
  }

  async function loadDefaultQuestions() {
    const select = $("[data-topic]");
    try {
      const response = await fetch("/topics.json");
      if (!response.ok) throw new Error("Topic banks could not be loaded.");
      topicBanks = await response.json();
      select.replaceChildren(...topicBanks.map((topic) => {
        const option = document.createElement("option");
        option.value = topic.id;
        option.textContent = topic.name;
        return option;
      }));
      const customOption = document.createElement("option");
      customOption.value = "custom";
      customOption.textContent = "Custom uploaded file";
      customOption.disabled = true;
      select.append(customOption);
      select.disabled = false;
      // An import may finish before the topic catalogue loads.
      if (state.bankQuestions.length) select.value = "custom";
      else selectTopic(select.value);
    } catch (error) {
      const unavailable = document.createElement("option");
      unavailable.textContent = "Topics unavailable — upload a file";
      unavailable.value = "";
      select.replaceChildren(unavailable);
      $("[data-home-error]").textContent = "Couldn't load topics. Choose a valid .txt question file to continue.";
      $("[data-home-error]").hidden = false;
      updateHome();
    }
  }

  $("[data-topic]").addEventListener("change", (event) => selectTopic(event.target.value));

  $("#question-file").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const errorBox = $("[data-home-error]");
    errorBox.hidden = true;
    try {
      if (!file.name.toLowerCase().endsWith(".txt")) throw new Error("Choose a UTF-8 .txt file. Open the file format guide for an example.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Please choose a question file smaller than 5 MB.");
      const report = window.QuizCore.inspectQuestionBank(await file.text());
      if (!report.questions.length) {
        throw new Error("No usable questions were found. " + (report.errors[0]?.message || "Check the file format guide."));
      }
      $("[data-topic]").value = "custom";
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
  timerSettings.hidden = false;
  timerSecondsInput.disabled = !timerEnabledInput.checked;
  timerEnabledInput.addEventListener("change", () => {
    timerSettings.hidden = false;
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
    if (!Number.isInteger(count) || count < 1 || count > Math.min(10, state.bankQuestions.length)) {
      errorBox.textContent = `Choose a whole number from 1 to ${Math.min(10, state.bankQuestions.length)}.`;
      errorBox.hidden = false;
      $("[data-start]").disabled = true;
      return;
    }
    errorBox.hidden = true;
    $("[data-start]").disabled = state.bankQuestions.length === 0;
  });
  $("[data-next]").addEventListener("click", nextQuestion);
  $$("[data-review-filter]").forEach((button) => button.addEventListener("click", () => {
    applyReviewFilter(button.dataset.reviewFilter);
  }));
  $("[data-print]").addEventListener("click", () => {
    if (!$("[data-screen='results']").hidden) window.print();
  });
  $("[data-retry]").addEventListener("click", startQuiz);
  $$('[data-home]').forEach((button) => button.addEventListener("click", () => {
    updateLatestResult();
    showScreen("home");
  }));
  $("[data-clear-latest]").addEventListener("click", () => {
    if (window.QuizCore.clearLatestResult(getBrowserStorage())) {
      updateLatestResult();
      announce("The saved result was cleared from this device.");
    } else {
      announce("This browser could not clear the saved result.");
    }
  });
  $$('[data-history-open]').forEach((button) => button.addEventListener("click", () => {
    updateHistory();
    showScreen("history");
  }));
  $("[data-history-back]").addEventListener("click", () => showScreen("home"));
  $("[data-history-clear]").addEventListener("click", () => {
    if (window.QuizCore.clearHistory(getBrowserStorage())) {
      updateHistory();
      announce("Quiz history was cleared from this device.");
    } else {
      announce("This browser could not clear quiz history.");
    }
  });
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

  updateLatestResult();
  updateHistory();
  loadDefaultQuestions();
})();
