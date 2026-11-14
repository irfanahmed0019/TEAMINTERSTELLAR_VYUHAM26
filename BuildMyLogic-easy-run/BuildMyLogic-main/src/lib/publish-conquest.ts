import { getAuthSessionForApi } from "./auth";
import type { LoopState } from "./loop-types";
import { learnerStorage } from "./demo-mode";
const published = new Set<string>();
/** Call only after cloud restoration/save, never publish a locally guessed result. */
export async function publishSavedConquests(
  state: LoopState,
  expectedUid: string,
  linkedSessionId?: string,
): Promise<number> {
  let sessionId: string | undefined;
  try {
    const params =
      typeof location !== "undefined" && location.pathname === "/reassess"
        ? new URLSearchParams(location.search)
        : null;
    sessionId =
      linkedSessionId ||
      params?.get("session") ||
      JSON.parse(learnerStorage.getItem("bml-vscode-session") || "null")
        ?.sessionId;
  } catch {
    return 0;
  }
  if (!sessionId) return 0;
  const candidates = (state.struggle?.misconceptions || []).filter(
    (m) =>
      m.status === "conquered" &&
      m.reassessed &&
      m.sourceSessionId === sessionId &&
      m.recoveryOwnerId === expectedUid,
  );
  if (!candidates.length) return 0;
  const auth = await getAuthSessionForApi();
  if (auth?.uid !== expectedUid || !auth.idToken) return 0;
  let count = 0;
  for (const m of candidates) {
    const key = `${sessionId}:${m.id}:${m.conqueredAt}`;
    if (published.has(key)) continue;
    const r = await fetch(
      `/api/sessions/${encodeURIComponent(sessionId)}/conquest`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${auth.idToken}`,
        },
        body: JSON.stringify({ pattern_id: m.id }),
      },
    );
    const body = (await r.json()) as { ok?: boolean; error?: string };
    if (!r.ok || !body.ok)
      throw Error(body.error || "Recovery sync was not accepted.");
    published.add(key);
    count++;
  }
  return count;
}
