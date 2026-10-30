import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/* ---------- Code execution: public Judge0 CE sandbox (C only) ---------- */

const JUDGE0 = "https://ce.judge0.com";
const C_LANGUAGE_ID = 50; // C (GCC 9.2.0)
const MAX_CODE = 12_000;
const MAX_STDIN = 600;
const MAX_TESTS = 8;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const hits = new Map<string, number[]>();

function rateLimit(ip: string) {
  const t = Date.now();
  const list = (hits.get(ip) ?? []).filter((x) => t - x < WINDOW_MS);
  if (list.length >= MAX_REQUESTS_PER_WINDOW) throw new Error("Too many runs. Wait a minute and try again.");
  list.push(t);
  hits.set(ip, list);
  if (hits.size > 2000) for (const k of hits.keys()) { hits.delete(k); break; }
}

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const unb64 = (s: string | null | undefined) => {
  if (!s) return "";
  try { return decodeURIComponent(escape(atob(s.replace(/\n/g, "")))); } catch { return ""; }
};

type JudgeRow = {
  token: string;
  status?: { id: number; description: string };
  stdout?: string | null; stderr?: string | null; compile_output?: string | null; time?: string | null;
};

export type ExecItem = { statusId: number; status: string; stdout: string; stderr: string; compileOutput: string; timeSec: number | null };

/**
 * Runs C source against stdin cases on Judge0's isolated sandbox. Student code is
 * never executed in this server process. Limits: 12 KB source, 8 cases, 2 s CPU,
 * 128 MB, no network, 12 requests/minute per IP. No learner data is read or written.
 */
export const executeC = createServerFn({ method: "POST" })
  .validator((input: { code: string; stdins: string[] }) => {
    const code = String(input?.code ?? "");
    if (!code.trim()) throw new Error("Write some code first.");
    if (code.length > MAX_CODE) throw new Error("Code is too long to run (12,000 characters max).");
    const stdins = Array.isArray(input?.stdins) ? input.stdins.slice(0, MAX_TESTS).map((x) => String(x).slice(0, MAX_STDIN)) : [""];
    if (!stdins.length) throw new Error("No test input.");
    return { code, stdins };
  })
  .handler(async ({ data }): Promise<{ items: ExecItem[]; sandbox: string }> => {
    const req = getRequest();
    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
    rateLimit(ip);
    const submissions = data.stdins.map((stdin) => ({
      language_id: C_LANGUAGE_ID, source_code: b64(data.code), stdin: b64(stdin),
      cpu_time_limit: 2, wall_time_limit: 5, memory_limit: 128000, enable_network: false,
    }));
    const create = await fetch(`${JUDGE0}/submissions/batch?base64_encoded=true`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissions }), signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    if (!create || !create.ok) {
      throw new Error(create && create.status === 429 ? "The public code sandbox is rate limiting right now. Try again shortly." : "The code execution service is unreachable right now. Your code was not run.");
    }
    const tokens = ((await create.json()) as { token?: string }[]).map((x) => x.token).filter(Boolean) as string[];
    if (tokens.length !== data.stdins.length) throw new Error("The code execution service returned an unexpected response. Your code was not run.");
    const fields = "token,status,stdout,stderr,compile_output,time";
    const deadline = Date.now() + 25_000;
    let rows: JudgeRow[] = [];
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 700));
      const poll = await fetch(`${JUDGE0}/submissions/batch?base64_encoded=true&fields=${fields}&tokens=${tokens.join(",")}`, { signal: AbortSignal.timeout(10000) }).catch(() => null);
      if (!poll || !poll.ok) continue;
      rows = ((await poll.json()) as { submissions: JudgeRow[] }).submissions ?? [];
      if (rows.length === tokens.length && rows.every((r) => (r.status?.id ?? 0) > 2)) break;
    }
    if (rows.length !== tokens.length || rows.some((r) => (r.status?.id ?? 0) <= 2))
      throw new Error("The code execution service timed out. Your code was not graded.");
    const by = new Map(rows.map((r) => [r.token, r]));
    return {
      sandbox: "Judge0 CE public sandbox (ce.judge0.com), GCC 9.2",
      items: tokens.map((tk) => {
        const r = by.get(tk)!;
        return {
          statusId: r.status?.id ?? 0, status: r.status?.description ?? "Unknown",
          stdout: unb64(r.stdout), stderr: unb64(r.stderr), compileOutput: unb64(r.compile_output),
          timeSec: r.time ? Number(r.time) : null,
        };
      }),
    };
  });

/* ---------- AI (Sarvam): authenticated, server-side key, honest fallback ---------- */

const authed = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getAuthSessionForApi } = await import("../auth");
    const auth = await getAuthSessionForApi();
    if (!auth?.idToken) throw new Error("Sign in to use AI features.");
    return next({ headers: { Authorization: `Bearer ${auth.idToken}` } });
  })
  .server(async ({ next }) => {
    const { authenticatedUserId } = await import("../request-auth.server");
    const userId = await authenticatedUserId(getRequest());
    if (!userId) throw new Error("Sign in to use AI features.");
    return next({ context: { authenticatedUserId: userId } });
  });

function aiKey() {
  const v = process.env["SARVAM_API_KEY"]?.trim();
  if (!v || /^(your_|sk_your|sk_placeholder|replace_with_)/i.test(v)) throw new Error("The AI service is not configured.");
  return v;
}

export type AiRoadmap = { objective: string; prerequisites: string[]; difficulty: string; finalProject: string; moduleNotes: string[] };

export const generateRoadmapAI = createServerFn({ method: "POST" })
  .middleware([authed])
  .validator((i: { level: string; project: string; language: string; lessonTitles: string[] }) => ({
    level: String(i.level).slice(0, 20), project: String(i.project).slice(0, 120), language: String(i.language).slice(0, 20),
    lessonTitles: (i.lessonTitles ?? []).slice(0, 12).map((x) => String(x).slice(0, 80)),
  }))
  .handler(async ({ data }): Promise<AiRoadmap> => {
    const { sarvamJson } = await import("../sarvam.server");
    const out = await sarvamJson<Partial<AiRoadmap>>(
      aiKey(),
      "You design personalised learning roadmaps for BuildMyLogic. You may only describe the fixed lessons given. Do not invent lessons.",
      `Student level: ${data.level}. Project: ${data.project}. Language: ${data.language}. Fixed lessons in order: ${data.lessonTitles.join("; ")}.
Return JSON: {"objective": string, "prerequisites": string[], "difficulty": string, "finalProject": string, "moduleNotes": string[3]} tuned to the level. Keep each string under 200 characters.`,
      700,
    );
    if (!out.objective || !out.finalProject || !Array.isArray(out.moduleNotes)) throw new Error("The AI returned an incomplete roadmap.");
    return {
      objective: String(out.objective).slice(0, 300), prerequisites: (out.prerequisites ?? []).slice(0, 5).map((x) => String(x).slice(0, 160)),
      difficulty: String(out.difficulty ?? "").slice(0, 120), finalProject: String(out.finalProject).slice(0, 300),
      moduleNotes: out.moduleNotes.slice(0, 3).map((x) => String(x).slice(0, 200)),
    };
  });

export type MentorAsk = {
  kind: "simpler" | "another_example" | "why_works" | "similar_problem" | "explain_mistake" | "hint" | "chat";
  level: string; lessonTitle: string; objective: string; exercisePrompt: string; code: string;
  lastFeedback: string; misconceptions: string[]; hintsUsed: number; message: string;
};

export const mentorAsk = createServerFn({ method: "POST" })
  .middleware([authed])
  .validator((i: MentorAsk) => ({
    kind: i.kind, level: String(i.level).slice(0, 20), lessonTitle: String(i.lessonTitle).slice(0, 100), objective: String(i.objective).slice(0, 240),
    exercisePrompt: String(i.exercisePrompt).slice(0, 700), code: String(i.code).slice(0, 4000), lastFeedback: String(i.lastFeedback).slice(0, 500),
    misconceptions: (i.misconceptions ?? []).slice(0, 5).map((x) => String(x).slice(0, 160)), hintsUsed: Number(i.hintsUsed) || 0,
    message: String(i.message ?? "").slice(0, 600),
  }))
  .handler(async ({ data }): Promise<{ message: string }> => {
    const { sarvamJson } = await import("../sarvam.server");
    const task: Record<MentorAsk["kind"], string> = {
      simpler: "Explain the current concept in simpler words with a small analogy.",
      another_example: "Show one different small C example with its expected output.",
      why_works: "Explain why the student's current code works or fails, line by line, briefly.",
      similar_problem: "Give a similar practice problem (statement and sample input/output only, no solution).",
      explain_mistake: "Explain the student's mistake using the last test feedback. Do not give the full corrected program.",
      hint: "Give one hint. Do NOT reveal the full answer or complete code.",
      chat: "Answer the student's question about this lesson only.",
    };
    const out = await sarvamJson<{ message?: string }>(
      aiKey(),
      `You are the BuildMyLogic AI Mentor teaching ${data.level} students C programming. Stay on the current lesson. Be concise (under 140 words), plain English. Never reveal a full solution. ${task[data.kind]}`,
      `Lesson: ${data.lessonTitle}\nObjective: ${data.objective}\nExercise: ${data.exercisePrompt}\nStudent code:\n${data.code}\nLast test feedback: ${data.lastFeedback || "none yet"}\nKnown recurring misconceptions: ${data.misconceptions.join("; ") || "none"}\nHints used so far: ${data.hintsUsed}\nStudent says: ${data.message || "(nothing)"}\nReturn JSON {"message": string}.`,
      600,
    );
    if (!out.message) throw new Error("The AI returned an empty answer.");
    return { message: String(out.message).slice(0, 1500) };
  });
