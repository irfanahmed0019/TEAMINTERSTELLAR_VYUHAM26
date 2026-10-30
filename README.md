# Agentic for VS Code

This repository is now a VS Code extension: an approval-first, workspace-aware AI coding agent with a native activity-bar view. The original standalone visual prototype remains at the root as design reference; the runnable extension lives in `src/` and `media/`.

## What works

- Native **Agentic** activity-bar container and `Agentic: Open Chat` command.
- VS Code webview chat with persisted in-memory conversation history and streaming model output.
- OpenAI-compatible chat-completions integration, including function/tool calling.
- Workspace file listing, read, and text search through VS Code's filesystem APIs.
- Explicit in-panel approval before every model-requested file replacement or terminal command.
- Tool status, output, denial, and error reporting in the sidebar.

## Configure the hybrid model backend

Edit [agent-config.txt](agent-config.txt). It is a plain-text, non-secret configuration file. By default it uses Sarvam AI when its compatible API is reachable, then falls back to the local `models/smollm2-135m-instruct.gguf` model. Set `provider=local` or `provider=online` to force one backend.

The local backend uses `node-llama-cpp` (embedded llama.cpp), so it does **not** require a separately started chatbot server. The VSIX bundles the Linux x64 CPU native runtime, but deliberately does **not** contain model weights. Keep the supplied GGUF outside Git and set `local.model_path` to its absolute path after installing the extension, or place it in the opened workspace. The local model is for lightweight offline conversation; Sarvam is used for tool calling.

Set the Sarvam key with **Agentic: Set API Key** in the Command Palette. It is stored in VS Code Secret Storage and must never be added to `agent-config.txt`. The deprecated `agentic.model.apiKey` setting is ignored.

The status line reports `Sarvam AI`, `local GGUF`, or `local GGUF (Sarvam unavailable)`. Sarvam retains the extension's existing streaming tool-call workflow; the small local model provides streamed chat replies but is not relied on for function calling.

## Install, verify, and use

Use desktop VS Code on Linux x64 with glibc and Node.js 20 or newer for development. `node-llama-cpp` installs a platform-native llama.cpp binary during `npm install`; this is a runtime dependency download, not a model download. The produced Linux VSIX includes that binary. macOS and Windows need a VSIX packaged on the matching platform with its corresponding native package; this Linux x64 artifact is not portable to them.

```bash
npm install
npm run compile
npm run verify:local-model
code .
```

`verify:local-model` opens `models/smollm2-135m-instruct.gguf` with the embedded runtime and generates a response. It is the preflight check for a usable GGUF, beyond checking its header.

Then press **F5** and select **Run Agentic Extension**. In the Extension Development Host, open a folder containing `agent-config.txt` and the configured model, choose the Agentic activity-bar icon, then chat. In `provider=auto`, a failed Sarvam readiness check or request switches the current response to the local backend. Use `provider=local` for offline-only chat.

To package after validating it:

```bash
npm run package:linux-x64
```

This produces a Linux x64 VSIX without the `.gguf` model file. Do not add model weights or API keys to Git.

## Safety model

The agent is constrained to the opened workspace for file operations. Its model may ask to replace a file or send a command to a visible integrated terminal, but neither occurs until the user presses **Approve** in the chat panel. Terminal output remains visible in that terminal; commands are never represented as completed output by the agent.

## Agent architecture

`src/viewProvider.ts` owns the native webview bridge. `src/agentEngine.ts` is intentionally UI-independent: it maintains task context, calls the configured model, translates model tool calls into controlled VS Code operations, and waits for approval callbacks. This separation lets you replace the OpenAI-compatible `completion` adapter with another API or local agent runtime without rewriting the interface or permission boundary.

---

# Archived project notes

The following is historical proposal material, not a description of the current VS Code extension.

A collaborative hackathon project exploring a learning agent that personalizes instruction from evidence of what a learner knows, misunderstands, and retains over time.

## Problem statement

### Problem Context

Learners have different levels of prior knowledge, learning pace, and conceptual gaps. Fixed learning materials and uniform assessments may fail to address individual needs or demonstrate lasting mastery.

### Challenge Description

Develop a learning agent that tracks performance, identifies likely misconceptions, adapts explanations and exercises, and schedules revision based on learner progress. Evaluate whether its interventions improve mastery and retention rather than measuring success only through short-term quiz scores.

## Why fixed learning approaches can fail

A fixed sequence can treat all incorrect answers alike, even when they arise from different causes: a missing prerequisite, a specific misconception, a guess, or an unclear question. It can also treat short-term success as mastery without checking whether learning endures or transfers to a new problem.

## Proposed solution

The proposed agent will maintain concept-level evidence for each learner, infer plausible misconceptions with stated uncertainty, select an explanation or exercise suited to the current need, and schedule later checks. Its effectiveness will be evaluated against a fixed learning sequence using immediate, delayed, and transfer assessments.

## Target users and example use cases

- Learners who want practice targeted to a topic they are struggling with.
- Educators who need a transparent summary of progress and likely conceptual gaps.
- Hackathon judges reviewing a reproducible adaptive-versus-fixed learning demonstration.

For example, after a baseline algebra assessment, the agent could flag a likely sign-rule misconception, offer a worked explanation and focused exercises, then schedule a later equivalent problem to check retention.

## Core planned capabilities

- Learner knowledge and progress tracking.
- Likely misconception detection.
- Adaptive explanations.
- Personalized exercise selection.
- Spaced revision scheduling.
- Mastery and long-term retention evaluation.

## Intended learning loop

**Assess → Diagnose → Plan → Teach → Test → Evaluate → Adapt → Schedule Revision**

Each step should retain sufficient evidence to make the next decision understandable and to distinguish a hypothesis from a confirmed conclusion.

## Repository status

This root repository currently contains documentation only. It has no application source, dependency manifest, framework configuration, test suite, environment template, or runnable entry point. All learning-agent functionality described here is planned, not implemented.

## Proposed high-level architecture

The intended component boundaries are described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). At a high level, learner interactions produce assessment events; knowledge and misconception components interpret them; an orchestrator selects an intervention; an explanation or exercise surface delivers it; and scheduling plus analytics evaluate retention. The implementation stack remains an open team decision because the repository provides no technical-stack evidence.

## Existing implementation versus planned work

| Area | Current state |
| --- | --- |
| Project documentation | Implemented in this repository |
| Application, frontend, backend, database, and AI/model integration | Planned |
| Learner assessment and knowledge tracking | Planned |
| Adaptation, misconception detection, and revision scheduling | Planned |
| Evaluation experiment and analytics | Planned |

## Current technology stack

No application technology stack has been established in the root repository. There is no package manifest, lockfile, build configuration, container configuration, or source file from which to infer one. The team should choose a minimal stack after agreeing on the MVP interface and data-handling needs.

## Installation, setup, and running

There is no install or run command yet because no application has been added. When implementation begins, add only verified prerequisites, setup commands, and runnable commands here.

## Configuration and environment variables

No environment variables are currently defined. If a future component needs configuration, commit an `.env.example` containing variable names, purpose, safe placeholders, and whether each is required. Do not commit actual `.env` files, credentials, or learner data.

## Testing

No tests or test runner currently exist. New implementation work should add focused tests alongside the relevant component and update this section with the exact verified command.

## Team collaboration

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the lightweight workflow, [docs/TEAM_TASKS.md](docs/TEAM_TASKS.md) for independently assignable workstreams, and [docs/ROADMAP.md](docs/ROADMAP.md) for delivery stages.

## Evaluation methodology

The central question is whether adaptive interventions improve mastery and long-term retention compared with a fixed-learning approach. The proposed measurement plan is in [docs/EVALUATION.md](docs/EVALUATION.md); it does not claim results before an experiment is run.

## Hackathon MVP scope

The MVP domain is introductory algebraic sign rules. Build one narrow, demonstrable learning flow: a baseline assessment, simple concept-level learner state, at least one transparent adaptation rule, a tailored explanation or exercise, a short post-check, and a scheduled or simulated delayed follow-up. Include a fixed-sequence comparison path and clearly label inference uncertainty. The domain rationale and stack-neutral shared contracts are in [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md).

Authentication, broad curriculum coverage, production-scale data infrastructure, and unsupported claims of learning impact are outside the MVP.

## Limitations and future improvements

Early misconception inferences will be uncertain and depend on item quality and labels. A small hackathon evaluation may not establish generalizable learning effects. Future work can validate item banks, improve accessibility and educator controls, add privacy-preserving data practices, broaden domains, and test retention with larger and more diverse learner samples.
