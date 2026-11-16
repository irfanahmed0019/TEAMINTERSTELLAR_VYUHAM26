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

## Superseding checkpoint, 2026-11-16 16:59 IST

This section supersedes older implementation/status claims above, not the original baseline.

- Account recovery now blocks signed-out and mismatched-owner routes without exposing or deleting another account's primary/retained local work. Same-owner recovery/export/discard is explicit; ordinary sign-out flushes before clearing. Older abandoned copies still await the owner's choice, not automatic expiry. Live two-account restoration remains unverified.
- Mentor evidence no longer has a global 180-record deletion cap. The recent per-skill view is a display window, not deletion of saved history.
- Video catalog includes 103 source-caption questions across 22 short lessons and 134 for the default long Python course. Quotes and caption starts/next-caption boundaries are shown. Automatic captions can be wrong; those boundaries are not audio-verified ends. Unknown/outro sections explicitly fall back to topic review, not invented alignment. Real camera absence and authenticated cloud checkpoint restoration remain unverified.
- Extension 0.3.8 is live: 53,827 bytes, SHA256 674b5cbb1b1155b46259743a7422324c2aca05339d85f39f370756c97a129b82. An explicitly selected narrow Python decimal function can be isolated inside a multi-function module and pinned to approved literal existing tests. Test files are parsed as data, never imported; strict AST/shadowing/recursion guards fail closed. Actual user's laptop pairing and general project challenges remain unfinished/unverified.
- Initial onboarding now includes optional authored practical C/Python coding checks selected from nine existing Learn concepts. Estimated-medium transfer first; a failing submission offers a basic task on the same concept, a full pass offers a related challenge. Two submissions are a limited starting sample, not full-stack assessment or mastery. Other languages/frameworks stay unassessed. Code is sent only on explicit submit to the existing public Judge0 CE sandbox; no AI call is used by this feature.
- The authenticated server owns coding task inputs/expected output and grading. Owner/task/language-bound returned evidence updates the existing profile, central competency, Learn priorities and mentor/plan context. It is finite output evidence saved through the existing client/cloud state, not an immutable signed credential. Hints are self-reported. Cases are inspectable learning feedback, not hidden anti-memorization tests. Source structure, authorship and independence are not certified.
- Draft coding code/hints use the existing account-bound profile and recovery/sign-out lifecycle, with no new raw per-user localStorage cache. Skipping/unavailable execution creates no fabricated failure or completed assessment.
- Combined application tests/typecheck/build pass; focused changed-feature lint passes. The new reference tests execute 36 actual GCC/Python task/language/level combinations. The API harness loads the actual handler with mocked auth/Judge0 transport and runs real Python locally, covering auth/origin/task guards, good and incorrect programs and unavailable-without-evidence. A separate real production public-runner request passed three Python boundary cases. Neither is authenticated production onboarding/cloud end-to-end acceptance.
- Actual Chrome mobile component checks use clearly labeled fixture account/API results: draft/hint profile restoration, unavailable-no-evidence, failed-check adaptation and no overflow. No paid AI tests, unsolicited sign-ins or real learner progress fabricated. Full lint debt and remaining general-project/full-journey verification gaps remain open.

### Initial-coding follow-up

The authored fallback first-session review now follows the latest finite coding result: review the exact concept after failure, try a fresh unassisted exercise after hint use, or try a changed example after a pass. Project milestones and unassessed skill scores stay unchanged. This is first-review adaptation, not generation of a new project roadmap. Session time is not increased. Coding tasks show authored 8-minute transfer / 5-minute basic benchmarks and explicitly state that reliable active solving time is unavailable here. The browser's current live recovery gate was preserved without clearing or claiming older local progress; authenticated onboarding/cloud acceptance still awaits an appropriate test account/recovery decision.

### 17:10 IST corrections and interaction estimates

- Found and fixed a material 0.3.8 integration regression: the adapter accepted only the original single evaluator marker while pinned-test assignments return two markers. Matching digest/test-path/case-count/baseline metadata is now required for the two-marker route. Legacy one-marker sessions remain compatible only without pinned-test metadata. An actual assignProjectChallenge return value now passes through the real adapter/ingestion in regression tests. Previously rejected 0.3.8 receipts were not incorrectly credited; reopening their existing session allows the existing reactive ingestion path to consume eligible saved attempts without inventing a new attempt.
- Initial coding has an optional explicitly started/paused interaction clock. It uses visible/focused recent edit windows capped at 30 seconds idle, pauses for execution, and restores only a paused account/task-bound draft. Background/blur clears recent activity. This is a browser-reported estimate, not certified active thinking time, attention or authorship. Conservative sampling can omit fractional time at blur and up to ten seconds on abrupt closure. Timing is separate from correctness/hints and cannot change competency by speed alone. The server owns the authored expected benchmark; reported observed time is bounded and labeled client-derived. Missing/invalid timing stays unavailable.
- Combined 314 application tests, typecheck/build and focused changed-code lint pass. Real handler/local-Python transport-mocked checks and actual Chrome component opt-in/pause/profile-restore/submission checks pass. Production authenticated full onboarding and utility-project 0.3.9 flow remain unverified/not yet released in this checkpoint.

### Project literal-repair 0.3.9

- New separate project test repair flow uses the chosen existing Python source function plus its own chosen failing literal equality assertions. It is not a second decimal oracle. Price/discount, boolean thresholds and trim/lower normalization were exercised in actual isolated subprocess fixture projects. Original learner repositories were not executed.
- One to three scalar parameters; finite return/if/else, bounded numeric arithmetic/conversion/comparison and strip/lower/upper. No dependencies, loops, mutation, recursion, imports or general framework execution. Only the selected AST is validated/transformed/executed with bounded helpers; neither module nor tests are imported. This is not an arbitrary-Python sandbox. Unsupported grammar/provenance/resource bounds block without recording a failure.
- Actual approved Python scalar `==` semantics are preserved, including int/float and bool/int equivalence. Independent review caught a stricter-type false-failure path before publication; it was fixed and actual subprocess regressions cover both numeric directions, True/1, None/string mismatches and malformed CLI blocked exit3. No additional type contract was authorized or silently imposed.
- At least one actual locally observed baseline failure is required; all-passing baselines create no fake repair task. Function signature, selected source digest, exact test digest and canonical cases digest are pinned. Repair body may change. Only all approved cases passing earns the dedicated marker; test/signature drift blocks without a failed attempt. Finite known cases are not unseen requirements or whole-project correctness.
- New marker/concept maps to an owner-scoped `Python project test repair` evidence topic, not decimal DNA, broad Python, frameworks or original mission completion. Actual server assignment -> adapter -> one narrow attempt -> replay dedupe is tested. No concept-specific fresh-reassessment oracle is invented for arbitrary utility logic; such recovery remains explicitly unsupported rather than falsely conquered.
- Independent grammar/security and separate adapter review are ready. Combined 316 app tests, 27 extension tests, both typechecks, app build and extension compile pass. Focused changed-code lint has zero errors and two pre-existing Sessions hook warnings. Final package is 59,083 bytes, SHA256 30e09bcc2f0057a1f6bd4f352cfdb66f6f160c82d9c10f4ab6d3f7dbe0c44729. Authenticated real-user laptop/cloud/full journey and broad project generation remain unverified/incomplete.

## Connected project-test recovery, 2026-11-16

The local connected harness is `node scripts/verify-connected-learning.mjs`.
It runs the actual API router, Python inspector and evaluator, session helpers,
project evidence adapter, competency selectors, Learn lesson selector and recovery
importer together. Authentication and cloud REST are explicitly mocked in memory.
No real user project, learner identity, paid AI call or remote runner is used.

The checked path is: approve a new partitioned project-test task; fail its actual
initial cases twice; import those events through the owner recovery endpoint;
show the matching project-test lesson; pass the initial repair while keeping the
pattern locked; save the lesson and prediction to the mock owner cloud; enable
readiness twice without changing the original review timestamp; fail one of two
reserved inputs; repair the actual implementation; pass both reserved inputs;
save the exact bound receipt; import finite recovery into the existing struggle
history; restore and retry without duplicate evidence.

Negative checks include another owner, extension self-authorization of learning,
missing/wrong prediction, stale test pins, failed strict persistence, changed
project tests and blocked execution. None can create a recovered pattern.

New project tasks may explicitly partition at least four Python-distinct input
argument tuples. The first N-2 cases are initial repair cases, the final two are
later changed-input recheck cases. All expected values come from the approved
existing test file. No expected result is generated from the broken function or
an AI answer. The original test file remains readable, so these are reviewed
existing tests, not secret, unseen or independent checks. Older finite-only
contracts cannot acquire a changed-input receipt retroactively.

Bindings include owner, source session, challenge, original source digest, test
file digest, case digest, function signature and partition digest. A repair may
change the allowed function body, not the pinned identity or test contract.
Ready and receipt timestamps use numeric epoch milliseconds. Session receipts
remain extension-reported execution evidence; the server validates the contract
and saves the report, but does not claim to have run the user's local code.

This closes the bounded utility-test recovery implementation. It does not accept
the entire product journey: real sign-in and cloud deployment, a user's actual
VS Code pairing, generated resume/onboarding/roadmap behavior, camera absence and
video restoration, and arbitrary framework project correctness still require
separate connected acceptance. Passing this harness is not a full delivery claim.
