import { useRef, useState } from "react";
import { aiAnalyzeResume } from "@/lib/sarvam.functions";
import { normalizeResumeAnalysis, validateResumeFile } from "@/lib/resume-intake";

type Analysis = ReturnType<typeof normalizeResumeAnalysis>;
export function ResumeIntake({ onAnalyzed }: { onAnalyzed: (text: string, result: Analysis) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [summary, setSummary] = useState("");
  const epoch = useRef(0);
  async function readFile(file?: File) {
    if (!file) return;
    const id = ++epoch.current;
    setBusy(true); setError(""); setNotice(""); setSummary("");
    try {
      validateResumeFile(file);
      let extracted = "";
      if (/\.txt$/i.test(file.name)) extracted = await file.text();
      else if (/\.docx$/i.test(file.name)) {
        const mammoth = await import("mammoth/mammoth.browser");
        extracted = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
      } else {
        const pdf = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdf.GlobalWorkerOptions.workerSrc = worker.default;
        const task = pdf.getDocument({ data: await file.arrayBuffer() });
        const document = await task.promise;
        try {
          for (let i = 1; i <= Math.min(document.numPages, 20) && extracted.length < 12000; i++) {
            const page = await document.getPage(i);
            const content = await page.getTextContent();
            extracted += content.items.map(item => "str" in item ? item.str : "").join(" ") + "\n";
          }
        } finally { await task.destroy(); }
      }
      if (!extracted.trim()) throw new Error("No readable text found. For a scanned resume, paste its text instead.");
      if (id !== epoch.current) return;
      setText(extracted.slice(0, 12000));
      setNotice("Text extracted on this device. Review it before sending. Up to 12,000 characters / 20 PDF pages are used.");
    } catch (e) { if (id === epoch.current) setError(e instanceof Error ? e.message : "Could not read this resume. Paste its text instead."); }
    finally { if (id === epoch.current) setBusy(false); }
  }
  async function analyze() {
    if (!text.trim() || busy) return;
    const id = ++epoch.current;
    setBusy(true); setError(""); setSummary("");
    try {
      const result = normalizeResumeAnalysis(await aiAnalyzeResume({ data: { text } }));
      if (id !== epoch.current) return;
      onAnalyzed(text, result); setSummary(result.summary); setNotice("Added to your profile as unverified resume claims, not proven skills.");
    } catch (e) { if (id === epoch.current) setError(e instanceof Error ? e.message : "Analysis unavailable. You can continue without a resume."); }
    finally { if (id === epoch.current) setBusy(false); }
  }
  return <details className="mb-4 w-full rounded-2xl border border-border bg-surface p-4">
    <summary className="cursor-pointer py-2 text-sm font-bold">Add your resume (optional)</summary>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">Use PDF, DOCX or TXT, up to 5 MB. Extraction happens here. Analyze sends the reviewed text to the existing AI service; remove contact details or other information you do not want to share. Claims are not verified competency.</p>
    <input aria-label="Resume file" type="file" accept=".pdf,.docx,.txt" disabled={busy} className="mt-3 w-full text-xs" onChange={e => { void readFile(e.target.files?.[0]); e.currentTarget.value = ""; }} />
    <label className="mt-3 block text-xs font-semibold">Review or paste resume text<textarea aria-label="Resume text" maxLength={12000} disabled={busy} value={text} onChange={e => { setText(e.target.value); setSummary(""); }} rows={5} className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm" /></label>
    <button type="button" disabled={busy || !text.trim()} onClick={() => void analyze()} className="btn-base btn-outline mt-3 disabled:opacity-50">{busy ? "Working…" : "Analyze reviewed resume"}</button>
    {notice && <p role="status" className="mt-3 text-xs leading-5 text-muted-foreground">{notice}</p>}
    {summary && <p className="mt-3 text-sm leading-6">{summary}</p>}
    {error && <p role="alert" className="mt-3 text-xs leading-5 text-red-700">{error}</p>}
  </details>;
}
