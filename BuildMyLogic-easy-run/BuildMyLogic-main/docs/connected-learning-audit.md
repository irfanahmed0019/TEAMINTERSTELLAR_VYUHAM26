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

## Connected intake retention and route acceptance (2026-11-16)

Fixed the actual delayed-diagnostic race: a question-bank response previously overwrote coding submissions saved while the bank was pending. The callback now merges the current profile, with current-owner/mount guards on profile and plan writes. Weekly availability is retained as reported text, not silently converted to 19:00-21:00 daily. Existing explicit time preferences remain; fallback task duration without a chosen window is an authored 30-minute estimate. Calendar writes were not performed in acceptance.

The real Dashboard session poll now refreshes and supplies the signed-in owner's bearer token. Delayed remote results and AI retunes cannot apply after route unmount or an owner change. The owner is checked on every poll and again after each async boundary.

Reproducible: `python scripts/verify-onboarding-browser.py` (Python Playwright, python-docx, reportlab and local Chrome required); `BML_QA_UNMOUNT=1` covers stale onboarding completion. The browser path uses actual PDF/DOCX/TXT extraction, reviewed resume, chat, six answers across four question formats, two actual diagnostic-handler submissions with local Python, evidence retention/reload, plan inputs, reveal, real Dashboard/Learn/Mentor routes, bearer-poll inspection, shared mentor context and delayed Dashboard-retune unmount protection. Auth, cloud REST/restore, AI outputs and runner transport are explicit fixtures. No paid provider calls. Local pixels inspected at mobile width.

Independent review: 335 app tests, 30 extension tests and TypeScript pass; DOCX/TXT connected browser race/restore and unmount negative independently pass. This environment also passes actual PDF extraction. The independent environment's PDF path still reports `Invalid workerSrc type` with a symlinked dependency tree, so independent PDF browser acceptance remains unresolved. Do not describe this as a real authenticated account, real cloud persistence, physical-camera, real YouTube or installed laptop-extension acceptance. The earlier project loop has its own separate acceptance and limitations above.

## Final partial-video gate regression (2026-11-16)

Independent actual-component review found a real end-of-video stall: at one-second presence samples, a 250-second video reached 249 seconds of credited playback, then repeatedly sought 249 without presenting the last question. The old ended-state helper required a fixed 0.75-second adjacency. Normal 333ms sampling hid this failure.

The correction uses the exact same elapsed allowance as ordinary observed playback (capped at two seconds per sample, allowing up to 2x playback), with a required prior sample and finite current time. It does not add a fixed end-credit bonus. The component reads position/player state once per sample. Absence and checkpoint-answer rules are unchanged. Tests reject absent, paused, zero-elapsed, missing-sample, invalid-time and large unwatched-end jumps.

Reproduce the actual component with `python scripts/verify-video-end-browser.py` and `BML_QA_SAMPLE_MS=333` or `2000`. The synthetic 250-second player restores two completed sections, reaches the final partial section's question, and persists `[1,2,3]` only after the correct answer. Player, camera frames, face model, identity and cloud are explicit fixtures; this is not real camera/YouTube/cloud acceptance.

## Production QA, 16 November 2026, isolated synthetic learner

At deployed `5719942`, normal browser UI completed: synthetic PDF extraction,
resume analysis, six keyed MCQ answers, Smart Budget Tracker plan generation,
Dashboard/Learn navigation, and one real Mentor reply. Four AI actions ran once
within the finite approved budget. This records working integration, not a
claim that generated content was correct. No extra AI calls verified the later
prompt changes. Actual token usage and rupee cost were not exposed by the app.

Save/logout/relogin via normal forms restored the project, six raw answers,
unverified-resume provenance and four-hours-per-week text from cloud memory
(HTTP 200 read). No daily time window was invented. No previous user recovery
copy was cleared or reset.

The initial authenticated three-way-sign coding submission returned HTTP 502
at about 40 seconds. Its response body/headers were not captured. No failed
learner evidence was saved. Root cause remains unknown; runner fail-closed
changes are not a demonstrated fix for that transient failure.

One subsequent normal Learn submission returned HTTP 200 in 1.97 seconds.
It exposed a genuine coverage defect: `n >= 0` passed the old positive/negative
checks for "Positive or not" because zero was missing. The synthetic QA event
remains a pass of the old finite two-case set, not proof of a correct algorithm.
Zero is now an authored hidden case in C and Python. Local executable reference
and boundary-mutant regressions verify positive, negative and zero. Post-fix
production UI wrong/fixed checks remain pending at this entry.

The generated Q6 stem said:

```
This check always says 'too expensive' even for small amounts. Why?

price = input('Price: ')
if price > 100:
    print('too expensive')
```

Its keyed explanation correctly identified a Python 3 `TypeError`, contradicting
the claimed output. A narrow structural/phrase check excludes this known class
from new banks and derived competency while retaining raw saved history. It is
not a general semantic validator or code execution. Caught exceptions, explicit
conversion, and neutral "what happens" questions are not treated as this defect.

Generated plan prose also claimed the learner's gap was writing practice, "not
understanding", without successful coding evidence. Mentor's sidebar no longer
uses generated plan insights as assessment facts, including for existing saved
plans. New plan insights are source-grounded summaries. Mentor context names
its sources, and the prompt distinguishes provisional AI-keyed MCQ from actual
finite execution. No new real-model run has verified that prompt change.

### Quality deployment follow-up

`de46867610ec6dc4b406731a2039175d05e076cd` verified live. One normal UI
wrong-boundary submission returned HTTP 502, measured by browser resource timing
at 19.487 seconds (not the longer selector wait). The planned corrected solution
then returned HTTP 200 in 3.758 seconds and all three finite checks passed.
Thus the correct path has real production execution evidence, but live rejection
of the wrong boundary remained unverified in this bounded run. The original
502 cause remains unknown; no response body or headers were captured.

### New two-question calibration and timed support behavior

New diagnostics use `short-v2`, exactly two structurally validated questions.
Legacy six-question diagnostics retain their prior format and restore behavior.
Practical checks follow calibration and start from an explicitly estimated level,
not a verified-skill label. No additional provider AI runs were made after the
four-action approved budget. The new prompt's actual generated quality has not
been verified with a fresh model call.

A transfer task now starts a pausable browser-interaction clock. It excludes
blurred, hidden, paused and >30-second editing-idle windows. Strictly exceeding
the authored eight-minute benchmark switches to a basic same-concept task.
This saves an ungraded support event and the original draft/hint state in the
existing account-bound profile. It never creates a failure or lowers competency.
There is no measured population-average claim. An already-basic task has no
simpler authored level to switch to. Other language/framework tasks remain
unassessed rather than fabricated.

The persisted support event feeds the existing Dashboard summary, Struggle DNA,
Learn topic priority and Mentor context. Prior results remain intact. Unit tests
verify the exact threshold, preserved drafts/history, zero fabricated evidence,
new two-question bank guards and legacy validation. An actual-component browser
fixture uses explicit fake auth/cloud/AI and virtual focused editing time to
verify the automatic switch, restore, Dashboard/Learn context and absence of
fake submissions. The ordinary actual-component local-Python handler journey
also passes with two calibration answers. These are local fixture checks, not
live learner or real-model acceptance of the new flow.

### Production boundary regression closed at `44572f5`

Verified the actual browser `/api/app-version` returns
`44572f567d854f9c739a55aa3b0ef9335ed69adf`. Two bounded normal Learn UI
submissions on the isolated synthetic account, without AI or state injection:

- Wrong `n >= 0`: HTTP 200 in 1.7467 seconds. Positive and negative cases passed;
  zero failed with expected `not positive`, actual `positive`. The faulty
  boundary was rejected by actual production execution.
- Correct `n > 0`: HTTP 200 in 1.8682 seconds; all three output checks passed.

Screenshots captured both real UI outcomes. These close the specific zero-case
regression and verify this finite execution path, not general algorithm mastery,
runner reliability, or the root cause of the earlier transient 502 responses.
No paid AI calls were repeated. The newly shortened real-model calibration and
its generated content remain untested against a fresh provider call. Local
component fixtures verify the new two-question and automatic-support behavior.

### Actual signed-in camera-free YouTube and checkpoint cloud read

At `12e544a`, the isolated synthetic learner used normal Learn UI to open the
Python conditions video `FvMPfrgGeKs`, selecting "Learn without camera".
Normal real-time playback, without seeking or fixture state, paused at the first
120-second section. The caption-based question asked how code under `if` should
be written. Selecting "Indented" saved completed section `[1]`, one correct
`self_reported` result and the real QA owner ID. Watching was not promoted to
practical coding mastery. Actual screenshots show the player and question.

A normal Stop, Dashboard, logout and relogin then revealed a same-tab recovery
problem: UI showed "Protect local progress" with `loop.recovery.owner=unbound`
although `loop.state.uid` and auth matched the same QA owner. No recovery copy
was cleared, discarded or reset. Cause not established at this entry.

A separate read-only browser session, loaded from the existing saved QA profile,
read the real cloud learner row (HTTP 200), restored completed `[1]` and the
correct self-reported result, with matching owner and no recovery flag. Normal
Learn UI then displayed "1 of 5 sections completed". This proves actual
checkpoint cloud persistence and fresh-profile restoration while preserving the
same-tab recovery defect as a separate unresolved blocker. Both playback and
fresh restore are real, not mocked; physical camera absence remains unverified.

### Logout/restore boundary hardening (not a claimed live-gate root cause)

Deterministic tests execute the actual auth module with deferred provider
promises. At the prior version, three schedules failed: an old `getSession`
resolved after completed logout and resurrected auth; an old same-UID read
replaced a newer login token; a new login during remote logout was lost. The
patched auth module passes these schedules plus normal refresh and duplicate
active-sign-in controls. Ownership epochs now invalidate old reads, while remote
logout completion cannot wipe a newer accepted login.

The actual CloudSync component is also executed with controlled effect and read
boundaries. Four prior failures are blocked: same-UID ownership-epoch change,
recovery appearing during the read, removal of the cache owner during the read,
and a stale rendered UID running after immediate auth revocation. Ordinary
same-owner restoration still applies. Epoch/owner/pending guards also protect
scheduled autosave dispatch. Both new suites are part of `npm test` (355 passing
checks), with typecheck/build passing and no changed-file lint errors.

A real-component local browser harness with mocked Supabase auth/cloud returns
7/7 controls, including normal logout/relogin, a delayed refresh, markerless
unknown-owner recovery, and the deliberately seeded matching-marker/unbound
state staying blocked. These are local mocked controls, not production evidence.
The actual QA gate's creation sequence remains unresolved. Read-only probe
history contains no localStorage writes. Normal production logout had visibly
returned to the home sign-in page. No recovery guard has been relaxed, no pending
flag auto-cleared, and no protected local copy exported or discarded.

### Confirmed multi-tab logout/relogin cause and fix

The ordinary production same-tab flow reproduced again after epoch hardening.
Discovering inherited Learn tabs exposed the missing condition: Supabase
broadcasts authentication between tabs, but each tab retains its own in-memory
learner cache. A controlled two-tab real-app browser reproduction captured the
second Learn tab's SIGNED_IN broadcast writing `pending=unbound` from stale
in-memory learner work while the first tab had already cleared shared storage.
The first tab then claimed the owner marker, reproducing matching owner plus
unbound pending. One-tab and reload-only tests had missed this condition.

Auth SIGNED_IN/SIGNED_OUT now refresh each tab's cache read-only from shared
persisted storage before publishing the auth change. It never clears a pending
copy, reassigns ownership or writes learner data. Failed persistence marks the
only-memory copy dirty; that tab refuses cache refresh and auth/API access,
leaves other tabs' shared auth untouched, and shows a specific "Keep this tab
open" notice. No blind retry overwrites another account's shared cache.

The local two-tab normal UI password-signin reproduction passes in both dev and
minified production builds. Unknown-owner and seeded stale-pending controls
still block. A simulated quota failure visibly shows the dedicated notice and
retains the memory copy without restoring account/cloud authority. These local
checks are distinct from the following live-deployment acceptance.

## 2026-11-16: actual cross-tab restore and typed pairing release

Production89d7ad: normal two-tab logout and same-tab sign-in restored actual QA cloud observation count4 and Conditions checkpoint1. After full hydration, actual Learn UI showed1of5 sections complete. Camera-free playback was stopped immediately; no new question or paid AI. Earlier pre-hydration observation was transient, not proven data loss. Existing blocked pending copies remain untouched.

Pairing0.3.11: authenticated website issues an eight-character five-minute single-use code; matching extension claims it then keeps returned credentials in SecretStorage. Code hash only in additive database table, encrypted token, atomic DELETE claim, owner/token recheck. Best-effort per-instance rate limiting is not a global security boundary. No launcher/folder dependency for code issuance; project inspection consent remains separate. Display BML session IDs are not connection credentials.

Validation:362appunit tests;36extension tests (unactivated Node prep excluded); both TypeScript checks; production build; actual router mocked-I/O integration verifies unauth/wrong-owner/wrong-token rejection, single race winner/replay, display ID rejection and returned-token connection. Local browser pixels inspected for code card and download page; synthetic fixtures only, not live DB or laptop acceptance.

Deployment caveat: reviewed additive supabase-session-pairing.sql still awaits administrator execution on correct project. Missing table fails closed with503, without issuing a fake usable code. Do not call live OTP accepted until real create/claim/replay checks pass after migration. User installed0.3.3 requires0.3.11install and Reload Window. No physical laptop/keychain/camera acceptance claimed.
