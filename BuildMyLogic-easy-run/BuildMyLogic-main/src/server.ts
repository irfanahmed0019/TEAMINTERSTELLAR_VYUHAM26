import { savedConquestReceipt } from "./lib/shared-conquest";
import type { StruggleState } from "./lib/struggle-engine";
import { canReadRecoverySession } from "./lib/request-auth";
import "./lib/error-capture";
import { createRateLimiter } from "./lib/rate-limit";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleMentorApi } from "./lib/mentor/mentor.api.server";
import {
  connectLearningSession,
  publishConquestReceipt,
  refreshConquestReceipts,
  failSession,
  getHint,
  getRunPlan,
  recordEvent,
  startLearningSession,
  stateOf,
  submitProject,
  verifySession,
} from "./lib/learning-sessions.server";

type ServerEntry = {
  fetch: (
    request: Request,
    env: unknown,
    ctx: unknown,
  ) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// The website calls these endpoints same-origin and the VS Code extension calls
// them from Node (no Origin header), so no cross-site browser origin needs access.
function corsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers.get("origin");
  if (!request || !origin || origin !== new URL(request.url).origin) return {};
  return {
    "access-control-allow-origin": origin,
    vary: "Origin",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
}

const limiter = createRateLimiter();
const rateLimited = (key: string, max: number, windowMs = 60_000) =>
  limiter(key, max, windowMs);
function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

function jsonResponse(
  body: unknown,
  status = 200,
  request?: Request,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(request),
    },
  });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function clean(value: unknown, max = 500): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

async function authenticatedUserId(
  request: Request,
): Promise<string | undefined> {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const accessToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!accessToken) return undefined;
  const supabaseUrl = process.env["VITE_SUPABASE_URL"]?.trim();
  const supabaseAnonKey = process.env["VITE_SUPABASE_ANON_KEY"]?.trim();
  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    supabaseUrl.includes("your-project-id") ||
    supabaseAnonKey.includes("your-supabase")
  )
    return accessToken === "local-builder" &&
      process.env["NODE_ENV"] !== "production"
      ? "local-builder"
      : undefined;
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return undefined;
    const user = (await response.json()) as { id?: unknown };
    return typeof user.id === "string" && user.id ? user.id : undefined;
  } catch {
    return undefined;
  }
}

async function handleBuildMyLogicApi(
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (!pathname.startsWith("/api/")) return null;

  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders(request) });

  // Deployment version probe for the client-side auto-updater. Unique per
  // deployment so open tabs can detect a new build and reload onto it.
  if (request.method === "GET" && pathname === "/api/app-version") {
    const version =
      process.env["VERCEL_GIT_COMMIT_SHA"]?.trim() ||
      process.env["VERCEL_DEPLOYMENT_ID"]?.trim() ||
      "dev";
    return jsonResponse({ ok: true, version });
  }

  // Learning sessions are the shared source of truth for the web dashboard and VS Code.
  // The website authenticates session creation. The extension joins the same session with
  // the short Session ID copied from the website.
  const ip = clientIp(request);
  if (
    pathname.startsWith("/api/sessions") &&
    rateLimited(`sessions:${ip}`, 240)
  )
    return jsonResponse(
      { ok: false, error: "Too many requests. Wait a minute and try again." },
      429,
      request,
    );

  if (request.method === "POST" && pathname === "/api/sessions/start") {
    if (rateLimited(`start:${ip}`, 20))
      return jsonResponse(
        {
          ok: false,
          error: "Too many new sessions. Wait a minute and try again.",
        },
        429,
        request,
      );
    const body = await readJson(request);
    const configuredSupabase = Boolean(
      process.env["VITE_SUPABASE_URL"]?.trim() &&
      process.env["VITE_SUPABASE_ANON_KEY"]?.trim() &&
      !process.env["VITE_SUPABASE_URL"]!.includes("your-project-id"),
    );
    const authenticatedId = await authenticatedUserId(request);
    const requestedId = clean(body["user_id"] ?? body["userId"], 180);
    const localDevelopment =
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      process.env["NODE_ENV"] !== "production";
    if (configuredSupabase && !authenticatedId && !localDevelopment)
      return jsonResponse(
        {
          ok: false,
          error: "Sign in to BuildMyLogic before starting a VS Code session.",
        },
        401,
      );
    if (authenticatedId && requestedId && authenticatedId !== requestedId)
      return jsonResponse(
        {
          ok: false,
          error: "Session user does not match the authenticated learner.",
        },
        403,
      );
    body["user_id"] = authenticatedId ?? (requestedId || "local-builder");
    try {
      const session = await startLearningSession(body);
      return jsonResponse({
        ok: true,
        session_id: session.sessionId,
        state: stateOf(session),
      });
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          error:
            error instanceof Error ? error.message : "Could not start session.",
        },
        400,
      );
    }
  }

  if (request.method === "POST" && pathname === "/api/sessions/connect") {
    if (rateLimited(`connect:${ip}`, 20))
      return jsonResponse(
        {
          ok: false,
          error: "Too many connection attempts. Wait a minute and try again.",
        },
        429,
        request,
      );
    const body = await readJson(request);
    const state = await connectLearningSession(body);
    return state
      ? jsonResponse({ ok: true, session: state })
      : jsonResponse(
          {
            ok: false,
            error:
              "Session ID was not found or has expired. Start a new session on the BuildMyLogic website.",
          },
          404,
        );
  }

  const learningMatch = pathname.match(
    /^\/api\/sessions\/([^/]+)(?:\/(events|test-result|hint|stuck|failed|complete|run-plan|submit|state|recovery-state|conquest))?$/,
  );
  if (learningMatch) {
    const session = await verifySession(
      decodeURIComponent(learningMatch[1] ?? "").toUpperCase(),
      ["state", "recovery-state", "conquest"].includes(learningMatch[2] ?? ""),
    );
    if (!session)
      return jsonResponse(
        { ok: false, error: "Invalid, expired, or unauthorized session." },
        401,
      );
    const action = learningMatch[2] ?? "state";
    if (request.method === "GET" && action === "recovery-state") {
      const authenticatedId = await authenticatedUserId(request);
      if (
        !canReadRecoverySession(
          session.userId,
          authenticatedId,
          url.hostname,
          process.env["NODE_ENV"],
        )
      )
        return jsonResponse(
          {
            ok: false,
            error:
              "Open this recovery link while already signed in as the owner of this session. No attempts were imported.",
          },
          403,
        );
      return jsonResponse({
        ok: true,
        state: {
          ...stateOf(session),
          ...(authenticatedId === session.userId
            ? { verified_owner_id: authenticatedId }
            : {}),
        },
      });
    }
    if (request.method === "GET" && action === "state") {
      await refreshConquestReceipts(session);
      const since = Number(url.searchParams.get("since"));
      const wait = Math.max(
        0,
        Math.min(8000, Number(url.searchParams.get("wait")) || 0),
      );
      if (
        url.searchParams.has("since") &&
        Number.isFinite(since) &&
        since === (session.rev ?? 0) &&
        wait
      ) {
        const deadline = Date.now() + wait;
        while (Date.now() < deadline && since === (session.rev ?? 0))
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(250, deadline - Date.now())),
          );
        await refreshConquestReceipts(session);
      }
      return jsonResponse({ ok: true, state: stateOf(session) });
    }
    if (request.method !== "POST")
      return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
    if (action === "conquest") {
      const owner = await authenticatedUserId(request);
      if (!owner || owner !== session.userId)
        return jsonResponse(
          {
            ok: false,
            error:
              "Only the signed-in session owner can publish website recovery.",
          },
          403,
        );
      const body = await readJson(request);
      const source = process.env["VITE_SUPABASE_URL"]?.trim(),
        key = process.env["VITE_SUPABASE_ANON_KEY"]?.trim();
      if (!source || !key)
        return jsonResponse(
          { ok: false, error: "Saved website recovery is unavailable." },
          503,
        );
      try {
        const r = await fetch(
          `${source}/rest/v1/learner_memory?user_id=eq.${encodeURIComponent(owner)}&select=state_json`,
          {
            headers: {
              apikey: key,
              authorization: request.headers.get("authorization")!,
            },
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!r.ok) throw Error("Cloud recovery could not be read.");
        const rows = (await r.json()) as Array<{
          state_json?: { struggle?: StruggleState };
        }>;
        const state = rows[0]?.state_json?.struggle;
        const receipt = state
          ? savedConquestReceipt(state, clean(body["pattern_id"], 300), session)
          : null;
        if (!receipt)
          return jsonResponse(
            {
              ok: false,
              error:
                "No matching owner-saved, diagnosed changed-task conquest is available. Wait for cloud save, then retry.",
            },
            409,
          );
        return jsonResponse({
          ok: true,
          state: await publishConquestReceipt(session, receipt),
        });
      } catch {
        return jsonResponse(
          {
            ok: false,
            error:
              "Cloud recovery sync is unavailable. Your website result has not been changed.",
          },
          503,
        );
      }
    }
    // hint/stuck call the paid AI model: cap per session and per address.
    if (
      (action === "hint" || action === "stuck") &&
      (rateLimited(`hint:${session.sessionId}`, 12) ||
        rateLimited(`hint-ip:${ip}`, 30))
    )
      return jsonResponse(
        {
          ok: false,
          error: "Too many hint requests. Wait a minute and try again.",
        },
        429,
        request,
      );
    const body = await readJson(request);
    try {
      if (action === "events")
        return jsonResponse({
          ok: true,
          state: recordEvent(
            session,
            clean(body["event_type"], 80),
            body["payload"] && typeof body["payload"] === "object"
              ? (body["payload"] as Record<string, unknown>)
              : {},
          ),
        });
      if (action === "test-result")
        return jsonResponse({
          ok: true,
          state: recordEvent(session, "test_result", body),
        });
      if (action === "hint")
        return jsonResponse({ ok: true, ...(await getHint(session)) });
      if (action === "stuck")
        return jsonResponse({ ok: true, ...(await getHint(session, true)) });
      if (action === "failed")
        return jsonResponse({
          ok: true,
          ...(await failSession(session, clean(body["reason"], 1000))),
        });
      if (action === "run-plan")
        return jsonResponse({
          ok: true,
          run_plan: await getRunPlan(
            session,
            clean(body["platform"], 40) || "linux",
          ),
          state: stateOf(session),
        });
      if (action === "submit")
        return jsonResponse({
          ok: true,
          ...(await submitProject(session, body["files"])),
        });
      if (action === "complete")
        return jsonResponse({
          ok: true,
          state: recordEvent(session, "test_result", { passed: 1, total: 1 }),
        });
      return jsonResponse({ ok: false, error: "Unknown session action." }, 404);
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not update session.",
        },
        400,
      );
    }
  }

  return jsonResponse(
    { ok: false, error: "BuildMyLogic API endpoint not found." },
    404,
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(
    consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`),
  );
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as {
      unhandled?: unknown;
      message?: unknown;
    };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Cloudflare/Lovable injects secrets into the Worker `env` object at request time.
      // TanStack server functions in this app read secrets from process.env per request.
      // Bridge the Worker binding here so SARVAM_API_KEY is available in production.
      const runtimeEnv = env as Record<string, unknown> | null | undefined;
      const sarvamApiKey = runtimeEnv?.["SARVAM_API_KEY"];
      if (typeof sarvamApiKey === "string" && sarvamApiKey.trim()) {
        process.env["SARVAM_API_KEY"] = sarvamApiKey;
      }
      for (const name of [
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
      ]) {
        const value = runtimeEnv?.[name];
        if (typeof value === "string" && value.trim())
          process.env[name] = value;
      }

      const mentorResponse = await handleMentorApi(request);
      if (mentorResponse) return mentorResponse;

      const apiResponse = await handleBuildMyLogicApi(request);
      if (apiResponse) return apiResponse;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
