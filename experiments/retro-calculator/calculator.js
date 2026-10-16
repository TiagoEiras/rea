// Standard-mode calculator engine for the retro calculator experiment.
// Plain script (no imports) so index.html also works when opened from disk;
// it publishes `RetroCalculator` on globalThis for the page and the tests.
(function register(root) {
  "use strict";

  const MAX_DIGITS = 16;
  const SIGNIFICANT = 15;

  const OPERATORS = {
    "+": { symbol: "+", apply: (a, b) => a + b },
    "-": { symbol: "−", apply: (a, b) => a - b },
    "*": { symbol: "×", apply: (a, b) => a * b },
    "/": { symbol: "÷", apply: divide },
  };

  const ERRORS = {
    divideByZero: "Não é possível dividir por zero",
    undefinedResult: "Resultado indefinido",
    invalidInput: "Entrada inválida",
    overflow: "Estouro",
  };

  class CalcError extends Error {
    constructor(message) {
      super(message);
      this.name = "CalcError";
    }
  }

  function divide(a, b) {
    if (b === 0)
      throw new CalcError(
        a === 0 ? ERRORS.undefinedResult : ERRORS.divideByZero,
      );
    return a / b;
  }

  const UNARY = {
    sqrt: {
      label: (x) => `√(${x})`,
      apply: (v) => {
        if (v < 0) throw new CalcError(ERRORS.invalidInput);
        return Math.sqrt(v);
      },
    },
    sqr: { label: (x) => `sqr(${x})`, apply: (v) => v * v },
    inv: { label: (x) => `1/(${x})`, apply: (v) => divide(1, v) },
  };

  // Round away binary noise (0.1 + 0.2) and reject non-finite results.
  function normalize(value) {
    if (!Number.isFinite(value)) throw new CalcError(ERRORS.overflow);
    const rounded = Number.parseFloat(value.toPrecision(SIGNIFICANT));
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  // Canonical text: "." decimal separator, no grouping.
  function toText(value) {
    const abs = Math.abs(value);
    if (abs !== 0 && (abs >= 1e16 || abs < 1e-15)) {
      return value.toExponential().replace(/\.?0+e/, "e");
    }
    return String(value);
  }

  // pt-BR presentation: "." groups thousands, "," separates decimals.
  function formatDisplay(text) {
    if (/e/.test(text)) return text.replace(".", ",");
    const negative = text.startsWith("-");
    const body = negative ? text.slice(1) : text;
    const [integer, fraction] = body.split(".");
    const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const decimal = fraction === undefined ? "" : `,${fraction}`;
    return `${negative ? "-" : ""}${grouped}${decimal}`;
  }

  class Calculator {
    constructor() {
      this.memory = null;
      this.history = [];
      this.clear();
    }

    clear() {
      this.entry = "0";
      this.accumulator = null;
      this.operator = null;
      this.expression = "";
      this.typing = false;
      this.operandReady = false;
      this.afterEquals = false;
      this.repeat = null;
      this.error = null;
    }

    get value() {
      return Number.parseFloat(this.entry);
    }

    get display() {
      return this.error ?? formatDisplay(this.entry);
    }

    get hasMemory() {
      return this.memory !== null;
    }

    press(key) {
      if (/^[0-9]$/.test(key)) return this.digit(key);
      if (key in OPERATORS) return this.binary(key);
      if (key in UNARY) return this.unary(key);
      const actions = {
        ".": () => this.decimal(),
        "=": () => this.equals(),
        "%": () => this.percent(),
        neg: () => this.negate(),
        back: () => this.backspace(),
        CE: () => this.clearEntry(),
        C: () => this.clear(),
        MC: () => this.memoryClear(),
        MR: () => this.memoryRecall(),
        MS: () => this.memoryStore(),
        "M+": () => this.memoryAdd(1),
        "M-": () => this.memoryAdd(-1),
      };
      const action = actions[key];
      if (!action) throw new TypeError(`Unknown key: ${key}`);
      if (this.error && !["C", "CE"].includes(key)) return undefined;
      return action();
    }

    startEntry(text) {
      if (this.error || this.afterEquals) {
        const { memory, history } = this;
        this.clear();
        Object.assign(this, { memory, history });
      }
      this.entry = text;
      this.typing = true;
      this.operandReady = true;
    }

    digit(d) {
      if (!this.typing) return this.startEntry(d);
      const digits = this.entry.replace(/[-.]/g, "").length;
      if (digits >= MAX_DIGITS) return undefined;
      this.entry =
        this.entry === "0" ? d : this.entry === "-0" ? `-${d}` : this.entry + d;
      return undefined;
    }

    decimal() {
      if (!this.typing) return this.startEntry("0.");
      if (!this.entry.includes(".")) this.entry += ".";
      return undefined;
    }

    setResult(value) {
      this.entry = toText(normalize(value));
      this.typing = false;
    }

    guard(fn) {
      try {
        fn();
      } catch (error) {
        if (!(error instanceof CalcError)) throw error;
        this.error = error.message;
        this.typing = false;
      }
    }

    binary(op) {
      if (this.error) return;
      this.guard(() => {
        if (this.operator && this.operandReady) {
          this.setResult(
            OPERATORS[this.operator].apply(this.accumulator, this.value),
          );
        }
        this.accumulator = this.value;
        this.operator = op;
        this.expression = `${formatDisplay(this.entry)} ${OPERATORS[op].symbol}`;
        this.typing = false;
        this.operandReady = false;
        this.afterEquals = false;
      });
    }

    equals() {
      this.guard(() => {
        let left;
        let op;
        let right;
        if (this.operator) {
          left = this.accumulator;
          op = this.operator;
          right = this.operandReady ? this.value : this.accumulator;
        } else if (this.repeat) {
          left = this.value;
          ({ op, right } = this.repeat);
        } else {
          this.expression = `${formatDisplay(this.entry)} =`;
          this.typing = false;
          this.afterEquals = true;
          return;
        }
        const expression = `${formatDisplay(toText(left))} ${OPERATORS[op].symbol} ${formatDisplay(toText(right))} =`;
        this.expression = expression;
        this.setResult(OPERATORS[op].apply(left, right));
        this.history.unshift({ expression, result: formatDisplay(this.entry) });
        this.repeat = { op, right };
        this.accumulator = null;
        this.operator = null;
        this.operandReady = false;
        this.afterEquals = true;
      });
    }

    unary(name) {
      if (this.error) return;
      const { label, apply } = UNARY[name];
      this.guard(() => {
        const prefix = this.operator
          ? `${formatDisplay(toText(this.accumulator))} ${OPERATORS[this.operator].symbol} `
          : "";
        this.expression = `${prefix}${label(formatDisplay(this.entry))}`;
        this.setResult(apply(this.value));
        this.operandReady = true;
      });
    }

    // Windows semantics: a% of the left operand for + and −, a/100 for × and ÷.
    percent() {
      const v = this.value;
      const base =
        this.operator === "+" || this.operator === "-"
          ? (this.accumulator * v) / 100
          : this.operator
            ? v / 100
            : 0;
      this.setResult(base);
      this.operandReady = true;
    }

    negate() {
      if (this.typing) {
        this.entry = this.entry.startsWith("-")
          ? this.entry.slice(1)
          : `-${this.entry}`;
        return;
      }
      this.setResult(-this.value);
      this.operandReady = true;
    }

    backspace() {
      if (this.afterEquals) {
        this.expression = "";
        return;
      }
      if (!this.typing) return;
      const next = this.entry.slice(0, -1);
      this.entry = next === "" || next === "-" ? "0" : next;
    }

    clearEntry() {
      if (this.error) {
        const { memory, history } = this;
        this.clear();
        Object.assign(this, { memory, history });
        return;
      }
      this.entry = "0";
      this.typing = false;
      this.operandReady = this.operator !== null;
    }

    memoryClear() {
      this.memory = null;
    }

    memoryRecall() {
      if (this.memory === null) return;
      if (this.afterEquals) this.afterEquals = false;
      this.entry = toText(this.memory);
      this.typing = false;
      this.operandReady = true;
    }

    memoryStore() {
      this.memory = this.value;
      this.typing = false;
    }

    memoryAdd(sign) {
      this.guard(() => {
        this.memory = normalize((this.memory ?? 0) + sign * this.value);
        this.typing = false;
      });
    }
  }

  root.RetroCalculator = { Calculator, formatDisplay, ERRORS };
})(globalThis);
