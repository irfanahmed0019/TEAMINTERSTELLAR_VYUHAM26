export type DiagnosticQuestion = { id: string; skill: string; kind: "concept" | "prediction" | "debugging" | "reasoning"; difficulty: 1 | 2 | 3; prompt: string; options: string[]; answer: number; explanation: string };
export type DiagnosticAnswer = { question: DiagnosticQuestion; choice: number; correct: boolean; at: number };
export type InitialDiagnostic = { version: 1; source: "ai"; status: "in_progress" | "completed"; questions: DiagnosticQuestion[]; answers: DiagnosticAnswer[]; completedAt?: number; evidence: "client_graded_prediction_not_code_execution" };
export function diagnosticQuestions(raw: unknown): DiagnosticQuestion[] {
  const list = raw && typeof raw === "object" ? (raw as { questions?: unknown }).questions : null;
  if (!Array.isArray(list)) throw new Error("No diagnostic questions returned. Retry or continue with an unassessed profile.");
  const kinds = ["concept", "prediction", "debugging", "reasoning"];
  const questions = list.slice(0, 18).flatMap((q, index): DiagnosticQuestion[] => {
    if (!q || typeof q !== "object" || typeof q.prompt !== "string" || !q.prompt.trim() || typeof q.skill !== "string" || !q.skill.trim() || !Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o: unknown) => typeof o !== "string" || !o.trim()) || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3 || ![1,2,3].includes(q.difficulty) || !kinds.includes(q.kind) || typeof q.explanation !== "string" || !q.explanation.trim()) return [];
    return [{ id: `diagnostic-${index}`, skill: q.skill.slice(0, 100), kind: q.kind, difficulty: q.difficulty, prompt: q.prompt.slice(0, 2000), options: q.options.map((o: string) => o.slice(0, 500)), answer: q.answer, explanation: q.explanation.slice(0, 1000) }];
  });
  if (questions.length < 6) throw new Error("The diagnostic returned too few valid questions. Retry; no assessment result was saved.");
  return questions;
}
export function nextDiagnostic(d: InitialDiagnostic): DiagnosticQuestion | undefined {
  const last = d.answers.at(-1);
  const target = last ? Math.max(1, Math.min(3, last.question.difficulty + (last.correct ? 1 : -1))) : 2;
  return d.questions.filter(q => !d.answers.some(a => a.question.id === q.id)).sort((a,b) => Math.abs(a.difficulty-target)-Math.abs(b.difficulty-target))[0];
}
export function answerDiagnostic(d: InitialDiagnostic, choice: number, at: number): InitialDiagnostic {
  const question = nextDiagnostic(d);
  if (!question || d.status === "completed" || !Number.isInteger(choice) || choice < 0 || choice > 3) return d;
  const answers = [...d.answers, {question, choice, correct: choice === question.answer, at}];
  const completed = answers.length >= Math.min(6,d.questions.length);
  return {...d, answers, status: completed ? "completed" : "in_progress", ...(completed ? {completedAt:at} : {})};
}
export function diagnosticSummary(d?: InitialDiagnostic): string {
  if (!d) return "No diagnostic evidence. Resume and experience are unverified claims.";
  return `Initial diagnostic ${d.status}; ${d.answers.length} prediction/concept checks. AI-authored answer keys, client-graded; not code execution or independent-work proof. ${d.answers.map(a=>`${a.question.skill}: ${a.correct ? "correct" : "incorrect"} ${a.question.kind} at difficulty ${a.question.difficulty}`).join("; ")}`;
}
