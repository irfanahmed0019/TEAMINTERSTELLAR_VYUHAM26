## 0.3.8

- Choose an actual multi-function Python module and its own existing literal test file. Inspect only one standalone int(value) or int(value.strip()) baseline. Other module/test code is never imported or executed.
- Repair assignment requires 2-32 matching literal assertions and an actual failing baseline. Already-passing and unsupported contexts get no invented repair task.
- Exact source snippet, test path/digest, approved cases, skipped count and baseline failures are reviewed before sharing. Test digest is pinned and checked on every evaluation.
- Selected corrected function uses a strict bounded grammar with no loops, imports, arbitrary calls or dependency resolution. Dedicated decimal contract and approved project cases remain extension-reported evidence, not server grading or general mastery.

## 0.3.7

- Opt-in source-grounded Python challenge for a supported existing standalone int(value) function only. Exact snippet review happens before task selection.
- Dedicated 14-case evaluator checks signed decimal conversion and invalid-input handling. Only the chosen function AST runs, not the whole module. Local execution still needs workspace trust and exact-command consent.
- Unsupported projects receive an explicit unsupported result, not a generic task presented as project-specific.

## 0.3.6

- Pair sessions using a scoped credential kept in VS Code SecretStorage. Short display codes alone no longer authorize access. Install, reload VS Code and start a new session on the signed-in website. Existing saved learner history stays intact.
- Ask before sharing manifest names, diagnostics and bounded foreground activity estimates. Heartbeats are not work time; source uploads still ask separately.
- Successful partial checkpoints no longer count as failed tests. Compile/start success is detected-only; requirement completion needs a declared checkpoint-specific command, evaluator ID and expected assertions and remains extension-reported.
- Missing AI project review returns no score rather than a made-up score.
- Project manifests establish only bounded context. Existing missions are not claimed to be generated from the project.

# 0.3.5

- Setup install commands and probes are platform-parameterised and covered by tests: Windows winget/Python/Git/MSYS2, macOS Xcode tools with and without Homebrew, apt/dnf/pacman/zypper, and a manual note fallback for unknown Linux package managers.
- The MSYS2 note now says gcc is not on the Windows PATH until C:\msys64\ucrt64\bin is added, so the C compiler can still show missing after MSYS2 installs.
- Tests prove Python 2 is never accepted as Python 3 through the real probe path.

# 0.3.4

- OS-aware computer setup: the sidebar detects Windows, macOS or Linux (and the Linux package manager) and checks Python 3, Git and a C compiler with read-only version probes when the sidebar opens and after each session connect.
- New Setup tab shows the exact install command for each missing tool on your OS, with an "Install packages" button that runs it in a visible VS Code terminal only after you confirm the exact command. Nothing installs silently.

# 0.3.3

- Receive owner-saved website conquest receipts for the connected session.
- Show one durable-deduped website recovery notification per pattern, with a Failure Replay link.
- Keep original project checkpoints separate from changed-task recovery.

# 0.3.2

- Stop the whole local command process tree on timeout and bound captured output.
- Ignore stale async results after disconnect or switching sessions.
- Show network reconnect status honestly and recover the connected badge.
- Keep failed session connections on the configured website, with no cross-host fallback.

# Change Log

All notable changes to the "logic-analyser" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## 0.2.2

- Remedial practice tasks are now framed as mini projects (clear goal plus what the tests check, hints stay progressive). Concept-matched teaching videos verified against their actual captions are attached to the matching remedials (scanf, type casting, quotient/remainder, operators) and shown on the Resources tab under "For the current practice task" when a remedial is active. Videos open externally; embed/region availability is not guaranteed by the extension.

## 0.2.1

- Results are now attributed: the results card is titled "Results for <task title> (<exercise id>)" and clears when the current task changes, so old results can no longer look like the new task passed. A passed submit also raises a confirmation notification. Revision tasks moved off the Learning tab into the Progress tab (still clickable to work on them), so the current question stays above the fold.

## 0.2.0

- Task-first layout from the user's reference design: Learning tab (default) with the project card and real milestone progress, the current task with its requirements, Run Tests (trial) and Submit for grading, real per-test results, and a hint card with navigation through the hints you actually received. Chat, Progress and Resources are separate tabs. The task question box and quick actions (Explain this error, Give me a hint, Why does this work, Show example) sit on the Learning tab. Graded failures raise a BuildMyLogic Suggestion notification with the real feedback. All numbers come from the persisted learning state or real runs - no sample data.

## 0.1.2

- Fixes remedial and revision exercises never resolving ("No active exercise"): the curriculum lookup matched remedials by misconception key instead of exercise id (rem-...). Revision tasks and targeted exercises now open correctly.
- The monitoring status no longer says "Not connected" when the connection is fine but the exercise cannot resolve; it says so and suggests Refresh.

## 0.1.1

- Mentor connect now reports honestly: the bridge answers 200 only after the token is verifiably stored in VS Code SecretStorage. When the OS keyring is unavailable, hung, or drops the write, the website gets a sanitized 503 with recovery guidance instead of a false success, and the extension shows no connected state.

## 0.1.0

- Adds the learning watcher: while the AI Mentor is connected, saves and compiler diagnostics of the current exercise's own file sync to the website (POST /api/mentor/activity), debounced and rate-limited. Only the exercise file is watched, never unrelated files. The sidebar shows an honest monitoring status, including when the website has not deployed activity sync yet.

## 0.0.9

- Adds the AI Mentor sidebar: milestones from the real learning roadmap, the current task with its real test inputs, trial runs on the Judge0 sandbox, graded submissions that update the persisted learning record, progressive hints, revision tasks, competency evidence and task-aware mentor chat.
- Mentor sign-in is delivered by the signed-in website through the local bridge as a mentor-scoped, revocable token (bmlx_...), stored in VS Code SecretStorage. No token is pasted, logged or written to settings.
- Existing challenge sessions, the local folder bridge and heartbeats are unchanged.

## [0.0.7] - 2026-10-22

- The extension now hosts the local desktop bridge itself (http://127.0.0.1:8091),
  so the website's Open VS Code and project-folder picker work without running
  the web repo's `npm run dev`.
- Opening a folder from the website asks for confirmation inside VS Code, and a
  session connect survives the window reload that follows a folder change.
- Bridge requests are limited to the BuildMyLogic websites and localhost, with a
  Host-header check against DNS rebinding.

## [Unreleased]

- Initial release

## 0.2.4
- Add "Diagnose & reassess on website" to the connected challenge panel.
- The handoff carries the exact session ID. The website recovers recorded test attempts once, asks a prediction probe, and runs supported C/Python transfer tasks with real grading.
- Framework/project failures without a concept-specific executable specification stay locked. An exit-zero command is not proof of a new relevant reassessment.

## 0.3.1 - Independent four-tab workspace UI

- Mission, Progress, Mentor and Recovery tabs, styled from the requested references.
- Native bottom BuildMyLogic results view with published checkpoint states and actual command output.
- Progress is scoped to the connected session, not an invented global skill score.
- Recovery distinguishes observed repeated failures from a confirmed cause; owner-verified changed-task recovery remains on the website.
- Mentor tab uses existing session feedback and links to the existing authenticated Mentor. No seeded chat or paid-AI bypass.
- Independent current-repository implementation, not Aromal's separate unshared build.
