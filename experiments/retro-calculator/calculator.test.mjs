// Run with: node --test experiments/retro-calculator/calculator.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import "./calculator.js";

const { Calculator, ERRORS } = globalThis.RetroCalculator;

function run(keys) {
  const calc = new Calculator();
  for (const key of keys.split(" ")) calc.press(key);
  return calc;
}

test("evaluates left to right like standard mode", () => {
  assert.equal(run("2 + 3 * 4 =").display, "20");
  assert.equal(run("1 0 - 4 / 2 =").display, "3");
});

test("repeats the last operation on consecutive equals", () => {
  assert.equal(run("5 + 3 = = =").display, "14");
  assert.equal(run("5 + =").display, "10");
});

test("replaces the pending operator without computing", () => {
  const calc = run("9 + * 2 =");
  assert.equal(calc.display, "18");
  assert.equal(calc.expression, "9 × 2 =");
});

test("hides floating point noise and formats pt-BR", () => {
  assert.equal(run(". 1 + . 2 =").display, "0,3");
  assert.equal(run("1 2 3 4 5 6 7 * 1 0 =").display, "12.345.670");
});

test("applies unary operations to the current operand", () => {
  assert.equal(run("9 sqrt").display, "3");
  assert.equal(run("2 + 3 sqr =").display, "11");
  assert.equal(run("4 inv").display, "0,25");
});

test("percent follows the pending operator", () => {
  assert.equal(run("2 0 0 + 1 0 % =").display, "220");
  assert.equal(run("5 0 * 1 0 % =").display, "5");
  assert.equal(run("5 0 %").display, "0");
});

test("reports errors and blocks input until cleared", () => {
  const calc = run("7 / 0 =");
  assert.equal(calc.display, ERRORS.divideByZero);
  calc.press("+");
  assert.equal(calc.display, ERRORS.divideByZero);
  calc.press("C");
  assert.equal(calc.display, "0");
  assert.equal(run("0 / 0 =").display, ERRORS.undefinedResult);
  assert.equal(run("4 neg sqrt").display, ERRORS.invalidInput);
  assert.equal(run("0 inv").display, ERRORS.divideByZero);
});

test("edits the entry with backspace, sign and clear entry", () => {
  assert.equal(run("1 2 3 back").display, "12");
  assert.equal(run("5 back").display, "0");
  assert.equal(run("1 2 neg").display, "-12");
  assert.equal(run("8 + 5 CE =").display, "8");
});

test("keeps memory across clears", () => {
  const calc = run("6 MS C 2 + MR =");
  assert.equal(calc.display, "8");
  calc.press("M+");
  calc.press("M+");
  assert.equal(calc.memory, 22);
  calc.press("3");
  calc.press("M-");
  assert.equal(calc.memory, 19);
  calc.press("MC");
  assert.equal(calc.hasMemory, false);
});

test("limits entry to sixteen digits and records history", () => {
  assert.equal(run("9 9 9 9 9 9 9 9 9 9 9 9 9 9 9 9 9").entry.length, 16);
  const calc = run("1 + 1 = 2 * 3 =");
  assert.deepEqual(
    calc.history.map((item) => `${item.expression} ${item.result}`),
    ["2 × 3 = 6", "1 + 1 = 2"],
  );
});
