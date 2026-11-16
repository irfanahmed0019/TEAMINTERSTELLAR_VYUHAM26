import { useRef, useState } from "react";
import { aiAnalyzeResume } from "@/lib/sarvam.functions";
import {
  normalizeResumeAnalysis,
  validateResumeFile,
} from "@/lib/resume-intake";

type Analysis = ReturnType<typeof normalizeResumeAnalysis>;
export function ResumeIntake({
  onAnalyzed,
}: {
  onAnalyzed: (text: string, result: Analysis) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [summary, setSummary] = useState("");
  const epoch = useRef(0);
  async function readFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    const id = ++epoch.current;
    setBusy(true);
    setError("");
    setNotice("");
    setSummary("");
    try {
      validateResumeFile(file);
      let extracted = "";
      if (/\.txt$/i.test(file.name)) extracted = await file.text();
      else if (/\.docx$/i.test(file.name)) {
        const mammoth = await import("mammoth/mammoth.browser");
        extracted = (
          await mammoth.extractRawText({
            arrayBuffer: await file.arrayBuffer(),
          })
        ).value;
      } else {
        const pdf = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdf.GlobalWorkerOptions.workerSrc = worker.default;
        const task = pdf.getDocument({ data: await file.arrayBuffer() });
        const document = await task.promise;
        try {
          for (
            let i = 1;
            i <= Math.min(document.numPages, 20) && extracted.length < 12000;
            i++
          ) {
            const page = await document.getPage(i);
            const content = await page.getTextContent();
            extracted +=
              content.items
                .map((item) => ("str" in item ? item.str : ""))
                .join(" ") + "\n";
          }
        } finally {
          await task.destroy();
        }
      }
      if (!extracted.trim())
        throw new Error(
          "No readable text found. For a scanned resume, paste its text instead.",
        );
      if (id !== epoch.current) return;
      setText(extracted.slice(0, 12000));
      setNotice(
        "Text extracted on this device. Review it before sending. Up to 12,000 characters / 20 PDF pages are used.",
      );
    } catch (e) {
      if (id === epoch.current)
        setError(
          e instanceof Error
            ? e.message
            : "Could not read this resume. Paste its text instead.",
        );
    } finally {
      if (id === epoch.current) setBusy(false);
    }
  }
  async function analyze() {
    if (!text.trim() || busy) return;
    const id = ++epoch.current;
    setBusy(true);
    setError("");
    setSummary("");
    try {
      const result = normalizeResumeAnalysis(
        await aiAnalyzeResume({ data: { text } }),
      );
      if (id !== epoch.current) return;
      onAnalyzed(text, result);
      setSummary(result.summary);
      setNotice(
        "Added to your profile as unverified resume claims, not proven skills.",
      );
    } catch (e) {
      if (id === epoch.current)
        setError(
          e instanceof Error
            ? e.message
            : "Analysis unavailable. You can continue without a resume.",
        );
    } finally {
      if (id === epoch.current) setBusy(false);
    }
  }
  return (
    <section
      className="mb-4 w-full rounded-2xl border border-border bg-surface p-4"
      aria-label="Upload your resume"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Have a resume? Start here</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload it so we can ask questions about your experience. Or skip it
            and chat below.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className="btn-base btn-primary-solid"
        >
          {busy ? "Reading..." : "Upload resume"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        PDF, Word (.docx) or text (.txt), up to 5 MB.{" "}
        {fileName || "No file selected."}
      </p>
      <input
        ref={fileInput}
        aria-label="Resume file"
        type="file"
        accept=".pdf,.docx,.txt"
        disabled={busy}
        className="sr-only"
        onChange={(e) => {
          void readFile(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      <details className="mt-3" open={!!text}>
        <summary className="cursor-pointer text-sm font-semibold">
          {text ? "Review your resume text" : "Or paste resume text"}
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          We read the file on this device first. Check the text, then choose Use
          this resume to send it to our AI service. Remove private details you
          do not want to share. Resume claims are not verified skills.
        </p>
        <label className="mt-3 block text-xs font-semibold">
          Review or paste resume text
          <textarea
            aria-label="Resume text"
            maxLength={12000}
            disabled={busy}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSummary("");
            }}
            rows={5}
            className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void analyze()}
          className="btn-base btn-outline mt-3 disabled:opacity-50"
        >
          {busy ? "Working…" : "Use this resume"}
        </button>
      </details>
      {notice && (
        <p
          role="status"
          className="mt-3 text-xs leading-5 text-muted-foreground"
        >
          {notice}
        </p>
      )}
      {summary && <p className="mt-3 text-sm leading-6">{summary}</p>}
      {error && (
        <p role="alert" className="mt-3 text-xs leading-5 text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
