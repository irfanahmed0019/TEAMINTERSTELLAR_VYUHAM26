import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Shared guard for every AI server function that calls the paid model.
 * The client attaches the learner's Supabase access token; the server verifies
 * it with Supabase and applies a per-learner rate limit so one account cannot
 * drain the AI credits. The limit is per server instance (best effort).
 */
const AI_CALLS_PER_MINUTE = 30;
const hits = new Map<string, number[]>();

function overLimit(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= AI_CALLS_PER_MINUTE) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 5000) for (const k of hits.keys()) { hits.delete(k); break; }
  return false;
}

export const aiAuthed = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getAuthSessionForApi } = await import("./auth");
    const auth = await getAuthSessionForApi();
    if (!auth?.idToken) throw new Error("Sign in with Google to use the AI mentor.");
    return next({ headers: { Authorization: `Bearer ${auth.idToken}` } });
  })
  .server(async ({ next }) => {
    const { authenticatedUserId } = await import("./request-auth.server");
    const userId = await authenticatedUserId(getRequest());
    if (!userId) throw new Error("Your sign-in expired. Sign in with Google again to use the AI mentor.");
    if (overLimit(userId)) throw new Error("Too many AI requests. Wait a minute and try again.");
    return next({ context: { authenticatedUserId: userId } });
  });
