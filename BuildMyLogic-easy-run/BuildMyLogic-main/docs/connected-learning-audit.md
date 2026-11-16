# Connected learning implementation audit

Baseline: commit 3151493, 2026-11-16. Existing held video diff backed up before editing. 140 tests pass; TypeScript and production build pass. Lint already fails: 4,619 errors, 19 warnings, mostly formatting. No bulk formatting planned.

## Actual dependency map

TanStack Router/Start + Vite/Nitro, React external LoopState store -> local cache -> existing CloudSync -> Supabase learner_memory.state_json. The README's Next.js/FastAPI diagram is stale, not an architecture instruction.

- ConversationalOnboarding captures three self-reports -> aiGeneratePlan -> LoopState -> DashboardReveal. aiAnalyzeResume exists with authenticated backend but no connected upload. No initial diagnostic in this live onboarding path.
- Sessions folder gate -> authenticated /api/sessions/start -> learning-sessions.server.ts -> learning_sessions persistence -> extension loopback bridge/URI -> events -> website applyBuildSessionEvidence -> existing struggle engine and reactive store.
- Extension tests are client-reported, not tamper-resistant certification. Command exit and file detection are not whole-project correctness. Actual laptop bridge is still unreachable per user; installed version/status pending.
- TopicPractice / MentorApp run finite code checks. Existing struggle engine retains failures, prediction diagnosis, fresh targeted reassessment, owner-scoped recovery safeguards.
- SkillMemory, plan skill levels and separate mentor competencies currently overlap. A central selector/service must extend these without deleting legacy history or silently upgrading provenance.
- Mentor context exists in context-builder, sarvam functions, authenticated mentor API and mentor engine; they do not yet all consume one evidence view.
- CameraVideo has local face detection and playback guard; held changes specify 120-second segments but must be revised to strictly >4-second pause. No question gate or persistent video checkpoint state yet.
- Existing cloud sync/RLS safeguards must remain. Schema additions should prefer optional fields in existing state_json, not parallel profiles or destructive migrations.

## Phased execution and verification

1. Connect resume intake to existing authenticated analyzer; preserve no-resume path. Explicitly label claims unverified. Add safe bounded extraction and extraction-error handling.
2. Add initial diagnostic evidence in the existing state. Distinguish curated/client-graded/AI-estimated from server-verified; do not let resume claims become mastery.
3. Extend central evidence interpretation and propagate through existing state consumers. Preserve skill-specific struggle/reassessment logic, no time-only downgrades.
4. Extend project/session benchmarks and honest activity timing. Project-aware challenge generation requires actually supplied/consented workspace context; no generic challenge mislabeled project-aware.
5. Extend video gates/recovery/persistence and accessible alternative; relevant questions require real lesson context, not invented transcript knowledge.
6. Connect remaining mentor/adaptation consumers and test account restoration/security boundaries.

## Current external verification limits

No paid AI tests authorized. No unsolicited sign-ins. Production authenticated account-isolation/RLS and local extension execution require appropriate test identity/device access; source/unit tests are not substitutes. Existing demo account uses explicit sample provenance. Do not run generated learner code on the application server without the existing sandbox/security boundary.

## Connected implementation checkpoint, 2026-11-16

- Resume analysis normalization is idempotent; unverified extracted claims survive the server/client round trip. Later user scope puts future resume-first onboarding changes in the separate login repository. The already-pushed interstellar intake is retained, not silently reverted.
- Shared competency selector derives smoothed estimates from retained finite practice, reassessment, provisional AI-keyed checks and signed-in server-returned Mentor submissions. Explicit authored-topic aliases only. Legacy numeric fields remain recorded for compatibility, but are not authoritative competency. Course unlock/revision rules remain distinct from general competency estimates.
- Mentor results retain finite test counts and hint use. Device-only runs are not imported as server-graded. Learn puts exact topics with repeated failures first. Struggle DNA shows expected benchmark versus observed work, correctness, hints and attempt number without time-only weakness labels.
- Local learner-state ownership marker prevents a different or unknown uid cache from becoming the incoming account's baseline. Old/unbound cache is retained separately before reset. Existing cloud normalization preserves unknown fields. Live cross-account restoration is still not tested.
- Video sections use120s question gates, strict >4000ms absence recovery to the last question-completed checkpoint, no absent watch credit, persisted account/video checkpoints and camera-free self-reported presence. Questions are authored TOPIC reviews, not timestamp-aligned transcript assessments, and repeat on long videos. Final-ended sampling has a bounded final-fraction regression check.
- Extension0.3.6 uses high-entropy scoped pairing credentials, owner-authorized website reads and explicit local evidence/command consent. Display code alone cannot pair. Historical data stays, but reconnect requires installing0.3.6, reloading VS Code and starting a new session from the signed-in website.
- Generic compile/start/project-suite output is not requirement completion. Only a matching checkpoint evaluator plus its declared output assertions may advance that checkpoint. Such results remain extension-reported, not tamper-resistant certification. Existing generic missions without a dedicated evaluator intentionally remain unverified. General project-aware challenge/evaluator generation is not finished.

### Actual checks, not acceptance of the entire master

-177 application tests pass, application typecheck/build pass;12 extension tests and extension typecheck pass. Tests use isolated fixtures for account/session behavior; no paid AI calls.
- Real production YouTube camera-free playback paused at120.0s for the first question on `/videos`, inspected under explicitly labeled sample account. Stopped without submitting an answer or inventing completed learning.
- Live extension install page points to0.3.6. Final deployed VSIX48229 bytes, SHA25655044d6add09987ea35c860cd8e2eb21431b9fcc11089554fa5188f3b8e40703.
- Actual user's laptop connection, real camera absence behavior, paid model generation, live cross-account/RLS, full new-user to real-project reassessment journey remain unverified.
- Lint remains failing:4,841 findings (4,821 errors,20 warnings), compared with baseline4,638. Most are formatting in legacy/changed files; no lint-clean claim and no unrelated bulk rewrite. Build/test results do not excuse lint debt.

## Superseding checkpoint, 2026-11-16 16:14 IST

This section supersedes older counts and repository-routing notes above.

- Latest owner request restores login, optional browser PDF/DOCX/TXT resume extraction/review, conversational onboarding and initial diagnostic within the same Interstellar app. No broad changes made to the separate 1234 repository. Reviewed resume and partial chat are saved immediately; returning learners resume the diagnostic stage. Unavailable or skipped checks remain explicitly unassessed/partial, not fabricated completion. Real paid-AI onboarding journey remains untested.
- Extension 0.3.7 is live. Actual fetched artifact: 50,651 bytes; SHA256 d1ce3cc280814548e9156fce99f389cc76194d2c364aa61c79c28c4cc2e23475. It supports only a consented existing standalone Python decimal converter, with an additional explicit input-contract-change confirmation, dedicated AST-isolated 14-case evaluator and authored eight-minute benchmark. Other projects remain pending. The website owner attribution does not certify extension execution.
- Dedicated source-task results enter only narrow input-validation history, never original mission progress or broad stack skills. Repeated failures route to the real Learn topic, prediction probe, changed-task diagnostic/reassessment and owner/source-session receipt. Python/C reference programs and changed-task receipt fixtures execute locally; actual user's extension-to-Learn-to-cloud journey remains unverified.
- Passive Sessions polling no longer calls paid AI retuning or rewrites the roadmap. Legacy partial aggregate totals do not invent failed assertions. Assigned project source context is pinned against later manifest overwrite. First foreground timing delta is bounded against session age rather than discarded.
- 237 application tests pass; typecheck/build pass (last two added tests are pure regressions after that build). 15 extension tests/typecheck passed on 0.3.7. Changed session/server lint has zero errors and two existing hook warnings. Full lint last measured 4,092 findings, still failing; no clean-lint claim.
- Open privacy issue: raw loop.state.retained.<uid> snapshots still have no recovery/cleanup lifecycle. They preserve potentially unsaved local-only records during account switching, so blindly deleting them risks data loss. A bounded account-owned recovery/export/discard lifecycle is the next fix. No cloud records deleted.
- Other open gaps: global Mentor evidence cap may evict older skill history; general project coverage; transcript/timestamp-aligned video questions; real camera absence; live authenticated two-account restoration/RLS; actual laptop bridge. Public caption endpoint returned empty and one bounded extraction attempt hit a YouTube sign-in challenge, so no transcript alignment was invented.
- Live homepage/sign-in and deployed onboarding asset strings verified read-only. No unsolicited sign-in, account creation, paid model test or learner-record mutation used to manufacture acceptance evidence.
