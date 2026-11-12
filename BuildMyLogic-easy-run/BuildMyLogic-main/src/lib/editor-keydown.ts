/**
 * VS Code-style editing helpers for the code textarea: auto-indent on Enter,
 * auto-closing quote/bracket pairs, type-over closing characters, pair
 * deletion on Backspace, and Tab/Shift+Tab block indentation.
 *
 * Pure function: returns the next value and selection, or null when the key
 * needs no special handling (the browser default should run).
 */

export type EditorKeyEdit = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
} | null;

const PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
};
const OPENERS = new Set(["(", "[", "{"]);
const CLOSERS = new Set([")", "]", "}"]);
const QUOTES = new Set(['"', "'"]);
const INDENT = "    ";

const isWord = (c: string) => /[A-Za-z0-9_]/.test(c);

export function editorKeyEdit({
  value,
  selectionStart,
  selectionEnd,
  key,
  shiftKey,
  language,
}: {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  key: string;
  shiftKey: boolean;
  language: "c" | "python";
}): EditorKeyEdit {
  const a = selectionStart;
  const b = selectionEnd;
  const collapsed = a === b;
  const done = (next: string, s: number, e: number): EditorKeyEdit => ({
    value: next,
    selectionStart: s,
    selectionEnd: e,
  });

  // Tab / Shift+Tab: Tab inserts indentation at the cursor (or indents every
  // line a multi-line selection touches); Shift+Tab dedents the touched lines.
  if (key === "Tab") {
    const lineStart = value.lastIndexOf("\n", a - 1) + 1;
    const nl = value.indexOf("\n", b);
    const lineEnd = nl === -1 ? value.length : nl;
    const block = value.slice(lineStart, lineEnd);
    if (shiftKey) {
      let removedFirst = 0;
      const next = block.replace(/^((?: {1,4})|\t)/gm, (_m, ws: string, offset: number) => {
        if (offset === 0) removedFirst = ws.length;
        return "";
      });
      const removedTotal = block.length - next.length;
      return done(
        value.slice(0, lineStart) + next + value.slice(lineEnd),
        Math.max(lineStart, a - removedFirst),
        Math.max(lineStart, b - removedTotal),
      );
    }
    if (collapsed || !value.slice(a, b).includes("\n")) {
      return done(
        value.slice(0, a) + INDENT + value.slice(b),
        a + INDENT.length,
        a + INDENT.length,
      );
    }
    const next = block.replace(/^/gm, INDENT);
    return done(
      value.slice(0, lineStart) + next + value.slice(lineEnd),
      a + INDENT.length,
      b + (next.length - block.length),
    );
  }

  // Enter: keep the current indent; add one level after a block opener;
  // expand an empty bracket pair into an indented block.
  if (key === "Enter") {
    const lineStart = value.lastIndexOf("\n", a - 1) + 1;
    const before = value.slice(lineStart, a);
    const indent = (before.match(/^[ \t]*/) || [""])[0];
    const trimmed = before.trimEnd();
    const opensBlock =
      language === "python" ? trimmed.endsWith(":") : trimmed.endsWith("{");
    const prev = value[a - 1] || "";
    if (collapsed && OPENERS.has(prev) && value[a] === PAIRS[prev]) {
      const text = "\n" + indent + INDENT + "\n" + indent;
      const cursor = a + 1 + indent.length + INDENT.length;
      return done(value.slice(0, a) + text + value.slice(b), cursor, cursor);
    }
    const extra = opensBlock ? INDENT : "";
    const cursor = a + 1 + indent.length + extra.length;
    return done(
      value.slice(0, a) + "\n" + indent + extra + value.slice(b),
      cursor,
      cursor,
    );
  }

  // Type-over: typing a closing character that is already there just moves
  // past it instead of inserting a duplicate.
  if (
    collapsed &&
    (CLOSERS.has(key) || QUOTES.has(key)) &&
    value[a] === key
  ) {
    return done(value, a + 1, a + 1);
  }

  // Auto-close openers and quotes; wrap a selection when there is one.
  const close = PAIRS[key];
  if (close) {
    const prev = value[a - 1] || "";
    const next = value[b] || "";
    const isQuote = QUOTES.has(key);
    // Quotes do not auto-close inside words (don't) or right before one.
    if (isQuote && (isWord(prev) || isWord(next))) return null;
    // Brackets do not auto-close right before a word char.
    if (!isQuote && isWord(next)) return null;
    if (collapsed) {
      return done(
        value.slice(0, a) + key + close + value.slice(b),
        a + 1,
        a + 1,
      );
    }
    return done(
      value.slice(0, a) + key + value.slice(a, b) + close + value.slice(b),
      a + 1,
      b + 1,
    );
  }

  // Backspace between an empty pair deletes both characters.
  if (key === "Backspace" && collapsed && a > 0) {
    const open = value[a - 1];
    const close = open === undefined ? undefined : PAIRS[open];
    if (close !== undefined && close === value[a]) {
      return done(value.slice(0, a - 1) + value.slice(a + 1), a - 1, a - 1);
    }
    return null;
  }

  // A closing brace on an indentation-only line dedents one level first.
  if (key === "}" && collapsed) {
    const lineStart = value.lastIndexOf("\n", a - 1) + 1;
    const ws = value.slice(lineStart, a);
    if (/^(?: {4})+$/.test(ws)) {
      const dedented = ws.slice(0, -INDENT.length);
      const cursor = lineStart + dedented.length + 1;
      return done(
        value.slice(0, lineStart) + dedented + "}" + value.slice(b),
        cursor,
        cursor,
      );
    }
    return null;
  }

  return null;
}
