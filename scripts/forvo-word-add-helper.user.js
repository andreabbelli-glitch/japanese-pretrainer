// ==UserScript==
// @name         Forvo Word Add Helper
// @namespace    https://forvo.com/
// @version      0.11
// @description  Fill and optionally submit the Forvo word-add form from Japanese Custom Study URL hints.
// @match        https://forvo.com/word-add*
// @match        https://*.forvo.com/word-add*
// @match        https://forvo.com/word-add-success/*
// @match        https://*.forvo.com/word-add-success/*
// @grant        window.close
// @grant        unsafeWindow
// ==/UserScript==

/* global unsafeWindow */

(function () {
  "use strict";

  const LANGUAGE_VALUES = {
    ja: "76"
  };
  const AUTO_CLOSE_DELAY_MS = 5000;
  const AUTO_CLOSE_MARKER_TTL_MS = 10 * 60 * 1000;
  const SUBMIT_MARKER_KEY = "jcsForvoWordAddAutoClose";

  const params = new URLSearchParams(window.location.search);
  const requestedAutoSubmit = parseBooleanParam(params.get("jcs_autosubmit"));
  const requestedAutoClose = parseBooleanParam(params.get("jcs_autoclose"));
  const requestedLanguage = params.get("jcs_lang") || "ja";
  const requestedPhrase = parseBooleanParam(params.get("jcs_phrase"));
  const requestedPersonName = parseBooleanParam(params.get("jcs_person_name"));

  let helperBar = null;
  let statusNode = null;
  let autoCloseScheduled = false;

  function parseBooleanParam(value) {
    if (value === "1" || value === "true" || value === "yes") {
      return true;
    }

    if (value === "0" || value === "false" || value === "no") {
      return false;
    }

    return null;
  }

  function setStatus(message, tone) {
    ensureHelperBar();

    if (!statusNode) {
      return;
    }

    statusNode.textContent = message;
    statusNode.dataset.tone = tone || "neutral";
    statusNode.style.color =
      tone === "error" ? "#b91c1c" : tone === "success" ? "#166534" : "#4b5563";
  }

  function shouldAutoCloseThisTab() {
    if (requestedAutoClose !== null) {
      return requestedAutoClose;
    }

    return requestedAutoSubmit === true || hasRecentAutoCloseMarker();
  }

  function getPageJQuery() {
    try {
      const pageWindow =
        typeof unsafeWindow === "undefined" ? window : unsafeWindow;

      return pageWindow.jQuery || window.jQuery;
    } catch (error) {
      void error;
      return window.jQuery;
    }
  }

  function readAutoCloseMarker() {
    try {
      const rawValue = window.sessionStorage.getItem(SUBMIT_MARKER_KEY);

      if (!rawValue) {
        return null;
      }

      const marker = JSON.parse(rawValue);

      if (
        typeof marker !== "object" ||
        marker === null ||
        typeof marker.expiresAt !== "number"
      ) {
        window.sessionStorage.removeItem(SUBMIT_MARKER_KEY);
        return null;
      }

      if (marker.expiresAt < Date.now()) {
        window.sessionStorage.removeItem(SUBMIT_MARKER_KEY);
        return null;
      }

      return marker;
    } catch (error) {
      void error;
      window.sessionStorage.removeItem(SUBMIT_MARKER_KEY);
      return null;
    }
  }

  function hasRecentAutoCloseMarker() {
    return readAutoCloseMarker() !== null;
  }

  function recordAutoCloseMarker() {
    if (!shouldAutoCloseThisTab()) {
      return;
    }

    try {
      window.sessionStorage.setItem(
        SUBMIT_MARKER_KEY,
        JSON.stringify({
          expiresAt: Date.now() + AUTO_CLOSE_MARKER_TTL_MS,
          pathname: window.location.pathname,
          submittedAt: Date.now()
        })
      );
    } catch (error) {
      void error;
    }
  }

  function clearAutoCloseMarker() {
    try {
      window.sessionStorage.removeItem(SUBMIT_MARKER_KEY);
    } catch (error) {
      void error;
    }
  }

  function isConfirmationUrl() {
    const pathname = window.location.pathname.replace(/\/+$/u, "");

    return (
      pathname.startsWith("/word-add-success/") ||
      /\/word-add\/[^/]+\/(?:added|success|ok|thanks|thank-you|confirm|confirmed|confirmation)$/iu.test(
        pathname
      )
    );
  }

  function isConfirmationText(text) {
    const normalized = text.replace(/\s+/gu, " ").trim();

    return (
      /\b(?:word|phrase|request)\b.{0,80}\b(?:added|submitted|requested|sent|received)\b/iu.test(
        normalized
      ) ||
      /\b(?:added|submitted|requested|sent|received)\b.{0,80}\b(?:word|phrase|request|pronunciation)\b/iu.test(
        normalized
      ) ||
      /\bthanks?\b.{0,80}\b(?:adding|requesting|contributing|request)\b/iu.test(
        normalized
      )
    );
  }

  function isConfirmationPage() {
    if (
      document.querySelector("#formWordAdd") ||
      document.querySelector("#addBtn") ||
      document.querySelector("#word")
    ) {
      return false;
    }

    if (isConfirmationUrl()) {
      return true;
    }

    return isConfirmationText(document.body?.innerText || "");
  }

  function scheduleAutoClose(reason) {
    if (autoCloseScheduled || !shouldAutoCloseThisTab()) {
      return;
    }

    autoCloseScheduled = true;
    setStatus(`Closing tab after ${reason}...`, "success");

    window.setTimeout(() => {
      clearAutoCloseMarker();
      window.close();
    }, AUTO_CLOSE_DELAY_MS);
  }

  function maybeScheduleAutoClose() {
    if (!shouldAutoCloseThisTab()) {
      return;
    }

    if (isAlreadyDefinedInJapanese()) {
      scheduleAutoClose("existing Japanese entry");
      return;
    }

    if (isConfirmationPage()) {
      scheduleAutoClose("Forvo confirmation");
    }
  }

  function getElementText(element) {
    if (element instanceof HTMLInputElement) {
      return `${element.value || ""} ${element.getAttribute("aria-label") || ""}`;
    }

    return `${element.textContent || ""} ${element.getAttribute("aria-label") || ""}`;
  }

  function isCookieConsentText(text) {
    return /\b(cookie|cookies|consent|privacy|gdpr|partners|vendors|purposes|legitimate interest)\b/iu.test(
      text
    );
  }

  function isCookieAcceptText(text) {
    const normalized = text.replace(/\s+/gu, " ").trim();

    if (
      /\b(reject|decline|deny|disagree|manage|settings|preferences|customi[sz]e|more)\b/iu.test(
        normalized
      )
    ) {
      return false;
    }

    return /\b(accept all|accept|agree|i agree|allow all|consent|accepter|aceptar|accetta|accetto)\b/iu.test(
      normalized
    );
  }

  function findCookieConsentRoots() {
    const selectors = [
      "#onetrust-banner-sdk",
      "#qc-cmp2-ui",
      ".qc-cmp2-container",
      ".fc-consent-root",
      "[id*='consent' i]",
      "[class*='consent' i]",
      "[id*='cookie' i]",
      "[class*='cookie' i]",
      "[id*='cmp' i]",
      "[class*='cmp' i]"
    ];
    const roots = [];

    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (
          isVisible(element) &&
          isCookieConsentText(element.textContent || "")
        ) {
          roots.push(element);
        }
      }
    }

    return roots;
  }

  function findCookieAcceptButton() {
    const candidatesSelector =
      "button, [role='button'], input[type='button'], input[type='submit'], a";
    const roots = findCookieConsentRoots();

    for (const root of roots) {
      for (const candidate of root.querySelectorAll(candidatesSelector)) {
        if (
          isVisible(candidate) &&
          isCookieAcceptText(getElementText(candidate))
        ) {
          return candidate;
        }
      }
    }

    if (!isCookieConsentText(document.body?.innerText || "")) {
      return null;
    }

    for (const candidate of document.querySelectorAll(candidatesSelector)) {
      if (
        isVisible(candidate) &&
        isCookieAcceptText(getElementText(candidate))
      ) {
        return candidate;
      }
    }

    return null;
  }

  async function dismissCookieConsentIfPresent() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const button = findCookieAcceptButton();

      if (button instanceof HTMLElement) {
        button.click();
        setStatus("Cookie consent accepted", "success");
        await wait(700);
        return true;
      }

      await wait(150);
    }

    return false;
  }

  function buildButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.border = "1px solid #1d4ed8";
    button.style.background = "#2563eb";
    button.style.color = "#ffffff";
    button.style.borderRadius = "8px";
    button.style.padding = "10px 16px";
    button.style.fontSize = "15px";
    button.style.fontWeight = "600";
    button.style.cursor = "pointer";

    button.addEventListener("click", () => {
      void onClick();
    });

    return button;
  }

  function ensureHelperBar() {
    if (helperBar && helperBar.isConnected) {
      return helperBar;
    }

    const actions = document.querySelector("#formWordAdd .actions");

    if (!actions) {
      return null;
    }

    helperBar = document.createElement("div");
    helperBar.id = "jcs-forvo-helper";
    helperBar.style.display = "flex";
    helperBar.style.alignItems = "center";
    helperBar.style.flexWrap = "wrap";
    helperBar.style.gap = "12px";
    helperBar.style.marginTop = "14px";

    const fillButton = buildButton("Fill Forvo", async () => {
      await fillAndMaybeSubmit(false);
    });

    const fillAndAddButton = buildButton("Fill + Add", async () => {
      await fillAndMaybeSubmit(true);
    });

    statusNode = document.createElement("span");
    statusNode.style.fontSize = "14px";
    statusNode.style.color = "#4b5563";
    statusNode.textContent = "Ready";

    helperBar.append(fillButton, fillAndAddButton, statusNode);
    actions.append(helperBar);

    return helperBar;
  }

  function triggerInputEvents(element) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function refreshSelectmenu(select) {
    const jQuery = getPageJQuery();

    if (!jQuery) {
      return;
    }

    try {
      const $select = jQuery(select);

      if (typeof $select.selectmenu === "function") {
        $select.selectmenu("refresh");
      }

      $select.trigger("change");
      $select.trigger("selectmenuchange");
    } catch (error) {
      void error;
    }
  }

  function triggerSelectmenuChange(select, desiredValue) {
    const jQuery = getPageJQuery();

    if (!jQuery) {
      return;
    }

    try {
      const $select = jQuery(select);
      const instance = $select.data("ui-selectmenu");
      const option = select.querySelector(`option[value="${desiredValue}"]`);

      if (!instance || !(option instanceof HTMLOptionElement)) {
        return;
      }

      instance._trigger("change", jQuery.Event("selectmenuchange"), {
        item: {
          value: desiredValue,
          label: option.textContent?.trim() || "",
          element: option
        }
      });
    } catch (error) {
      void error;
    }
  }

  function selectLanguage() {
    const select = document.querySelector("#id_lang");
    const desiredValue = LANGUAGE_VALUES[requestedLanguage];

    if (!(select instanceof HTMLSelectElement) || !desiredValue) {
      return false;
    }

    if (select.value !== desiredValue) {
      select.value = desiredValue;
      triggerInputEvents(select);
      refreshSelectmenu(select);
      triggerSelectmenuChange(select, desiredValue);
    }

    return select.value === desiredValue;
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);

    return style.display !== "none" && style.visibility !== "hidden";
  }

  function isPhraseQuestionVisible() {
    return isVisible(document.querySelector("#question_phrase"));
  }

  function isPersonQuestionVisible() {
    return isVisible(document.querySelector("#question_person_name"));
  }

  function answerPhraseQuestion(isPhrase) {
    const button = document.querySelector(
      isPhrase ? "#btnPhraseYes" : "#btnPhraseNo"
    );

    if (isVisible(button)) {
      button.click();
      return isAddReady() || !isPhraseQuestionVisible();
    }

    return false;
  }

  function answerPersonNameQuestion(isPersonName) {
    const checkbox = document.querySelector("#person_name");
    const button = document.querySelector(
      isPersonName ? "#btnPersonNameYes" : "#btnPersonNameNo"
    );

    if (
      checkbox instanceof HTMLInputElement &&
      checkbox.checked !== isPersonName
    ) {
      checkbox.checked = isPersonName;
      triggerInputEvents(checkbox);
    }

    if (isVisible(button)) {
      button.click();
      return isAddReady() || !isPersonQuestionVisible();
    }

    return (
      checkbox instanceof HTMLInputElement && checkbox.checked === isPersonName
    );
  }

  function primeWordField() {
    const wordInput = document.querySelector("#word");

    if (!(wordInput instanceof HTMLInputElement)) {
      return;
    }

    wordInput.focus();
    wordInput.dispatchEvent(
      new KeyboardEvent("keyup", {
        bubbles: true,
        cancelable: true,
        key: wordInput.value.slice(-1) || "a"
      })
    );
    wordInput.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  }

  function isAddReady() {
    const addButton = document.querySelector("#addBtn");
    return addButton instanceof HTMLButtonElement && !addButton.disabled;
  }

  function isAlreadyDefinedInJapanese() {
    const currentLangsList = document.querySelector("#currentLangsList");
    const bodyText = document.body?.innerText || "";

    if (
      currentLangsList instanceof HTMLElement &&
      /Japanese/iu.test(currentLangsList.innerText || "")
    ) {
      return true;
    }

    return /already in Japanese \[ja\]/iu.test(bodyText);
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitFor(condition, timeoutMs, intervalMs) {
    const timeout = timeoutMs ?? 3000;
    const interval = intervalMs ?? 100;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeout) {
      if (condition()) {
        return true;
      }

      await wait(interval);
    }

    return condition();
  }

  async function selectLanguageReliably() {
    if (!selectLanguage()) {
      return false;
    }

    await wait(150);

    const select = document.querySelector("#id_lang");
    const desiredValue = LANGUAGE_VALUES[requestedLanguage];

    if (!(select instanceof HTMLSelectElement) || !desiredValue) {
      return false;
    }

    triggerSelectmenuChange(select, desiredValue);
    await wait(150);

    return select.value === desiredValue;
  }

  async function fillForvoForm() {
    if (isAlreadyDefinedInJapanese()) {
      setStatus("Already in Japanese", "neutral");
      return false;
    }

    await dismissCookieConsentIfPresent();
    primeWordField();

    await waitFor(
      () => isAlreadyDefinedInJapanese() || selectLanguage(),
      2000,
      100
    );

    await selectLanguageReliably();

    await waitFor(
      () =>
        isAlreadyDefinedInJapanese() ||
        isAddReady() ||
        isPhraseQuestionVisible() ||
        isPersonQuestionVisible(),
      3000,
      100
    );

    if (requestedPhrase !== null && isPhraseQuestionVisible()) {
      answerPhraseQuestion(requestedPhrase);
      await waitFor(
        () =>
          isAlreadyDefinedInJapanese() ||
          isAddReady() ||
          !isPhraseQuestionVisible(),
        1500,
        100
      );
    }

    if (requestedPersonName !== null && isPersonQuestionVisible()) {
      answerPersonNameQuestion(requestedPersonName);
      await waitFor(
        () =>
          isAlreadyDefinedInJapanese() ||
          isAddReady() ||
          !isPersonQuestionVisible(),
        1500,
        100
      );
    }

    if (isAddReady()) {
      return true;
    }

    if (isAlreadyDefinedInJapanese()) {
      setStatus("Already in Japanese", "neutral");
      return false;
    }

    return waitFor(
      () => isAlreadyDefinedInJapanese() || isAddReady(),
      1000,
      100
    );
  }

  async function fillAndMaybeSubmit(autoSubmit) {
    const filled = await fillForvoForm();

    if (isAlreadyDefinedInJapanese()) {
      setStatus("Already in Japanese", "neutral");
      scheduleAutoClose("existing Japanese entry");
      return;
    }

    if (!filled) {
      setStatus("Add still disabled", "error");
      return;
    }

    if (!autoSubmit) {
      setStatus("Form filled", "success");
      return;
    }

    const addButton = document.querySelector("#addBtn");

    if (!(addButton instanceof HTMLButtonElement) || addButton.disabled) {
      setStatus("Add still disabled", "error");
      return;
    }

    recordAutoCloseMarker();
    addButton.click();
    setStatus("Submitting...", "success");
  }

  const observer = new MutationObserver(() => {
    ensureHelperBar();
    maybeScheduleAutoClose();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  ensureHelperBar();
  maybeScheduleAutoClose();

  if (
    requestedLanguage in LANGUAGE_VALUES &&
    requestedPhrase !== null &&
    requestedPersonName !== null &&
    requestedAutoSubmit !== null
  ) {
    window.setTimeout(() => {
      void fillAndMaybeSubmit(requestedAutoSubmit);
    }, 300);
  } else {
    setStatus("Ready", "neutral");
  }
})();
