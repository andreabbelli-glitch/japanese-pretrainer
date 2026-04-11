// ==UserScript==
// @name         Forvo Word Add Helper
// @namespace    https://forvo.com/
// @version      0.7
// @description  Fill the Forvo word-add form from Japanese Custom Study URL hints.
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
      const filled = await fillForvoForm();

      if (filled) {
        setStatus("Form filled", "success");
        return;
      }

      setStatus("Add still disabled", "error");
    });

    const fillAndAddButton = buildButton("Fill + Add", async () => {
      const filled = await fillForvoForm();

      if (!filled) {
        setStatus("Add still disabled", "error");
        return;
      }

      const addButton = document.querySelector("#addBtn");

      if (!(addButton instanceof HTMLButtonElement) || addButton.disabled) {
        setStatus("Add still disabled", "error");
        return;
      }

      addButton.click();
      setStatus("Submitting...", "neutral");
    });

    statusNode = document.createElement("span");
    statusNode.style.fontSize = "14px";
    statusNode.style.color = "#4b5563";
    statusNode.textContent = "Ready";

    helperBar.append(fillButton, fillAndAddButton, statusNode);
    actions.append(helperBar);

    return helperBar;
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

  function answerPhraseQuestion(isPhrase) {
    const hidden = document.querySelector("#isPhraseHidden");
    const button = document.querySelector(
      isPhrase ? "#btnPhraseYes" : "#btnPhraseNo"
    );

    if (hidden instanceof HTMLInputElement && hidden.value !== (isPhrase ? "1" : "0")) {
      hidden.value = isPhrase ? "1" : "0";
      triggerInputEvents(hidden);
    }

    if (isVisible(button)) {
      button.click();
      return true;
    }

    return hidden instanceof HTMLInputElement && hidden.value === (isPhrase ? "1" : "0");
  }

  function answerPersonNameQuestion(isPersonName) {
    const checkbox = document.querySelector("#person_name");
    const button = document.querySelector(
      isPersonName ? "#btnPersonNameYes" : "#btnPersonNameNo"
    );

    if (checkbox instanceof HTMLInputElement && checkbox.checked !== isPersonName) {
      checkbox.checked = isPersonName;
      triggerInputEvents(checkbox);
    }

    if (isVisible(button)) {
      button.click();
      return true;
    }

    return (
      checkbox instanceof HTMLInputElement && checkbox.checked === isPersonName
    );
  }

  function tickWordField() {
    const wordInput = document.querySelector("#word");

    if (!(wordInput instanceof HTMLInputElement)) {
      return;
    }

    triggerInputEvents(wordInput);
    wordInput.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  }

  function isAddReady() {
    const addButton = document.querySelector("#addBtn");
    return addButton instanceof HTMLButtonElement && !addButton.disabled;
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function fillForvoForm() {
    tickWordField();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      selectLanguage();
      await wait(200);

      if (requestedPhrase !== null) {
        answerPhraseQuestion(requestedPhrase);
        await wait(200);
      }

      if (requestedPersonName !== null) {
        answerPersonNameQuestion(requestedPersonName);
        await wait(150);
      }

      tickWordField();
      await wait(250);

      if (isAddReady()) {
        return true;
      }
    }

    return isAddReady();
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
    requestedPersonName !== null
  ) {
    window.setTimeout(() => {
      void fillForvoForm().then((filled) => {
        if (filled) {
          setStatus("Auto-filled from URL", "success");
          return;
        }

        setStatus("Add still disabled", "error");
      });
    }, 300);
  } else {
    setStatus("Ready", "neutral");
  }
})();
