import test from "node:test";
import assert from "node:assert/strict";
import { editorKeyEdit } from "./editor-keydown.ts";

const at = (s) => s.indexOf("|");
const strip = (s) => s.replaceAll("|", "");
function run({ value, key, shiftKey = false, language = "python" }) {
  const a = at(value);
  return editorKeyEdit({
    value: strip(value),
    selectionStart: a,
    selectionEnd: a,
    key,
    shiftKey,
    language,
  });
}
function render(edit) {
  return (
    edit.value.slice(0, edit.selectionStart) +
    "|" +
    edit.value.slice(edit.selectionStart)
  );
}

test("Enter keeps the current indentation", () => {
  const edit = run({ value: "    x = 1|", key: "Enter" });
  assert.equal(render(edit), "    x = 1\n    |");
});

test("Enter adds one level after a Python colon", () => {
  const edit = run({ value: "for i in range(5):|", key: "Enter" });
  assert.equal(render(edit), "for i in range(5):\n    |");
});

test("Enter inside a nested Python block keeps the nested indent plus one", () => {
  const edit = run({ value: "for i in range(5):\n    if i:|", key: "Enter" });
  assert.equal(render(edit), "for i in range(5):\n    if i:\n        |");
});

test("Enter adds one level after a C brace", () => {
  const edit = run({
    value: "int main() {|",
    key: "Enter",
    language: "c",
  });
  assert.equal(render(edit), "int main() {\n    |");
});

test("Enter between braces expands into an indented block", () => {
  const edit = run({
    value: "int main() {|}",
    key: "Enter",
    language: "c",
  });
  assert.equal(render(edit), "int main() {\n    |\n}");
});

test("typing an opener inserts its pair with the cursor inside", () => {
  const edit = run({ value: "print|", key: "(" });
  assert.equal(render(edit), "print(|)");
});

test("typing an opener before a word char does not auto-close", () => {
  assert.equal(run({ value: "|print", key: "(" }), null);
});

test("typing a quote in empty space inserts a pair", () => {
  const edit = run({ value: "x = |", key: '"' });
  assert.equal(render(edit), 'x = "|"');
});

test("typing a quote after a word char does not auto-close", () => {
  assert.equal(run({ value: "don|", key: "'" }), null);
});

test("typing over a closing bracket moves past it", () => {
  const edit = run({ value: "print(x|)", key: ")" });
  assert.equal(render(edit), "print(x)|");
});

test("typing over a closing quote moves past it", () => {
  const edit = run({ value: 'x = "hi|"', key: '"' });
  assert.equal(render(edit), 'x = "hi"|');
});

test("Backspace between an empty pair deletes both", () => {
  const edit = run({ value: "print(|)", key: "Backspace" });
  assert.equal(render(edit), "print|");
});

test("Backspace between empty quotes deletes both", () => {
  const edit = run({ value: 'x = "|"', key: "Backspace" });
  assert.equal(render(edit), "x = |");
});

test("a closing brace on an indentation-only line dedents one level", () => {
  const edit = run({
    value: "int main() {\n    |",
    key: "}",
    language: "c",
  });
  assert.equal(render(edit), "int main() {\n}|");
});

test("Tab inserts four spaces at the cursor", () => {
  const edit = run({ value: "x = 1|", key: "Tab" });
  assert.equal(render(edit), "x = 1    |");
});

test("Tab with a selection indents every touched line", () => {
  const value = "one\n|two\nthree|\nfour";
  const a = value.indexOf("|");
  const b = value.lastIndexOf("|") - 1;
  const raw = strip(value);
  const edit = editorKeyEdit({
    value: raw,
    selectionStart: a,
    selectionEnd: b,
    key: "Tab",
    shiftKey: false,
    language: "python",
  });
  assert.equal(
    edit.value,
    "one\n    two\n    three\nfour",
  );
  assert.equal(edit.selectionStart, a + 4);
  assert.equal(edit.selectionEnd, b + 8);
});

test("Shift+Tab dedents the current line", () => {
  const edit = run({ value: "    x = 1|", key: "Tab", shiftKey: true });
  assert.equal(render(edit), "x = 1|");
});

test("unhandled keys return null", () => {
  assert.equal(run({ value: "x|", key: "a" }), null);
});

test("selection is wrapped in brackets", () => {
  const value = "nums = |1, 2|";
  const a = value.indexOf("|");
  const b = value.lastIndexOf("|") - 1;
  const raw = strip(value);
  const edit = editorKeyEdit({
    value: raw,
    selectionStart: a,
    selectionEnd: b,
    key: "[",
    shiftKey: false,
    language: "python",
  });
  assert.equal(edit.value, "nums = [1, 2]");
  assert.equal(edit.selectionStart, a + 1);
  assert.equal(edit.selectionEnd, b + 1);
});
