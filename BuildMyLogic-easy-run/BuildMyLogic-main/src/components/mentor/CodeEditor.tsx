import { useRef } from "react";

const KEYWORDS = /\b(int|char|float|double|void|long|short|unsigned|signed|if|else|for|while|do|switch|case|break|continue|return|const|static|struct|typedef|sizeof|default)\b/g;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Small C highlighter: comments, strings, preprocessor lines, keywords, numbers. */
export function highlightC(code: string): string {
  const re = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(^[ \t]*#[^\n]*)/gm;
  let out = "";
  let last = 0;
  // Single pass: chaining replace() calls would re-match digits inside the
  // span markup inserted by the keyword pass (e.g. font-weight:600).
  const plain = (t: string) =>
    esc(t).replace(/\b(int|char|float|double|void|long|short|unsigned|signed|if|else|for|while|do|switch|case|break|continue|return|const|static|struct|typedef|sizeof|default)\b|\b(\d+(?:\.\d+)?)\b/g, (m, kw, num) =>
      kw ? `<span style="color:#2563eb;font-weight:600">${kw}</span>` : `<span style="color:#b45309">${num}</span>`);
  for (let m = re.exec(code); m; m = re.exec(code)) {
    out += plain(code.slice(last, m.index));
    const color = m[1] ? "#94a3b8" : m[2] ? "#059669" : "#7c3aed";
    out += `<span style="color:${color}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + plain(code.slice(last)) + "\n";
}

export function CodeEditor({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const pre = useRef<HTMLPreElement>(null);
  const font = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  const shared: React.CSSProperties = { fontFamily: font, fontSize: 13, lineHeight: "20px", padding: 12, tabSize: 4, whiteSpace: "pre", margin: 0 };
  return (
    <div className="relative h-72 overflow-hidden rounded-xl border border-gray-200 bg-white focus-within:border-blue-400">
      <pre ref={pre} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden text-gray-800" style={shared} dangerouslySetInnerHTML={{ __html: highlightC(value) }} />
      <textarea
        aria-label={label}
        value={value}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (pre.current) {
            pre.current.scrollTop = e.currentTarget.scrollTop;
            pre.current.scrollLeft = e.currentTarget.scrollLeft;
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            const t = e.currentTarget;
            const { selectionStart: a, selectionEnd: b } = t;
            onChange(value.slice(0, a) + "    " + value.slice(b));
            requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = a + 4; });
          }
        }}
        className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent text-transparent caret-gray-900 outline-none selection:bg-blue-200/60"
        style={shared}
      />
    </div>
  );
}
