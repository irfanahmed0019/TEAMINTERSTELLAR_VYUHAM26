// Test-only PostgREST stand-in for the learning_sessions table. It enforces the
// filters the server relies on (eq., is.null on columns and session_data->>path),
// honours Prefer return=representation and resolution=ignore-duplicates, and lets
// tests inject failures, lost responses and concurrent writers.
export function createMockSupabase(
  base = "https://session-regression.invalid",
) {
  const db = new Map();
  const state = {
    db,
    log: [],
    failNext: [], // "write503" | "writeLost" | "read503"
    beforeWrite: undefined, // (row, method) => void, runs just before a write applies
  };
  const matches = (row, params) => {
    for (const [key, value] of params) {
      if (key === "select" || key === "on_conflict") continue;
      let actual;
      if (key.startsWith("session_data->>"))
        actual = row.session_data?.[key.slice("session_data->>".length)];
      else actual = row[key];
      if (value === "is.null") {
        if (actual !== undefined && actual !== null) return false;
      } else if (value.startsWith("eq.")) {
        if (String(actual) !== value.slice(3)) return false;
      }
    }
    return true;
  };
  const fetchImpl = async (url, options = {}) => {
    if (!String(url).startsWith(base + "/rest/v1/learning_sessions"))
      throw Error("Real network forbidden");
    const u = new URL(url);
    const method = options.method ?? "GET";
    const prefer = options.headers?.prefer ?? "";
    state.log.push({ method, url: String(url) });
    const fail = state.failNext[0];
    if (method === "GET") {
      if (fail === "read503") {
        state.failNext.shift();
        return new Response("down", { status: 503 });
      }
      const rows = [...db.values()].filter((r) => matches(r, u.searchParams));
      return Response.json(structuredClone(rows));
    }
    if (fail === "write503") {
      state.failNext.shift();
      return new Response("down", { status: 503 });
    }
    const incoming = JSON.parse(options.body);
    state.beforeWrite?.(incoming, method);
    let written = [];
    if (method === "PATCH") {
      for (const row of db.values())
        if (matches(row, u.searchParams)) {
          Object.assign(row, structuredClone(incoming));
          written.push(structuredClone(row));
        }
    } else if (method === "POST") {
      const exists = db.has(incoming.session_id);
      if (exists && prefer.includes("ignore-duplicates")) written = [];
      else {
        db.set(incoming.session_id, structuredClone(incoming));
        written = [structuredClone(incoming)];
      }
    }
    if (fail === "writeLost") {
      state.failNext.shift();
      throw new TypeError("network lost after the write applied");
    }
    return prefer.includes("return=representation")
      ? Response.json(written)
      : new Response(null, { status: 204 });
  };
  return { state, fetchImpl };
}
