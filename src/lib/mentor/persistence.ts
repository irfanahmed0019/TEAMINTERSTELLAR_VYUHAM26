/**
 * Client helpers for the AI Mentor.
 * - Signed-in learners: all evidence is created and stored by the server
 *   (/api/mentor/*). The browser only reads its own state.
 * - Signed-out learners: practice mode. State lives in this browser only and is
 *   never treated as verified evidence.
 */
import { getAuthSessionForApi } from "../auth";
import type { MentorState } from "./engine";

const KEY = "bml.mentor.v1";

export function loadLocal(): MentorState | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    const s = raw ? (JSON.parse(raw) as MentorState) : null;
    return s && s.version === 1 && !s.verified ? s : null;
  } catch { return null; }
}
export function saveLocal(s: MentorState | null) {
  try { if (!s) localStorage.removeItem(KEY); else if (!s.verified) localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
}

export async function accountToken(): Promise<string | null> {
  const a = await getAuthSessionForApi();
  return a?.idToken ?? null;
}

/** Calls a mentor API route. Sends the learner's token when signed in. */
export async function mentorApi<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown; auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init?.auth !== false) {
    const t = await accountToken();
    if (t) headers["authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(path, { method: init?.method ?? "POST", headers, ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}) });
  const data = (await res.json().catch(() => null)) as ({ ok: boolean; error?: string } & T) | null;
  if (!res.ok || !data || data.ok === false) throw new Error(data?.error || `Request failed (${res.status}).`);
  return data;
}
