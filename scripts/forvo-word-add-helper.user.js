// ==UserScript==
// @name         Forvo Word Add Helper
// @namespace    https://forvo.com/
// @version      0.9
// @description  Fill and optionally submit the Forvo word-add form from Japanese Custom Study URL hints.
// @match        https://forvo.com/word-add/*
// @match        https://*.forvo.com/word-add/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const LANGUAGE_VALUES = {
    ja: "76"
  };

  const params = new URLSearchParams(window.location.search);
  const requestedAutoSubmit = parseBooleanParam(
    params.get("jcs_autosubmit")
  );
  const requestedLanguage = params.get("jcs_lang") || "ja";
  const requestedPhrase = parseBooleanParam(params.get("jcs_phrase"));
  const requestedPersonName = parseBooleanParam(
    params.get("jcs_person_name")
  );

  let helperBar = null;
  let statusNode = null;

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
      tone === "error"
        ? "#b91c1c"
        : tone === "success"
          ? "#166534"
          : "#4b5563";
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
    if (!window.jQuery) {
      return;
    }

    try {
      const $select = window.jQuery(select);

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
    if (!window.jQuery) {
      return;
    }

    try {
      const $select = window.jQuery(select);
      const instance = $select.data("ui-selectmenu");
      const option = select.querySelector(`option[value="${desiredValue}"]`);

      if (!instance || !(option instanceof HTMLOptionElement)) {
        return;
      }

      instance._trigger(
        "change",
        window.jQuery.Event("selectmenuchange"),
        {
          item: {
            value: desiredValue,
            label: option.textContent?.trim() || "",
            element: option
          }
        }
      );
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

    addButton.click();
    setStatus("Submitting...", "success");
  }

  const observer = new MutationObserver(() => {
    ensureHelperBar();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  ensureHelperBar();

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
