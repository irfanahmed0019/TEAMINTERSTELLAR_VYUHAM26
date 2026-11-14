import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createRateLimiter } from "./rate-limit";

/**
 * Shared guard for every AI server function that calls the paid model.
 * The client attaches the learner's Supabase access token; the server verifies
 * it with Supabase and applies a per-learner rate limit so one account cannot
 * drain the AI credits. The limit is per server instance (best effort).
 */
const AI_CALLS_PER_MINUTE = 30;
const limited = createRateLimiter();

export const aiAuthed = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { isPublicDemo } = await import("./demo-mode");
    if (isPublicDemo())
      throw new Error(
        "AI is not available in the public demo. Exit demo and sign in to use AI.",
      );
    const { getAuthSessionForApi } = await import("./auth");
    const auth = await getAuthSessionForApi();
    if (!auth?.idToken) {
      if (typeof window !== "undefined")
        window.setTimeout(() => window.location.assign("/"), 2500);
      throw new Error("Sign in with Google to use the AI mentor.");
    }
    try {
      return await next({
        headers: { Authorization: `Bearer ${auth.idToken}` },
      });
    } catch (error) {
      // The server rejected the token: clear the stale session and send the
      // learner to the Google sign-in screen instead of leaving a dead end.
      if (error instanceof Error && /sign-in expired/i.test(error.message)) {
        const { signOut } = await import("./auth");
        await signOut();
        if (typeof window !== "undefined")
          window.setTimeout(() => window.location.assign("/"), 2500);
      }
      throw error;
    }
  })
  .server(async ({ next }) => {
    const { authenticatedUserId } = await import("./request-auth.server");
    const userId = await authenticatedUserId(getRequest());
    if (!userId)
      throw new Error(
        "Your sign-in expired. Sign in with Google again to use the AI mentor.",
      );
    if (limited(`ai:${userId}`, AI_CALLS_PER_MINUTE))
      throw new Error("Too many AI requests. Wait a minute and try again.");
    return next({ context: { authenticatedUserId: userId } });
  });
