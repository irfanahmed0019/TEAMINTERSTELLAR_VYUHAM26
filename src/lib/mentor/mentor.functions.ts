import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

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
