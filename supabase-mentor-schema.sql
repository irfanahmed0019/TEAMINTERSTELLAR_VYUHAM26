-- AI Mentor (AF-05) persistence. Additive and isolated: only creates new mentor_* tables
-- with per-owner RLS. Does not touch learner_memory, learning_sessions or any existing table.
-- Rollback: drop table mentor_events, mentor_revisions, mentor_misconceptions, mentor_competencies, mentor_submissions, mentor_sessions cascade;

create table if not exists public.mentor_sessions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null, language text not null, level text not null,
  roadmap jsonb not null, state jsonb not null,
  current_lesson_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.mentor_submissions (
  id text primary key,
  session_id text not null references public.mentor_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id text not null, exercise_id text not null, mode text not null, code text not null,
  test_results jsonb not null, assessment jsonb, hints_used int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.mentor_competencies (
  session_id text not null references public.mentor_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  skill text not null, level text not null, confirmed boolean not null default false,
  practice_passes int not null default 0, independent_passes int not null default 0, failures int not null default 0, revision_passes int not null default 0,
  updated_at timestamptz not null default now(), primary key (session_id, skill)
);
create table if not exists public.mentor_misconceptions (
  session_id text not null references public.mentor_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  misconception_id text not null, concept text not null, occurrences int not null default 1, status text not null, evidence text,
  first_seen timestamptz, last_seen timestamptz, primary key (session_id, misconception_id)
);
create table if not exists public.mentor_revisions (
  id text primary key,
  session_id text not null references public.mentor_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  skill text not null, concept text not null, exercise_id text not null, lesson_id text not null, misconception_id text,
  stage int not null default 0, status text not null default 'scheduled', reason text, due_at timestamptz not null, completed_at timestamptz
);
create table if not exists public.mentor_events (
  id bigint generated always as identity primary key,
  session_id text not null references public.mentor_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type text not null, detail text, created_at timestamptz not null default now()
);
create index if not exists mentor_sessions_user on public.mentor_sessions(user_id, updated_at desc);
create index if not exists mentor_revisions_due on public.mentor_revisions(user_id, status, due_at);

alter table public.mentor_sessions enable row level security;
alter table public.mentor_submissions enable row level security;
alter table public.mentor_competencies enable row level security;
alter table public.mentor_misconceptions enable row level security;
alter table public.mentor_revisions enable row level security;
alter table public.mentor_events enable row level security;

do $$ declare t text; begin
  foreach t in array array['mentor_sessions','mentor_submissions','mentor_competencies','mentor_misconceptions','mentor_revisions','mentor_events'] loop
    execute format('drop policy if exists "owner all" on public.%I', t);
    execute format('create policy "owner all" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
