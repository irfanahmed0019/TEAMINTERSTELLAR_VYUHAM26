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
