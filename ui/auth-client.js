"use strict";

(() => {
  const $ = selector => document.querySelector(selector);
  const dialog = $("[data-auth-dialog]");
  const form = $("[data-auth-form]");
  const nav = $("[data-account-nav]");
  let mode = "login";
  let busy = false;
  let authGeneration = 0;
  let user = null;
  let returnFocus = null;

  async function api(path, body) {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || "Please try again.");
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function setUser(value) {
    user = value;
    nav.textContent = user ? "My profile" : "Sign in";
    nav.disabled = false;
  }
  function setBusy(value) {
    busy = value;
    if (value) authGeneration++;
    form.setAttribute("aria-busy", String(value));
    $("[data-auth-submit]").disabled = value;
    $("[data-auth-toggle]").disabled = value;
    $("[data-auth-logout]").disabled = value;
  }
  function showForm(nextMode) {
    mode = nextMode;
    const registering = mode === "register";
    $("#auth-title").textContent = registering ? "Create your account" : "Welcome back";
    $("[data-auth-intro]").hidden = false;
    $("[data-profile-panel]").hidden = true;
    form.hidden = false;
    $("[data-name-field]").hidden = !registering;
    $("[data-auth-name]").required = registering;
    $("[data-auth-name]").disabled = !registering;
    $("[data-password-help]").hidden = !registering;
    const password = $("[data-auth-password]");
    password.value = "";
    password.minLength = registering ? 15 : 1;
    password.autocomplete = registering ? "new-password" : "current-password";
    $("[data-auth-submit]").textContent = registering ? "Create account" : "Sign in";
    $("[data-auth-toggle]").textContent = registering ? "Already registered? Sign in" : "Create an account";
    $("[data-auth-error]").hidden = true;
    $("[data-auth-status]").textContent = "";
  }
  function showProfile(profile) {
    setUser(profile);
    form.reset();
    form.hidden = true;
    $("[data-auth-intro]").hidden = true;
    $("#auth-title").textContent = "Your profile";
    $("[data-profile-panel]").hidden = false;
    $("[data-profile-name]").textContent = profile.name;
    $("[data-profile-email]").textContent = profile.email;
    $("[data-profile-date]").textContent = new Date(profile.createdAt).toLocaleDateString();
    $("[data-profile-error]").hidden = true;
  }
  function open() {
    if (!dialog.open) {
      returnFocus = document.activeElement;
      dialog.showModal();
    }
  }
  async function openAccount() {
    if (busy) return;
    open();
    if (!user) {
      showForm("login");
      $("[data-auth-email]").focus();
      return;
    }
    try {
      const data = await api("/api/profile");
      showProfile(data.user);
      $("[data-auth-close]").focus();
    } catch (error) {
      if (error.status === 401) { setUser(null); showForm("login"); }
      $("[data-auth-status]").textContent = error.message;
    }
  }
  nav.addEventListener("click", openAccount);
  $("[data-auth-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    $("[data-auth-password]").value = "";
    if (location.pathname.startsWith("/profile") || location.search === "?auth=login") history.replaceState(null, "", "/");
    returnFocus?.focus();
  });
  $("[data-auth-toggle]").addEventListener("click", () => {
    showForm(mode === "login" ? "register" : "login");
    $(mode === "register" ? "[data-auth-name]" : "[data-auth-email]").focus();
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    setBusy(true);
    $("[data-auth-error]").hidden = true;
    $("[data-auth-status]").textContent = mode === "register" ? "Creating your account…" : "Signing in…";
    try {
      const data = await api(`/api/auth/${mode}`, {
        name: $("[data-auth-name]").value,
        email: $("[data-auth-email]").value,
        password: $("[data-auth-password]").value
      });
      showProfile(data.user);
      $("[data-auth-status]").textContent = "You are signed in.";
      $("[data-auth-close]").focus();
    } catch (error) {
      $("[data-auth-error]").textContent = error.message;
      $("[data-auth-error]").hidden = false;
      $("[data-auth-status]").textContent = "";
    } finally { $("[data-auth-password]").value = ""; setBusy(false); }
  });
  $("[data-auth-logout]").addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api("/api/auth/logout", {});
      setUser(null);
      $("[data-profile-name]").textContent = "";
      $("[data-profile-email]").textContent = "";
      $("[data-profile-date]").textContent = "";
      showForm("login");
      $("[data-auth-status]").textContent = "You have signed out.";
      history.replaceState(null, "", "/");
      $("[data-auth-email]").focus();
    } catch (error) {
      $("[data-profile-error]").textContent = error.message;
      $("[data-profile-error]").hidden = false;
    } finally { setBusy(false); }
  });
  async function refreshSession() {
    if (busy) return;
    const generation = authGeneration;
    try {
      const data = await api("/api/auth/session");
      if (busy || generation !== authGeneration) return;
      setUser(data.user);
      if (dialog.open && user && !$("[data-profile-panel]").hidden) showProfile(user);
    }
    catch {
      nav.disabled = false;
      nav.textContent = "Sign in";
      // Opening the form still lets the user see and retry a server error.
    }
  }
  window.addEventListener("pageshow", async () => {
    await refreshSession();
    if (location.pathname.startsWith("/profile") || new URLSearchParams(location.search).get("auth") === "login") await openAccount();
    else if (dialog.open && !user && !$("[data-profile-panel]").hidden) showForm("login");
  });
  window.addEventListener("focus", async () => {
    await refreshSession();
    if (dialog.open && !user && !$("[data-profile-panel]").hidden) showForm("login");
  });
})();
