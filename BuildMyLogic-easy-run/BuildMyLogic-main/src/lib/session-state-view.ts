/**
 * What the Sessions page may show as the current session while it talks to the
 * server. Local plan data (roadmap tasks, "Not connected", a local attempt
 * count) is never session truth for a session id we are still loading.
 */
export type SessionViewState = "none" | "loading" | "error" | "ready";

export function sessionViewState(input: {
  hasSessionId: boolean;
  hasRemoteState: boolean;
  loadFailed: boolean;
}): SessionViewState {
  if (!input.hasSessionId) return "none";
  if (input.hasRemoteState) return "ready"; // last verified state is kept on failure
  return input.loadFailed ? "error" : "loading";
}

/** Outcome of one authenticated state call. */
export function classifyStateResponse(input: {
  ok: boolean;
  status: number;
  hasState: boolean;
}): "apply" | "reset" | "failed" {
  if (input.ok && input.hasState) return "apply";
  if (input.status === 401 || input.status === 403 || input.status === 404)
    return "reset";
  return "failed";
}
