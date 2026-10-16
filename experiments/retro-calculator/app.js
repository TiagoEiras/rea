// DOM wiring for the retro calculator: buttons, keyboard, menus and history.
(function start() {
  "use strict";

  const { Calculator } = globalThis.RetroCalculator;
  const calc = new Calculator();

  const valueEl = document.getElementById("value");
  const expressionEl = document.getElementById("expression");
  const memoryFlag = document.getElementById("memory-flag");
  const historyPanel = document.getElementById("history");
  const historyList = document.getElementById("history-list");
  const historyEmpty = document.getElementById("history-empty");
  const about = document.getElementById("about");

  // Same shortcuts as the Windows calculator's standard mode.
  const KEYBOARD = {
    Enter: "=",
    "=": "=",
    Backspace: "back",
    Delete: "CE",
    Escape: "C",
    ",": ".",
    ".": ".",
    "@": "sqrt",
    q: "sqr",
    r: "inv",
    F9: "neg",
    "%": "%",
    "+": "+",
    "-": "-",
    "*": "*",
    "/": "/",
  };
  const CTRL_KEYBOARD = { l: "MC", r: "MR", m: "MS", p: "M+", q: "M-" };

  function render() {
    valueEl.textContent = calc.display;
    valueEl.classList.toggle("error", calc.error !== null);
    valueEl.classList.toggle(
      "long",
      calc.error === null && calc.display.length > 14,
    );
    expressionEl.textContent = calc.expression;
    memoryFlag.textContent = calc.hasMemory ? "M" : " ";
    renderHistory();
  }

  function renderHistory() {
    historyList.replaceChildren(
      ...calc.history.map((item) => {
        const li = document.createElement("li");
        const expression = document.createElement("span");
        const result = document.createElement("strong");
        expression.textContent = item.expression;
        result.textContent = item.result;
        li.append(expression, result);
        return li;
      }),
    );
    historyEmpty.hidden = calc.history.length > 0;
  }

  function press(key) {
    calc.press(key);
    render();
  }

  function flash(key) {
    const button = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (!button) return;
    button.classList.add("pressed");
    setTimeout(() => button.classList.remove("pressed"), 110);
  }

  document.querySelectorAll("[data-key]").forEach((button) => {
    button.addEventListener("click", () => press(button.dataset.key));
  });

  document.addEventListener("keydown", (event) => {
    if (about.open) return;
    if (event.ctrlKey || event.metaKey) {
      const command = { c: copy, v: paste, h: toggleHistory }[
        event.key.toLowerCase()
      ];
      const key = CTRL_KEYBOARD[event.key.toLowerCase()];
      if (command) {
        event.preventDefault();
        command();
      } else if (key) {
        event.preventDefault();
        flash(key);
        press(key);
      }
      return;
    }
    const key = /^[0-9]$/.test(event.key) ? event.key : KEYBOARD[event.key];
    if (!key) return;
    event.preventDefault();
    flash(key);
    press(key);
  });

  async function copy() {
    if (calc.error) return;
    try {
      await navigator.clipboard.writeText(calc.display);
    } catch {
      // Clipboard access can be denied; copying is best effort.
    }
  }

  async function paste() {
    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    const normalized = text.trim().replace(/\./g, "").replace(",", ".");
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) return;
    calc.press("CE");
    for (const char of normalized.replace("-", "")) calc.press(char);
    if (normalized.startsWith("-")) calc.press("neg");
    render();
  }

  function toggleHistory() {
    historyPanel.hidden = !historyPanel.hidden;
    setChecked("history", !historyPanel.hidden);
  }

  function toggleCrt() {
    setChecked("crt", document.body.classList.toggle("crt"));
  }

  function setChecked(command, checked) {
    document
      .querySelector(`[data-command="${command}"]`)
      .setAttribute("aria-checked", String(checked));
  }

  const COMMANDS = {
    copy,
    paste,
    history: toggleHistory,
    crt: toggleCrt,
    about: () => about.showModal(),
  };

  function closeMenus() {
    document.querySelectorAll(".menu-title").forEach((title) => {
      title.setAttribute("aria-expanded", "false");
      title.nextElementSibling.hidden = true;
    });
  }

  document.querySelectorAll(".menu-title").forEach((title) => {
    title.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = title.getAttribute("aria-expanded") === "true";
      closeMenus();
      if (open) return;
      title.setAttribute("aria-expanded", "true");
      title.nextElementSibling.hidden = false;
    });
  });

  document.querySelectorAll("[data-command]").forEach((item) => {
    item.addEventListener("click", () => {
      closeMenus();
      COMMANDS[item.dataset.command]();
    });
  });

  document.addEventListener("click", closeMenus);

  render();
})();
