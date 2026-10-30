/**
 * Persistence for the AI Mentor. Signed-in learners are saved to Supabase
 * (mentor_* tables, per-owner RLS, user JWT only). A device copy in
 * localStorage is kept as a fallback and for signed-out use; the UI states
 * which one is active. Nothing here fakes success: errors are returned.
 */
import { supabase } from "../supabase";
import type { MentorState } from "./engine";

const KEY = "bml.mentor.v1";

export type SaveResult = { cloud: "saved" | "signed_out" | "error"; message?: string };

export function loadLocal(): MentorState | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    const s = raw ? (JSON.parse(raw) as MentorState) : null;
    return s && s.version === 1 ? s : null;
  } catch { return null; }
}
export function saveLocal(s: MentorState | null) {
  try { if (!s) localStorage.removeItem(KEY); else localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
}

async function userId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}
export async function isSignedIn() { return (await userId()) !== null; }

export async function loadCloud(): Promise<{ state: MentorState | null; error?: string }> {
  if (!supabase || !(await userId())) return { state: null };
  const { data, error } = await supabase.from("mentor_sessions").select("state").order("updated_at", { ascending: false }).limit(1);
  if (error) return { state: null, error: error.message };
  const st = (data?.[0]?.state ?? null) as MentorState | null;
  return { state: st && st.version === 1 ? st : null };
}

export async function saveCloud(s: MentorState): Promise<SaveResult> {
  const uid = await userId();
  if (!supabase || !uid) return { cloud: "signed_out" };
  const fail = (e: { message: string } | null) => (e ? { cloud: "error" as const, message: e.message } : null);
  let e = fail((await supabase.from("mentor_sessions").upsert({
    id: s.id, user_id: uid, project_id: s.projectId, language: s.language, level: s.level, roadmap: s.roadmap, state: s,
    current_lesson_id: s.currentLessonId, updated_at: new Date().toISOString(),
  })).error);
  if (e) return e;
  const subs = s.attempts.filter((a) => a.mode === "submit").map((a) => ({
    id: a.id, session_id: s.id, user_id: uid, lesson_id: a.lessonId, exercise_id: a.exerciseId, mode: a.mode, code: a.code,
    test_results: a.results, assessment: a.assessment ?? null, hints_used: a.hintsUsed, created_at: a.ts,
  }));
  if (subs.length && (e = fail((await supabase.from("mentor_submissions").upsert(subs)).error))) return e;
  const comps = Object.values(s.competencies).map((c) => ({
    session_id: s.id, user_id: uid, skill: c.skill, level: c.level, confirmed: c.confirmed, practice_passes: c.practicePasses,
    independent_passes: c.independentPasses, failures: c.failures, revision_passes: c.revisionPasses, updated_at: new Date().toISOString(),
  }));
  if ((e = fail((await supabase.from("mentor_competencies").upsert(comps)).error))) return e;
  const mis = Object.values(s.misconceptions).map((m) => ({
    session_id: s.id, user_id: uid, misconception_id: m.id, concept: m.concept, occurrences: m.count, status: m.status, evidence: m.evidence, first_seen: m.firstSeen, last_seen: m.lastSeen,
  }));
  if (mis.length && (e = fail((await supabase.from("mentor_misconceptions").upsert(mis)).error))) return e;
  const revs = s.revisions.map((r) => ({
    id: r.id, session_id: s.id, user_id: uid, skill: r.skill, concept: r.concept, exercise_id: r.exerciseId, lesson_id: r.lessonId,
    misconception_id: r.misconceptionId ?? null, stage: r.stage, status: r.status, reason: r.reason, due_at: r.dueAt, completed_at: r.completedAt ?? null,
  }));
  if (revs.length && (e = fail((await supabase.from("mentor_revisions").upsert(revs)).error))) return e;
  return { cloud: "saved" };
}

export async function saveEvent(sessionId: string, type: string, detail: string) {
  const uid = await userId();
  if (!supabase || !uid) return;
  await supabase.from("mentor_events").insert({ session_id: sessionId, user_id: uid, event_type: type, detail });
}
