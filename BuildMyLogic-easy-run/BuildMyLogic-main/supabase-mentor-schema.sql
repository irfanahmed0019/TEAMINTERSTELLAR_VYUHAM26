-- ==============================================================================
-- BuildMyLogic AI Mentor schema for Supabase
-- ==============================================================================
-- Extracted from the live production database (project olayuljqahdokttrynvj)
-- on 31 Oct 2026 via information_schema, pg_constraint, pg_policies and
-- pg_class. Structure, indexes and RLS policies only: no data and no secret
-- values are included.
--
-- Apply AFTER supabase-schema.sql and supabase-learning-sessions.sql.
-- Order matters: mentor_sessions first, then the tables that reference it.
-- This file replaces the older supabase-mentor-tokens.sql, which creates ONLY
-- mentor_tokens and is not sufficient on its own.
--
-- The mentor_events table is required by the current append-only activity
-- persistence; deployments before this table exists will fail activity saves.

-- 1. Mentor sessions (root row per learner roadmap run)
create table if not exists public.mentor_sessions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  language text not null,
  level text not null,
  roadmap jsonb not null,
  state jsonb not null,
  current_lesson_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Graded submissions per exercise
create table if not exists public.mentor_submissions (
  id text primary key,
  session_id text not null references public.mentor_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id text not null,
  exercise_id text not null,
  mode text not null,
  code text not null,
  test_results jsonb not null,
  assessment jsonb,
  hints_used integer not null default 0,
  created_at timestamptz not null default now()
);

-- 3. Per-skill competency counters
create table if not exists public.mentor_competencies (
  session_id text not null references public.mentor_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  skill text not null,
  level text not null,
  confirmed boolean not null default false,
  practice_passes integer not null default 0,
  independent_passes integer not null default 0,
  failures integer not null default 0,
  revision_passes integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (session_id, skill)
);

-- 4. Tracked misconceptions
create table if not exists public.mentor_misconceptions (
  session_id text not null references public.mentor_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  misconception_id text not null,
  concept text not null,
  occurrences integer not null default 1,
  status text not null,
  evidence text,
  first_seen timestamptz,
  last_seen timestamptz,
  primary key (session_id, misconception_id)
);

-- 5. Spaced-repetition revisions
create table if not exists public.mentor_revisions (
  id text primary key,
  session_id text not null references public.mentor_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  skill text not null,
  concept text not null,
  exercise_id text not null,
  lesson_id text not null,
  misconception_id text,
  stage integer not null default 0,
  status text not null default 'scheduled',
  reason text,
  due_at timestamptz not null,
  completed_at timestamptz
);

-- 6. Append-only activity / update events (identity id)
create table if not exists public.mentor_events (
  id bigint generated always as identity primary key,
  session_id text not null references public.mentor_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type text not null,
  detail text,
  created_at timestamptz not null default now()
);

-- 7. Scoped VS Code extension tokens (identical to supabase-mentor-tokens.sql)
create table if not exists public.mentor_tokens (
  token_hash text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

-- 8. Server-internal nonce store (not referenced by the app code in this repo;
--    present in production, included for schema parity)
create table if not exists public.mentor_nonces (
  nonce text primary key,
  created_at timestamptz not null default now()
);

-- 9. Server-internal shared secret, exactly one row (id = 1). Not referenced by
--    the app code in this repo. This file intentionally contains NO secret
--    value: if a deployment needs this row, insert it with the service role.
create table if not exists public.mentor_secret (
  id smallint not null default 1 primary key check (id = 1),
  secret text not null,
  created_at timestamptz not null default now()
);

-- Indexes (as deployed)
create index if not exists mentor_sessions_user on public.mentor_sessions (user_id, updated_at desc);
create index if not exists mentor_revisions_due on public.mentor_revisions (user_id, status, due_at);

-- Row level security: enabled on every mentor table.
alter table public.mentor_sessions enable row level security;
alter table public.mentor_submissions enable row level security;
alter table public.mentor_competencies enable row level security;
alter table public.mentor_misconceptions enable row level security;
alter table public.mentor_revisions enable row level security;
alter table public.mentor_events enable row level security;
alter table public.mentor_tokens enable row level security;
alter table public.mentor_nonces enable row level security;
alter table public.mentor_secret enable row level security;

-- Owner read-only policies (server writes with the service role).
drop policy if exists "owner read" on public.mentor_sessions;
create policy "owner read" on public.mentor_sessions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "owner read" on public.mentor_submissions;
create policy "owner read" on public.mentor_submissions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "owner read" on public.mentor_competencies;
create policy "owner read" on public.mentor_competencies for select to authenticated using (auth.uid() = user_id);
drop policy if exists "owner read" on public.mentor_misconceptions;
create policy "owner read" on public.mentor_misconceptions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "owner read" on public.mentor_revisions;
create policy "owner read" on public.mentor_revisions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "owner read" on public.mentor_events;
create policy "owner read" on public.mentor_events for select to authenticated using (auth.uid() = user_id);
drop policy if exists "owner read" on public.mentor_tokens;
create policy "owner read" on public.mentor_tokens for select using (auth.uid() = user_id);

-- mentor_nonces and mentor_secret have NO policies: with RLS enabled and no
-- policy, only the service role can reach them. That is the production state.
