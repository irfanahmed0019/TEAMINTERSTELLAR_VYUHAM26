/**
 * Server side of the AI Mentor. Everything that counts as learner evidence is
 * computed here: tests run on the Judge0 sandbox, grading and the adaptive
 * decision come from the deterministic engine, and rows are written with the
 * service role. The browser can only read its own rows (RLS select policy) and
 * cannot submit scores. /api/mentor/run is a public, run-only trial endpoint.
 */
import { authenticatedUserId } from "../request-auth.server";
import { LESSONS, REMEDIALS, exerciseById, lessonById, type Exercise, type Level } from "./curriculum";
import { assess, curatedRoadmap, exerciseFor, gradeRun, newState, recordSubmission, revisionIsDue, unlockedBy, type Attempt, type MentorState, type Roadmap, type RunItem } from "./engine";

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


/* --------------------- scoped extension tokens --------------------- */

const EXT_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Mints a user-bound mentor token for the VS Code extension. Only the SHA-256 hash is stored; the plaintext is returned once. */
async function issueExtensionToken(userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = `bmlx_${Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
  const expiresAt = new Date(Date.now() + EXT_TOKEN_TTL_MS).toISOString();
  await rest("mentor_tokens", { method: "POST", body: [{ token_hash: await sha256Hex(token), user_id: userId, expires_at: expiresAt }], prefer: "return=minimal" });
  return { token, expiresAt };
}

/** Resolves a bmlx_ bearer token to its owner. Undefined when unknown, expired or revoked. */
async function extensionTokenUserId(request: Request): Promise<string | undefined> {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const token = /^bearer /i.test(authorization) ? authorization.slice(7).trim() : "";
  if (!/^bmlx_[0-9a-f]{32}$/.test(token)) return undefined;
  const rows = (await rest(`mentor_tokens?select=user_id,expires_at,revoked_at&token_hash=eq.${await sha256Hex(token)}&limit=1`).catch(() => null)) as { user_id?: string; expires_at?: string; revoked_at?: string | null }[] | null;
  const row = rows?.[0];
  if (!row?.user_id || row.revoked_at) return undefined;
  if (!row.expires_at || Date.parse(row.expires_at) <= Date.now()) return undefined;
  return row.user_id;
}

/** Revokes every active extension token owned by the learner. */
async function revokeExtensionTokens(userId: string): Promise<number> {
  const rows = (await rest(`mentor_tokens?select=token_hash&user_id=eq.${userId}&revoked_at=is.null`)) as { token_hash: string }[];
  if (!rows?.length) return 0;
  await rest(`mentor_tokens?user_id=eq.${userId}&revoked_at=is.null`, { method: "PATCH", body: { revoked_at: new Date().toISOString() }, prefer: "return=minimal" });
  return rows.length;
}

const upsert = (table: string, onConflict: string, rows: unknown[]) =>
  rows.length ? rest(`${table}?on_conflict=${onConflict}`, { method: "POST", body: rows, prefer: "resolution=merge-duplicates,return=minimal" }) : Promise.resolve(null);

async function loadLatest(userId: string): Promise<MentorState | null> {
  const rows = (await rest(`mentor_sessions?select=state&user_id=eq.${userId}&order=updated_at.desc&limit=1`)) as { state: MentorState }[];
  const st = rows?.[0]?.state;
  if (!st || st.version !== 1) return null;
  // Activity is stored as a separate append-only event, never a full session
  // upsert: simultaneous saves must not overwrite a graded submission.
  const events = await rest(`mentor_events?select=detail&session_id=eq.${st.id}&user_id=eq.${userId}&event_type=eq.activity&order=created_at.desc&limit=1`).catch(() => []);
  try { if (events?.[0]?.detail) st.activity = JSON.parse(events[0].detail); } catch { /* malformed event is ignored */ }
  return st;
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
    if (!revisionIsDue(rv.dueAt)) throw new HttpError(409, "This revision is not due yet. Return at its scheduled time so it can check retention.");
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


    // Mint a scoped VS Code extension token. Requires the site's own Supabase
    // session: a bmlx_ token cannot mint more tokens. Plaintext returned once;
    // only its hash is stored. Delivery to the extension happens over the
    // loopback bridge by the page, never through URLs or logs.
    if (request.method === "POST" && p === "/api/mentor/extension-token") {
      const uid = await authenticatedUserId(request);
      if (!uid) return json(request, { ok: false, error: "Sign in on the website to connect VS Code." }, 401);
      if (limited(uid, "ext-token", 6)) return json(request, { ok: false, error: "Too many tokens requested. Try again shortly." }, 429);
      const { token, expiresAt } = await issueExtensionToken(uid);
      return json(request, { ok: true, token, expiresAt });
    }

    // Revoke every active extension token for the signed-in learner ("Disconnect VS Code").
    if (request.method === "POST" && p === "/api/mentor/extension-token/revoke") {
      const uid = await authenticatedUserId(request);
      if (!uid) return json(request, { ok: false, error: "Sign in to manage VS Code connections." }, 401);
      const revoked = await revokeExtensionTokens(uid);
      return json(request, { ok: true, revoked });
    }

    // Public curriculum metadata for the extension. Lesson structure and
    // starter code only - never hidden tests, expected outputs or solutions.
    if (request.method === "GET" && p === "/api/mentor/lessons") {
      if (limited(ip, "lessons", 30)) return json(request, { ok: false, error: "Too many requests. Try again shortly." }, 429);
      return json(request, {
        ok: true,
        project: { id: "arithmetic-c", title: "Arithmetic Operations in C", language: "C" },
        lessons: LESSONS.map((l) => ({
          id: l.id, order: l.order, title: l.title, objective: l.objective, skill: l.skill, concepts: l.concepts,
          exercise: { id: l.practice.id, title: l.practice.title, prompt: l.practice.prompt, starter: l.practice.starter, hintCount: l.practice.hints.length },
        })),
      });
    }

    // Everything below needs a verified account: the site session (Supabase
    // bearer) or a scoped, revocable extension token resolving to the same owner.
    const userId = (await authenticatedUserId(request)) ?? (await extensionTokenUserId(request));
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



    // Live, UNVERIFIED activity signal from the VS Code extension: which
    // watched file the learner is editing and its current diagnostics. It is
    // stored for display only - it is never graded and never advances progress.
    if (request.method === "POST" && p === "/api/mentor/activity") {
      if (limited(userId, "activity", 20)) return json(request, { ok: false, error: "Too many activity updates." }, 429);
      const b = await body(request);
      const s = await loadOwned(userId, String(b["sessionId"]));
      const kind = String(b["kind"] ?? "");
      if (!["watch_started", "file_save", "diagnostics", "watch_stopped"].includes(kind)) throw new HttpError(400, "Unknown activity kind.");
      const file = ((b["file"] ?? {}) as Record<string, unknown>) ?? {};
      const rel = String(file["path"] ?? "").slice(0, 180).replace(/\\/g, "/");
      if (rel && (rel.startsWith("/") || /^[a-zA-Z]:/.test(rel) || rel.split("/").some((seg) => seg === ".."))) throw new HttpError(400, "Bad file path.");
      const diagnostics = (Array.isArray(b["diagnostics"]) ? (b["diagnostics"] as unknown[]) : []).slice(0, 10).map((d) => {
        const o = (d ?? {}) as Record<string, unknown>;
        return { line: Math.max(1, Math.min(100000, Number(o["line"]) || 1)), message: String(o["message"] ?? "").slice(0, 300), severity: (o["severity"] === "warning" ? "warning" : "error") as "error" | "warning" };
      });
      const lines = Math.max(0, Math.min(200000, Number(file["lines"]) || 0));
      const activity: NonNullable<MentorState["activity"]> = {
        kind: kind as NonNullable<MentorState["activity"]>["kind"],
        status: kind === "watch_stopped" ? "stopped" : "watching",
        diagnostics,
        at: new Date().toISOString(),
      };
      if (rel) activity.file = rel;
      if (lines) activity.lines = lines;
      if (kind === "file_save") activity.code = String(b["code"] ?? "").slice(0, MAX_CODE);
      else if (kind !== "watch_stopped" && s.activity?.code) activity.code = s.activity.code;
      s.activity = activity;
      await rest("mentor_events", { method: "POST", body: [{ session_id: s.id, user_id: userId, event_type: "activity", detail: JSON.stringify(activity) }], prefer: "return=minimal" });
      return json(request, { ok: true });
    }

    // Task-aware mentor chat for the VS Code extension: the same Sarvam logic
    // the website's mentorAsk uses, callable with a scoped extension token.
    if (request.method === "POST" && p === "/api/mentor/ask") {
      if (limited(userId, "ask", 20)) return json(request, { ok: false, error: "Too many messages. Try again shortly." }, 429);
      const b = await body(request);
      const kind = String(b["kind"] ?? "");
      const task: Record<string, string> = {
        simpler: "Explain the current concept in simpler words with a small analogy.",
        another_example: "Show one different small C example with its expected output.",
        why_works: "Explain why the student's current code works or fails, line by line, briefly.",
        similar_problem: "Give a similar practice problem (statement and sample input/output only, no solution).",
        explain_mistake: "Explain the student's mistake using the last test feedback. Do not give the full corrected program.",
        hint: "Give one hint. Do NOT reveal the full answer or complete code.",
        chat: "Answer the student's question about this lesson only.",
      };
      if (!task[kind]) throw new HttpError(400, "Unknown ask kind.");
      const key = process.env["SARVAM_API_KEY"]?.trim();
      if (!key || /^(your_|sk_your|sk_placeholder|replace_with_)/i.test(key)) throw new HttpError(503, "The AI service is not configured.");
      const { sarvamJson } = await import("../sarvam.server");
      const level = String(b["level"] ?? "").slice(0, 20);
      const lessonTitle = String(b["lessonTitle"] ?? "").slice(0, 100);
      const objective = String(b["objective"] ?? "").slice(0, 240);
      const exercisePrompt = String(b["exercisePrompt"] ?? "").slice(0, 700);
      const code = String(b["code"] ?? "").slice(0, 4000);
      const lastFeedback = String(b["lastFeedback"] ?? "").slice(0, 500);
      const misconceptions = (Array.isArray(b["misconceptions"]) ? (b["misconceptions"] as unknown[]) : []).slice(0, 5).map((x) => String(x).slice(0, 160));
      const hintsUsed = Number(b["hintsUsed"]) || 0;
      const message = String(b["message"] ?? "").slice(0, 600);
      const out = await sarvamJson<{ message?: string }>(
        key,
        `You are the BuildMyLogic AI Mentor teaching ${level} students C programming. Stay on the current lesson. Be concise (under 140 words), plain English. Never reveal a full solution. ${task[kind]}`,
        `Lesson: ${lessonTitle}\nObjective: ${objective}\nExercise: ${exercisePrompt}\nStudent code:\n${code}\nLast test feedback: ${lastFeedback || "none yet"}\nKnown recurring misconceptions: ${misconceptions.join("; ") || "none"}\nHints used so far: ${hintsUsed}\nStudent says: ${message || "(nothing)"}\nReturn JSON {"message": string}.`,
        600,
      );
      if (!out.message) throw new HttpError(502, "The AI returned an empty answer.");
      return json(request, { ok: true, message: String(out.message).slice(0, 1500) });
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
