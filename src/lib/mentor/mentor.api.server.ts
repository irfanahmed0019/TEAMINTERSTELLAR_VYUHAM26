/**
 * Server side of the AI Mentor. Everything that counts as learner evidence is
 * computed here: tests run on the Judge0 sandbox, grading and the adaptive
 * decision come from the deterministic engine, and rows are written with the
 * service role. The browser can only read its own rows (RLS select policy) and
 * cannot submit scores. /api/mentor/run is a public, run-only trial endpoint.
 */
import { authenticatedUserId } from "../request-auth.server";
import { LESSONS, REMEDIALS, exerciseById, lessonById, type Exercise, type Level } from "./curriculum";
import { assess, curatedRoadmap, exerciseFor, gradeRun, newState, recordSubmission, unlockedBy, type Attempt, type MentorState, type Roadmap, type RunItem } from "./engine";

const JUDGE0 = "https://ce.judge0.com";
const MAX_CODE = 12_000;
const MAX_STDIN = 600;
const MAX_TESTS = 10;

/* ------------------------------ helpers ------------------------------ */

const hits = new Map<string, number[]>();
function limited(ip: string, scope: string, max: number, windowMs = 60_000) {
  const key = `${scope}:${ip}`;
  const t = Date.now();
  const list = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
  if (list.length >= max) return true;
  list.push(t);
  hits.set(key, list);
  if (hits.size > 5000) for (const k of hits.keys()) { hits.delete(k); break; }
  return false;
}

function json(request: Request, body: unknown, status = 200) {
  const origin = request.headers.get("origin");
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...(origin && origin === new URL(request.url).origin ? { "access-control-allow-origin": origin } : {}) },
  });
}

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const unb64 = (s: string | null | undefined) => {
  if (!s) return "";
  try { return decodeURIComponent(escape(atob(s.replace(/\n/g, "")))); } catch { return ""; }
};

type JudgeRow = { token: string; status?: { id: number; description: string }; stdout?: string | null; stderr?: string | null; compile_output?: string | null; time?: string | null };

/** Runs C code against stdin cases on Judge0's sandbox. Never executes in this process. */
export async function runC(code: string, stdins: string[]): Promise<RunItem[]> {
  const create = await fetch(`${JUDGE0}/submissions/batch?base64_encoded=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissions: stdins.map((stdin) => ({ language_id: 50, source_code: b64(code), stdin: b64(stdin), cpu_time_limit: 2, wall_time_limit: 5, memory_limit: 128000, enable_network: false })) }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!create || !create.ok) throw new Error(create && create.status === 429 ? "The public code sandbox is rate limiting right now. Try again shortly." : "The code execution service is unreachable right now. Your code was not run.");
  const tokens = ((await create.json()) as { token?: string }[]).map((x) => x.token).filter(Boolean) as string[];
  if (tokens.length !== stdins.length) throw new Error("The code execution service returned an unexpected response. Your code was not run.");
  const deadline = Date.now() + 25_000;
  let rows: JudgeRow[] = [];
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 700));
    const poll = await fetch(`${JUDGE0}/submissions/batch?base64_encoded=true&fields=token,status,stdout,stderr,compile_output,time&tokens=${tokens.join(",")}`, { signal: AbortSignal.timeout(10000) }).catch(() => null);
    if (!poll || !poll.ok) continue;
    rows = ((await poll.json()) as { submissions: JudgeRow[] }).submissions ?? [];
    if (rows.length === tokens.length && rows.every((r) => (r.status?.id ?? 0) > 2)) break;
  }
  if (rows.length !== tokens.length || rows.some((r) => (r.status?.id ?? 0) <= 2)) throw new Error("The code execution service timed out. Your code was not graded.");
  const by = new Map(rows.map((r) => [r.token, r]));
  return tokens.map((tk) => {
    const r = by.get(tk)!;
    return { statusId: r.status?.id ?? 0, status: r.status?.description ?? "Unknown", stdout: unb64(r.stdout), stderr: unb64(r.stderr), compileOutput: unb64(r.compile_output), timeSec: r.time ? Number(r.time) : null };
  });
}

/* ------------------------------ database ------------------------------ */

function db() {
  const url = process.env["VITE_SUPABASE_URL"]?.trim();
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!url || !key) throw new Error("Saving to accounts is not configured on this server (missing database service key).");
  return { url, key };
}

async function rest(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}) {
  const { url, key } = db();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.prefer ? { prefer: init.prefer } : {}) },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (/PGRST205|42P01|does not exist|schema cache/i.test(text)) throw new Error("The mentor database tables have not been created yet.");
    throw new Error(`Database error ${res.status}.`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const upsert = (table: string, onConflict: string, rows: unknown[]) =>
  rows.length ? rest(`${table}?on_conflict=${onConflict}`, { method: "POST", body: rows, prefer: "resolution=merge-duplicates,return=minimal" }) : Promise.resolve(null);

async function loadLatest(userId: string): Promise<MentorState | null> {
  const rows = (await rest(`mentor_sessions?select=state&user_id=eq.${userId}&order=updated_at.desc&limit=1`)) as { state: MentorState }[];
  const st = rows?.[0]?.state;
  return st && st.version === 1 ? st : null;
}

async function loadOwned(userId: string, sessionId: string): Promise<MentorState> {
  if (!/^ms-[a-z0-9]{6,20}$/i.test(sessionId)) throw new HttpError(400, "Invalid session.");
  const rows = (await rest(`mentor_sessions?select=state&id=eq.${sessionId}&user_id=eq.${userId}&limit=1`)) as { state: MentorState }[];
  const st = rows?.[0]?.state;
  if (!st) throw new HttpError(404, "Session not found.");
  return st;
}

async function persist(userId: string, s: MentorState, newAttempt?: Attempt, eventDetail?: string) {
  await upsert("mentor_sessions", "id", [{ id: s.id, user_id: userId, project_id: s.projectId, language: s.language, level: s.level, roadmap: s.roadmap, state: s, current_lesson_id: s.currentLessonId, updated_at: new Date().toISOString() }]);
  if (newAttempt)
    await upsert("mentor_submissions", "id", [{ id: newAttempt.id, session_id: s.id, user_id: userId, lesson_id: newAttempt.lessonId, exercise_id: newAttempt.exerciseId, mode: "submit", code: newAttempt.code, test_results: newAttempt.results, assessment: newAttempt.assessment ?? null, hints_used: newAttempt.hintsUsed, created_at: newAttempt.ts }]);
  await upsert("mentor_competencies", "session_id,skill", Object.values(s.competencies).map((c) => ({ session_id: s.id, user_id: userId, skill: c.skill, level: c.level, confirmed: c.confirmed, practice_passes: c.practicePasses, independent_passes: c.independentPasses, failures: c.failures, revision_passes: c.revisionPasses, updated_at: new Date().toISOString() })));
  await upsert("mentor_misconceptions", "session_id,misconception_id", Object.values(s.misconceptions).map((m) => ({ session_id: s.id, user_id: userId, misconception_id: m.id, concept: m.concept, occurrences: m.count, status: m.status, evidence: m.evidence, first_seen: m.firstSeen, last_seen: m.lastSeen })));
  await upsert("mentor_revisions", "id", s.revisions.map((r) => ({ id: r.id, session_id: s.id, user_id: userId, skill: r.skill, concept: r.concept, exercise_id: r.exerciseId, lesson_id: r.lessonId, misconception_id: r.misconceptionId ?? null, stage: r.stage, status: r.status, reason: r.reason, due_at: r.dueAt, completed_at: r.completedAt ?? null })));
  if (eventDetail) await rest("mentor_events", { method: "POST", body: [{ session_id: s.id, user_id: userId, event_type: "update", detail: eventDetail }], prefer: "return=minimal" });
}

/* ------------------------------ roadmap ------------------------------ */

async function buildRoadmap(level: Level): Promise<Roadmap> {
  const base = curatedRoadmap(level);
  try {
    const key = process.env["SARVAM_API_KEY"]?.trim();
    if (!key || /^(your_|sk_your|sk_placeholder|replace_with_)/i.test(key)) throw new Error("the AI service is not configured");
    const { sarvamJson } = await import("../sarvam.server");
    const out = await sarvamJson<{ objective?: string; prerequisites?: string[]; difficulty?: string; finalProject?: string; moduleNotes?: string[] }>(
      key,
      "You design personalised learning roadmaps for BuildMyLogic. You may only describe the fixed lessons given. Do not invent lessons.",
      `Student level: ${level}. Project: ${base.title}. Language: C. Fixed lessons in order: ${LESSONS.map((l) => l.title).join("; ")}.\nReturn JSON: {"objective": string, "prerequisites": string[], "difficulty": string, "finalProject": string, "moduleNotes": string[3]} tuned to the level. Each string under 200 characters.`,
      700,
    );
    if (!out.objective || !out.finalProject || !Array.isArray(out.moduleNotes)) throw new Error("the AI returned an incomplete roadmap");
    return {
      ...base, source: "ai", objective: String(out.objective).slice(0, 300),
      prerequisites: (out.prerequisites ?? []).slice(0, 5).map((x) => String(x).slice(0, 160)).filter(Boolean).length ? (out.prerequisites ?? []).slice(0, 5).map((x) => String(x).slice(0, 160)) : base.prerequisites,
      difficulty: String(out.difficulty || base.difficulty).slice(0, 120), finalProject: String(out.finalProject).slice(0, 300),
      modules: base.modules.map((m, i) => ({ ...m, ...(out.moduleNotes?.[i] ? { note: String(out.moduleNotes[i]).slice(0, 200) } : {}) })),
    };
  } catch (e) {
    return { ...base, aiNote: `AI roadmap unavailable (${e instanceof Error ? e.message : "error"}). Showing the curated roadmap for this journey.` };
  }
}

/* ------------------------------ handler ------------------------------ */

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

function ipOf(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

async function body(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length") || "0") > 100_000) throw new HttpError(413, "Request too large.");
  try { const b = await request.json(); return b && typeof b === "object" ? (b as Record<string, unknown>) : {}; } catch { return {}; }
}

function activeExercise(s: MentorState, lessonId: string, exerciseId: string, revisionId?: string): { exercise: Exercise; revisionId?: string } {
  if (revisionId) {
    const rv = s.revisions.find((r) => r.id === revisionId && r.status === "scheduled");
    if (!rv || rv.exerciseId !== exerciseId || rv.lessonId !== lessonId) throw new HttpError(400, "That revision task is not open.");
    return { exercise: exerciseById(exerciseId)!.exercise, revisionId };
  }
  const lp = s.lessons[lessonId];
  if (!lp || lp.status === "locked") throw new HttpError(403, "That lesson is locked.");
  const cur = exerciseFor(s, lessonId).exercise;
  if (cur.id !== exerciseId) throw new HttpError(409, "That exercise is no longer the active one. Reload the session.");
  return { exercise: cur };
}

export async function handleMentorApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  if (!p.startsWith("/api/mentor/")) return null;
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return json(request, { ok: false, error: "Origin is not allowed." }, 403);
  const ip = ipOf(request);
  try {
    // Public trial: run only. No grading, no storage, no learner data.
    if (request.method === "POST" && p === "/api/mentor/run") {
      if (limited(ip, "run", 12)) return json(request, { ok: false, error: "Too many runs. Wait a minute and try again." }, 429);
      const b = await body(request);
      const code = String(b["code"] ?? "");
      if (!code.trim()) throw new HttpError(400, "Write some code first.");
      if (code.length > MAX_CODE) throw new HttpError(400, "Code is too long to run (12,000 characters max).");
      const stdins = Array.isArray(b["stdins"]) ? (b["stdins"] as unknown[]).slice(0, MAX_TESTS).map((x) => String(x).slice(0, MAX_STDIN)) : [""];
      const items = await runC(code, stdins);
      return json(request, { ok: true, items, sandbox: "Judge0 CE public sandbox (ce.judge0.com), GCC 9.2" });
    }

    // Everything below needs a verified account.
    const userId = await authenticatedUserId(request);
    if (!userId) return json(request, { ok: false, error: "Sign in to save and verify your learning." }, 401);
    if (limited(userId, "acct", 40)) return json(request, { ok: false, error: "Too many requests. Try again shortly." }, 429);

    if (request.method === "GET" && p === "/api/mentor/sessions/latest") return json(request, { ok: true, state: await loadLatest(userId) });

    if (request.method === "POST" && p === "/api/mentor/start") {
      const b = await body(request);
      const level = String(b["level"]) as Level;
      if (!["beginner", "intermediate", "advanced"].includes(level)) throw new HttpError(400, "Choose a level.");
      if (b["projectId"] !== "arithmetic-c" || b["language"] !== "C") throw new HttpError(400, "Only the Arithmetic Operations in C journey is available.");
      const roadmap = await buildRoadmap(level);
      const s = newState(level, roadmap);
      s.verified = true;
      await persist(userId, s, undefined, `Session started (${level}, roadmap: ${roadmap.source})`);
      return json(request, { ok: true, state: s });
    }

    if (request.method === "POST" && p === "/api/mentor/select-lesson") {
      const b = await body(request);
      const s = await loadOwned(userId, String(b["sessionId"]));
      const id = String(b["lessonId"]);
      if (!lessonById(id) || s.lessons[id]?.status === "locked") throw new HttpError(403, "That lesson is locked.");
      s.currentLessonId = id;
      s.updatedAt = new Date().toISOString();
      await persist(userId, s);
      return json(request, { ok: true, state: s });
    }

    if (request.method === "POST" && p === "/api/mentor/hint") {
      const b = await body(request);
      const s = await loadOwned(userId, String(b["sessionId"]));
      const lessonId = String(b["lessonId"]);
      const lp = s.lessons[lessonId];
      if (!lp || lp.status === "locked") throw new HttpError(403, "That lesson is locked.");
      if (lp.hintsUsed >= s.roadmap.rules.hintsAllowed) throw new HttpError(409, "No hints left for this lesson at your level.");
      const ex = (b["revisionId"] ? exerciseById(s.revisions.find((r) => r.id === String(b["revisionId"]))?.exerciseId ?? "")?.exercise : undefined) ?? exerciseFor(s, lessonId).exercise;
      const hint = ex.hints[Math.min(lp.hintsUsed, ex.hints.length - 1)]!;
      lp.hintsUsed += 1;
      s.updatedAt = new Date().toISOString();
      await persist(userId, s);
      return json(request, { ok: true, hint, state: s });
    }

    if (request.method === "POST" && p === "/api/mentor/submit") {
      if (limited(userId, "submit", 10)) return json(request, { ok: false, error: "Too many submissions. Wait a minute." }, 429);
      const b = await body(request);
      const s = await loadOwned(userId, String(b["sessionId"]));
      const lessonId = String(b["lessonId"]);
      const code = String(b["code"] ?? "");
      if (!code.trim()) throw new HttpError(400, "Write some code first.");
      if (code.length > MAX_CODE) throw new HttpError(400, "Code is too long (12,000 characters max).");
      const { exercise, revisionId } = activeExercise(s, lessonId, String(b["exerciseId"]), b["revisionId"] ? String(b["revisionId"]) : undefined);
      const items = await runC(code, exercise.tests.map((t) => t.stdin));
      const results = gradeRun(exercise.tests, items);
      const prior = s.attempts.filter((a) => a.exerciseId === exercise.id && a.mode === "submit").length;
      const assessment = assess(exercise, code, exercise.tests, results, items, prior);
      const lp = s.lessons[lessonId]!;
      const attempt: Attempt = { id: `at-${crypto.randomUUID().slice(0, 12)}`, ts: new Date().toISOString(), lessonId, exerciseId: exercise.id, code, mode: "submit", results, assessment, hintsUsed: lp.hintsUsed };
      const { state: next, decision } = recordSubmission(s, attempt, exercise, revisionId);
      next.verified = true;
      await persist(userId, next, attempt, `${exercise.title}: ${assessment.passed_tests}/${assessment.total_tests} tests. ${decision}`);
      return json(request, { ok: true, results, assessment, decision, state: next });
    }

    return json(request, { ok: false, error: "Not found." }, 404);
  } catch (e) {
    if (e instanceof HttpError) return json(request, { ok: false, error: e.message }, e.status);
    return json(request, { ok: false, error: e instanceof Error ? e.message : "Something went wrong." }, 500);
  }
}

void REMEDIALS; void unlockedBy;
