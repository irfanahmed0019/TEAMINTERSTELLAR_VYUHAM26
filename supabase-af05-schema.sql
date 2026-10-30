-- ==============================================================================
-- BuildMyLogic AF-05 optional normalized schema (NOT REQUIRED for the MVP).
-- The running app persists the AF-05 adaptive-learning state inside the
-- existing learner_memory JSONB record, so no migration is needed. Apply this
-- only if/when normalized analytics over competencies are wanted.
-- Safe to run: it only creates new tables with per-owner RLS.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.af05_competencies (
    user_id TEXT NOT NULL,
    skill TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'not_assessed',
    score INT NOT NULL DEFAULT 0,
    practical_passes INT NOT NULL DEFAULT 0,
    reassessment_passes INT NOT NULL DEFAULT 0,
    last_assessed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, skill)
);

CREATE TABLE IF NOT EXISTS public.af05_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    skill TEXT NOT NULL,
    kind TEXT NOT NULL,
    summary TEXT NOT NULL,
    weight INT NOT NULL DEFAULT 0,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_af05_evidence_user ON public.af05_evidence(user_id, skill);

CREATE TABLE IF NOT EXISTS public.af05_misconceptions (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    skill TEXT NOT NULL,
    label TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    count INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    first_seen_at TIMESTAMPTZ DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.af05_revisions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    skill TEXT NOT NULL,
    concept TEXT NOT NULL,
    misconception_id TEXT,
    stage INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'scheduled',
    due_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_af05_revisions_due ON public.af05_revisions(user_id, status, due_at);

CREATE TABLE IF NOT EXISTS public.af05_agent_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    decision_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.af05_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.af05_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.af05_misconceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.af05_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.af05_agent_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner owns af05 competencies" ON public.af05_competencies FOR ALL TO authenticated
  USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "learner owns af05 evidence" ON public.af05_evidence FOR ALL TO authenticated
  USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "learner owns af05 misconceptions" ON public.af05_misconceptions FOR ALL TO authenticated
  USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "learner owns af05 revisions" ON public.af05_revisions FOR ALL TO authenticated
  USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "learner owns af05 decisions" ON public.af05_agent_decisions FOR ALL TO authenticated
  USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

-- ============================================================
-- DEPLOYMENT ISOLATION (Option B) - optional, additive, reversible.
-- Run ONLY if the hackathon deployment needs cross-device persistence.
-- Creates a separate learner-state table for the new deployment so it can
-- never touch the production learner_memory rows. Rollback: DROP TABLE.
-- Set VITE_LEARNER_TABLE=learner_memory_vyuham26 in the new deployment's env.
-- ============================================================
create table if not exists public.learner_memory_vyuham26 (
  user_id text primary key,
  state_json jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.learner_memory_vyuham26 enable row level security;
create policy "owner read" on public.learner_memory_vyuham26
  for select using (user_id = auth.uid()::text);
create policy "owner write" on public.learner_memory_vyuham26
  for insert with check (user_id = auth.uid()::text);
create policy "owner update" on public.learner_memory_vyuham26
  for update using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
