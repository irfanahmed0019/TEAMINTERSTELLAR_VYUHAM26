# BuildMyLogic — Implementation Status

Last verified: 2026-10-30 (session continuation, Act mode).

## What already works (verified live)

### Website ↔ VS Code extension session workflow — STABLE
End-to-end flow confirmed by running the dev server (`BuildMyLogic-main`) and exercising the API directly:

- `POST /api/sessions/start` — creates a `BML-XXXXX` session, accepts anonymous/local-builder flow when Supabase is not configured, and binds to an authenticated user when Supabase auth is present.
- `POST /api/sessions/connect` — the extension joins a session with only the short Session ID; flips status to `connected`.
- `POST /api/sessions/{id}/events` — generic event ingestion (`heartbeat`, `test_result`, `build_result`, `compiler_error`, `runtime_error`, `file_evidence`, `stuck`, `session_ended`).
- `POST /api/sessions/{id}/test-result` — shorthand for test-result events; updates `test_score`.
- `POST /api/sessions/{id}/hint` and `/stuck` — returns deterministic fallback mentor guidance when `SARVAM_API_KEY` is absent, and Sarvam-generated guidance when present.
- `POST /api/sessions/{id}/failed`, `/run-plan`, `/submit`, `/complete` — all respond correctly.
- `GET /api/sessions/{id}/state` — polling endpoint used by `src/routes/sessions.tsx` every 5s to sync extension progress back into the website dashboard.
- Website → extension handoff via `vscode://buildmylogic.logic-analyser/connect?sessionId=...&apiBaseUrl=...` URI, with a local desktop bridge (`scripts/local-folder-picker.mjs`, port 8091) that opens the right folder in VS Code and forwards the URI when available, falling back to the raw URI otherwise.
- In-memory session store is kept on `globalThis` so Vite SSR module reloads during development do not invalidate a session ID already handed to the extension; optional Supabase persistence (`learning_sessions` table) when service-role credentials are configured.

The matching VS Code extension (published as `buildmylogic.logic-analyser`, built as `.vsix`) talks to exactly these endpoints (confirmed by decompiling the bundled `dist/extension.js` in the shipped `.vsix`). No extension TypeScript source ships in this repository — only prebuilt `.vsix` artifacts under `BuildMyLogic-main/public/downloads/` and the repo root. This is expected: the extension is developed/packaged separately and distributed as a signed build.

### Fixed during this session
1. **Broken dashboard navigation** — `AppShell` nav links and `"/dashboard"` redirect targets (OAuth callback, onboarding redirect) pointed at a route that does not exist in the router (`routeTree.gen.ts` only defines `/auth/dashboard`). All occurrences corrected to `/auth/dashboard`. This was a real, user-facing bug: signing in or finishing onboarding would soft-404.
2. **`npm run typecheck` was fully broken** (60+ errors) due to the project's strict `tsconfig.json` (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`). Fixed across `server.ts`, `teaching-guard.ts`, `curriculum-engine.ts`, `challenge-engine.ts`, `learning-sessions.server.ts`, `loop-store.ts`, `auth.ts`, `supabase.ts`, `AppShell.tsx`, `ScheduleModal.tsx`, `sarvam.functions.ts`, `routes/{learn,missions,skills,progress,sessions,auth/callback}.tsx`. `npm run typecheck` and `npm run build` both pass cleanly now.
3. Verified `npm run build` (the actual deploy path via Vite + Nitro) succeeds and produces a working Cloudflare/Vercel-compatible server bundle.

### Known pre-existing, out-of-scope issue


## Architecture confirmed in place
- TanStack Start app (`BuildMyLogic-main/src/server.ts`) hosts both SSR routes and the `/api/*` session endpoints in one Worker-style fetch handler — matches the "extend the existing backend" directive in `CLAUDE.md`.
- `src/lib/learning-sessions.server.ts` is the single source of truth for session state, shared by the website dashboard and the VS Code extension.
- `src/lib/teaching-guard.ts` + `src/lib/curriculum-engine.ts` implement the deterministic C-fundamentals curriculum ladder (Hello World → ... → CLI Calculator) described in `CLAUDE.md` §1/§5.
- `src/lib/sarvam.server.ts` / `sarvam.functions.ts` implement the Learning and Assessment Agent (Sarvam AI) with deterministic fallbacks when no API key is configured — satisfies "AI never invents scores" principle.

## Next incomplete priorities (not yet implemented)
In order of what `CLAUDE.md` calls out as missing from the current app:

1. **Adaptive Decision Agent / Jev integration** — no code path currently calls an external "Jev" service; mission/difficulty selection today is deterministic (`challenge-engine.ts` picks by skill-subset match + difficulty sort), not a learned/structured decision agent. This is the biggest gap versus the brief.
2. **Dynamic project recommendation with explicit learner approval** (§5) — `applySarvamDashboardPlan` retunes the plan automatically on struggle/failure/completion, but there is no "why this project" explanation surfaced to the student, and no explicit approve/decline UI gate before swapping the active project.
3. **Personalized YouTube recommendations** (§6) — not implemented anywhere in the codebase; no search integration exists.
4. **Outcome measurement for interventions** (§7/§8 "evaluate its own adaptive policy") — hints/interventions are recorded as session events, but there is no aggregation that measures whether a given intervention type improved subsequent test pass rates.
5. **VS Code extension source control** — the extension ships only as a `.vsix`; there is no `vscode-extension/` source directory in this repo to iterate on directly. If extension-side changes become necessary, source needs to be re-created or imported before further extension work can proceed in this repo.

## How to run
```bash
cd BuildMyLogic-main
cp -n .env.example .env   # fill in SARVAM_API_KEY / Supabase vars for full features
npm install
npm run dev -- --host 0.0.0.0   # starts Vite + local desktop bridge (port 8091)
```
Verification commands used this session:
```bash
npm run typecheck   # passes
npm run build       # passes
curl -X POST localhost:PORT/api/sessions/start -d '{...}'
curl -X POST localhost:PORT/api/sessions/connect -d '{"session_id":"BML-..."}'
curl -X POST localhost:PORT/api/sessions/BML-xxxxx/events -d '{"event_type":"compiler_error","payload":{...}}'
curl -X POST localhost:PORT/api/sessions/BML-xxxxx/stuck -d '{}'
curl localhost:PORT/api/sessions/BML-xxxxx/state
```

- `npm run lint` reports ~2000 Prettier-formatting findings across nearly the whole codebase (pre-existing, not introduced by this session, auto-fixable with `eslint --fix`). This is a formatting/style debt, not a functional defect, and was left alone to avoid an enormous, low-value diff. Recommend running `npm run format && npm run lint -- --fix` as a dedicated follow-up.
