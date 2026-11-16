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
