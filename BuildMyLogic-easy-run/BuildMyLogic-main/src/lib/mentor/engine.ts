/**
 * Deterministic adaptive engine (the "Adaptive Orchestrator").
 * Pure functions: progress, grading from real test output, mastery thresholds,
 * prerequisites and revision scheduling live here. LLMs never decide these.
 */
import {
  LESSONS, LEVEL_RULES, MISCONCEPTIONS, REMEDIALS, SKILLS, exerciseById, lessonById,
  type DetectCtx, type Exercise, type Level, type TestCase,
} from "./curriculum";

export type RunItem = { statusId: number; status: string; stdout: string; stderr: string; compileOutput: string; timeSec: number | null };

export type RoadmapSource = "ai" | "curated";
export type Roadmap = {
  source: RoadmapSource;
  title: string;
  objective: string;
  prerequisites: string[];
  difficulty: string;
  finalProject: string;
  modules: { title: string; lessonIds: string[]; note?: string }[];
  rules: { hintsAllowed: number; passScore: number; openOrder: boolean; depth: string };
  aiNote?: string;
};

export type LessonStatus = "locked" | "available" | "in_progress" | "completed" | "needs_review";
export type LessonProgress = { status: LessonStatus; attempts: number; bestScore: number; hintsUsed: number; activeExerciseId: string; code: Record<string, string> };

export type TestResult = { name: string; hidden: boolean; passed: boolean; expected: string; actual: string; status: string; stderr: string };
export type Assessment = {
  status: "passed" | "needs_improvement" | "failed" | "error";
  errorType: "none" | "compile" | "runtime" | "wrong_output";
  score: number;
  passed_tests: number;
  total_tests: number;
  misconceptions: { id: string; concept: string; evidence: string }[];
  feedback: string;
  next_action: "advance" | "retry" | "targeted_exercise" | "prerequisite_review" | "revision";
  recommended_exercise?: string;
};
export type Attempt = {
  id: string; ts: string; lessonId: string; exerciseId: string; code: string; mode: "run" | "submit";
  results: TestResult[]; assessment?: Assessment; hintsUsed: number;
};
export type Competency = {
  skill: string; practicePasses: number; independentPasses: number; failures: number; revisionPasses: number;
  level: "not_started" | "beginner" | "developing" | "proficient" | "mastered"; confirmed: boolean; lastEvidenceAt?: string;
};
export type MisconceptionRecord = { id: string; concept: string; count: number; status: "active" | "improving" | "resolved"; firstSeen: string; lastSeen: string; evidence: string };
export type Revision = { id: string; skill: string; concept: string; exerciseId: string; lessonId: string; misconceptionId?: string; stage: number; dueAt: string; status: "scheduled" | "done"; reason: string; completedAt?: string };
export type MentorEvent = { ts: string; type: string; detail: string };

export type MentorActivity = {
  kind: "watch_started" | "file_save" | "diagnostics" | "watch_stopped";
  status: "watching" | "stopped";
  file?: string; lines?: number; code?: string;
  diagnostics?: { line: number; message: string; severity: "error" | "warning" }[];
  at: string; // server receive time; client clocks are not trusted
};
export type MentorState = {
  version: 1; /** true only when created and graded by the server for a signed-in account */ verified?: boolean; id: string; projectId: string; language: string; level: Level; roadmap: Roadmap;
  currentLessonId: string; lessons: Record<string, LessonProgress>; attempts: Attempt[];
  competencies: Record<string, Competency>; misconceptions: Record<string, MisconceptionRecord>;
  revisions: Revision[]; events: MentorEvent[]; createdAt: string; updatedAt: string;
  /** Latest unverified activity signal from the VS Code extension. Never graded, never progress evidence. */
  activity?: MentorActivity;
};

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export function curatedRoadmap(level: Level): Roadmap {
  const r = LEVEL_RULES[level];
  return {
    source: "curated",
    title: "Arithmetic Operations in C",
    objective: "Learn C by building a command-line calculator: output, input, arithmetic, division and modulus, conditions, then a complete program.",
    prerequisites: ["A computer and a willingness to type code", "No prior programming needed for Beginner"],
    difficulty: r.difficulty,
    finalProject: "A calculator that reads several calculations and prints correct results, including division by zero handling.",
    modules: [
      { title: "Module 1: Programming fundamentals", lessonIds: ["l1-print", "l2-io"] },
      { title: "Module 2: Arithmetic", lessonIds: ["l3-sum", "l4-submul", "l5-divmod"] },
      { title: "Module 3: Decisions and the final project", lessonIds: ["l6-ifelse", "l7-calc", "l8-final"] },
    ],
    rules: { hintsAllowed: r.hintsAllowed, passScore: r.passScore, openOrder: r.openOrder, depth: r.depth },
  };
}

export function newState(level: Level, roadmap: Roadmap): MentorState {
  const lessons: Record<string, LessonProgress> = {};
  LESSONS.forEach((l, i) => {
    lessons[l.id] = {
      status: roadmap.rules.openOrder || i === 0 ? "available" : "locked",
      attempts: 0, bestScore: 0, hintsUsed: 0, activeExerciseId: l.practice.id, code: {},
    };
  });
  const competencies: Record<string, Competency> = {};
  Object.keys(SKILLS).forEach((s) => (competencies[s] = { skill: s, practicePasses: 0, independentPasses: 0, failures: 0, revisionPasses: 0, level: "not_started", confirmed: false }));
  const t = now();
  return {
    version: 1, id: uid("ms"), projectId: "arithmetic-c", language: "C", level, roadmap,
    currentLessonId: LESSONS[0]!.id, lessons, attempts: [], competencies, misconceptions: {}, revisions: [],
    events: [{ ts: t, type: "session_started", detail: `Started ${roadmap.title} (${level}, roadmap: ${roadmap.source})` }],
    createdAt: t, updatedAt: t,
  };
}

const norm = (s: string) => s.replace(/\r/g, "").split("\n").map((l) => l.trimEnd()).join("\n").trim();

/** Grade each test strictly from real execution output. */
export function gradeRun(tests: TestCase[], runs: RunItem[]): TestResult[] {
  return tests.map((t, i) => {
    const r = runs[i];
    if (!r) return { name: t.name, hidden: !!t.hidden, passed: false, expected: t.expected, actual: "", status: "Not executed", stderr: "" };
    const actual = r.stdout ?? "";
    const ok = r.statusId === 3 && norm(actual) === norm(t.expected);
    const stderr = [r.compileOutput, r.stderr].filter(Boolean).join("\n").trim();
    return { name: t.name, hidden: !!t.hidden, passed: ok, expected: t.expected, actual, status: r.status, stderr };
  });
}

export function assess(exercise: Exercise, code: string, tests: TestCase[], results: TestResult[], runs: RunItem[], attemptsSoFar: number): Assessment {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const score = total ? Math.round((passed / total) * 100) : 0;
  const compileError = runs.some((r) => r.statusId === 6);
  const runtime = runs.some((r) => r.statusId >= 7 && r.statusId <= 12);
  const ctx: DetectCtx = {
    code, compileError,
    tests: tests.map((t, i) => ({ test: t, stdout: runs[i]?.stdout ?? "", stderr: [runs[i]?.stderr, runs[i]?.compileOutput].filter(Boolean).join("\n"), statusId: runs[i]?.statusId ?? 0, passed: !!results[i]?.passed })),
  };
  const found = passed === total && total > 0 ? [] : exercise.detect(ctx);
  const misconceptions = found.map((m) => ({ id: m.id, concept: MISCONCEPTIONS[m.id]?.concept ?? "general", evidence: m.evidence }));
  if (passed === total && total > 0)
    return { status: "passed", errorType: "none", score, passed_tests: passed, total_tests: total, misconceptions: [], feedback: "All tests passed on real execution.", next_action: "advance" };
  const errorType = compileError ? "compile" : runtime ? "runtime" : "wrong_output";
  const first = results.find((r) => !r.passed);
  let feedback: string;
  if (compileError) feedback = `Syntax error: the program did not compile. ${first?.stderr.split("\n").find((l) => /error/i.test(l)) ?? first?.stderr.split("\n")[0] ?? ""}`.trim();
  else if (runtime) feedback = `Runtime error on "${first?.name}": ${first?.status}. The program crashed while running.`;
  else feedback = `Incorrect output on "${first?.name}". Expected "${first?.expected.replace(/\n/g, " | ")}" but got "${(first?.actual ?? "").trim().replace(/\n/g, " | ") || "(nothing)"}".`;
  const repeated = misconceptions.some((m) => attemptsSoFar >= 1);
  return {
    status: score >= 50 ? "needs_improvement" : "failed", errorType, score, passed_tests: passed, total_tests: total, misconceptions, feedback,
    next_action: misconceptions.length ? (repeated ? "targeted_exercise" : "targeted_exercise") : "retry",
    ...(misconceptions.length && REMEDIALS[misconceptions[0]!.id] ? { recommended_exercise: REMEDIALS[misconceptions[0]!.id]!.title } : {}),
  };
}

function bumpCompetency(c: Competency, kind: "pass" | "fail" | "revision_pass", independent: boolean, t: string) {
  if (kind === "pass") { c.practicePasses += 1; if (independent) c.independentPasses += 1; }
  if (kind === "fail") c.failures += 1;
  if (kind === "revision_pass") c.revisionPasses += 1;
  c.lastEvidenceAt = t;
  // Transparent mastery model: confirmed mastery requires a delayed reassessment pass.
  if (c.revisionPasses >= 1 && c.independentPasses >= 2) { c.level = "mastered"; c.confirmed = true; }
  else if (c.independentPasses >= 2 || (c.practicePasses >= 1 && c.revisionPasses >= 1)) { c.level = "proficient"; c.confirmed = false; }
  else if (c.practicePasses >= 1) { c.level = "developing"; c.confirmed = false; }
  else if (c.failures >= 1) c.level = "beginner";
}

function addHours(h: number) { return new Date(Date.now() + h * 3600_000).toISOString(); }
export const REVISION_SCHEDULE_HOURS = [4, 24, 72] as const; // later today, next day, three days

function scheduleRevision(s: MentorState, rev: Omit<Revision, "id" | "status" | "dueAt" | "stage">, stage: number) {
  const open = s.revisions.find((r) => r.status === "scheduled" && r.exerciseId === rev.exerciseId);
  if (open) return;
  s.revisions.push({ ...rev, id: uid("rv"), status: "scheduled", stage, dueAt: addHours(REVISION_SCHEDULE_HOURS[Math.min(stage, 2)]!) });
}

export function unlockedBy(s: MentorState) {
  LESSONS.forEach((l, i) => {
    const p = s.lessons[l.id]!;
    if (p.status !== "locked") return;
    if (s.roadmap.rules.openOrder || l.prerequisites.every((id) => s.lessons[id]?.status === "completed")) p.status = "available";
  });
}

export function masteryOverview(s: MentorState) {
  const comps = Object.values(s.competencies);
  return {
    lessonsCompleted: LESSONS.filter((l) => s.lessons[l.id]?.status === "completed").length,
    exercisesAttempted: new Set(s.attempts.filter((a) => a.mode === "submit").map((a) => a.exerciseId)).size,
    submissions: s.attempts.filter((a) => a.mode === "submit").length,
    testsPassed: s.attempts.filter((a) => a.mode === "submit").reduce((n, a) => n + (a.assessment?.passed_tests ?? 0), 0),
    mastered: comps.filter((c) => c.level === "mastered").length,
    needsWork: comps.filter((c) => c.failures > c.practicePasses || Object.values(s.misconceptions).some((m) => m.concept === c.skill && m.status === "active")).length,
    progressPct: Math.round((LESSONS.filter((l) => s.lessons[l.id]?.status === "completed").length / LESSONS.length) * 100),
  };
}

/**
 * Orchestrator: record a graded submission and decide what happens next.
 * Returns a new state (does not mutate its input).
 */
export function recordSubmission(prev: MentorState, attempt: Attempt, exercise: Exercise, revisionId?: string): { state: MentorState; decision: string } {
  const s = structuredClone(prev);
  const t = now();
  const a = attempt.assessment!;
  s.attempts.push(attempt);
  const info = exerciseById(attempt.exerciseId);
  const lesson = info?.lesson ?? lessonById(attempt.lessonId)!;
  const lp = s.lessons[lesson.id]!;
  lp.attempts += 1;
  lp.bestScore = Math.max(lp.bestScore, a.score);
  if (lp.status === "available" || lp.status === "needs_review") lp.status = "in_progress";
  const comp = s.competencies[exercise.skill] ?? s.competencies[lesson.skill]!;
  const independent = attempt.hintsUsed === 0;
  let decision = "";

  if (a.status === "passed") {
    bumpCompetency(comp, revisionId ? "revision_pass" : "pass", independent, t);
    for (const m of Object.values(s.misconceptions)) {
      if (m.concept === exercise.skill || info?.remedialFor === m.id) {
        if (info?.remedialFor === m.id || revisionId) m.status = revisionId ? "resolved" : "improving";
      }
    }
    if (revisionId) {
      const rv = s.revisions.find((r) => r.id === revisionId);
      if (rv) { rv.status = "done"; rv.completedAt = t; if (rv.stage < 2) scheduleRevision(s, { skill: rv.skill, concept: rv.concept, exerciseId: rv.exerciseId, lessonId: rv.lessonId, reason: "Spaced reassessment", ...(rv.misconceptionId ? { misconceptionId: rv.misconceptionId } : {}) }, rv.stage + 1); }
      decision = "Revision passed: competency evidence updated and the next spaced reassessment is scheduled.";
    } else if (info?.remedialFor) {
      lp.activeExerciseId = lesson.practice.id;
      decision = `Targeted exercise passed. Misconception "${MISCONCEPTIONS[info.remedialFor]?.label}" is now improving. Try the lesson exercise again.`;
      scheduleRevision(s, { skill: comp.skill, concept: MISCONCEPTIONS[info.remedialFor]?.label ?? comp.skill, exerciseId: exercise.id, lessonId: lesson.id, misconceptionId: info.remedialFor, reason: "Reassess after remediation" }, 0);
    } else {
      lp.status = "completed";
      lp.activeExerciseId = lesson.practice.id;
      unlockedBy(s);
      const next = LESSONS.find((l) => s.lessons[l.id]!.status === "available" || s.lessons[l.id]!.status === "in_progress");
      if (next) s.currentLessonId = next.id;
      scheduleRevision(s, { skill: lesson.skill, concept: lesson.title, exerciseId: lesson.practice.id, lessonId: lesson.id, reason: "Retention check" }, 1);
      decision = next ? `Lesson complete. "${next.title}" is unlocked.` : "Course complete. Revision tasks will check retention.";
    }
  } else {
    bumpCompetency(comp, "fail", independent, t);
    const ids = a.misconceptions.map((m) => m.id);
    for (const m of a.misconceptions) {
      const rec = s.misconceptions[m.id];
      if (rec) { rec.count += 1; rec.lastSeen = t; rec.status = "active"; rec.evidence = m.evidence; }
      else s.misconceptions[m.id] = { id: m.id, concept: m.concept, count: 1, status: "active", firstSeen: t, lastSeen: t, evidence: m.evidence };
    }
    const top = ids[0] ? s.misconceptions[ids[0]] : undefined;
    if (top && top.count >= 3 && lesson.prerequisites.length) {
      const prereq = lesson.prerequisites[lesson.prerequisites.length - 1]!;
      s.lessons[prereq]!.status = "needs_review";
      s.lessons[prereq]!.activeExerciseId = lessonById(prereq)!.practice.id;
      a.next_action = "prerequisite_review";
      decision = `"${top.id}" repeated ${top.count} times. Return to "${lessonById(prereq)!.title}" before continuing, then retry with a targeted exercise.`;
      scheduleRevision(s, { skill: comp.skill, concept: MISCONCEPTIONS[top.id]?.label ?? comp.skill, exerciseId: REMEDIALS[top.id]?.id ?? lesson.practice.id, lessonId: lesson.id, misconceptionId: top.id, reason: "Repeated misconception" }, 0);
    } else if (top && REMEDIALS[top.id] && !info?.remedialFor) {
      lp.activeExerciseId = REMEDIALS[top.id]!.id;
      a.next_action = top.count >= 2 ? "prerequisite_review" : "targeted_exercise";
      decision = `Misconception detected: ${MISCONCEPTIONS[top.id]?.label}. Switching to a targeted exercise.`;
      scheduleRevision(s, { skill: comp.skill, concept: MISCONCEPTIONS[top.id]?.label ?? comp.skill, exerciseId: REMEDIALS[top.id]!.id, lessonId: lesson.id, misconceptionId: top.id, reason: top.count >= 2 ? "Recurring mistake" : "New mistake" }, top.count >= 2 ? 0 : 1);
    } else {
      decision = info?.remedialFor ? "Targeted exercise not passed yet. Review the explanation and try again." : "No clear misconception found. Use the output comparison and hints, then retry.";
    }
  }
  s.events.push({ ts: t, type: a.status === "passed" ? "pass" : "fail", detail: `${exercise.title}: ${a.passed_tests}/${a.total_tests} tests. ${decision}` });
  s.updatedAt = t;
  return { state: s, decision };
}

export function exerciseFor(s: MentorState, lessonId: string): { exercise: Exercise; remedialFor?: string } {
  const lp = s.lessons[lessonId]!;
  const info = exerciseById(lp.activeExerciseId) ?? exerciseById(lessonById(lessonId)!.practice.id)!;
  return { exercise: info.exercise, ...(info.remedialFor ? { remedialFor: info.remedialFor } : {}) };
}

export function dueRevisions(s: MentorState, at = Date.now()) {
  return s.revisions.filter((r) => r.status === "scheduled").map((r) => ({ ...r, due: new Date(r.dueAt).getTime() <= at }));
}
