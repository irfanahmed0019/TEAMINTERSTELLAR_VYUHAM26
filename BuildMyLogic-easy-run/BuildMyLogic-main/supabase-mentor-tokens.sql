-- Scoped VS Code extension tokens for the AI Mentor. Additive and isolated:
-- one new table, per-owner read-only RLS. The server writes with the service
-- role and stores only SHA-256(token); the plaintext is shown to the owner once.
-- Rollback: drop table public.mentor_tokens;

create table if not exists public.mentor_tokens (
  token_hash text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

alter table public.mentor_tokens enable row level security;

drop policy if exists "owner read" on public.mentor_tokens;
create policy "owner read" on public.mentor_tokens for select using (auth.uid() = user_id);
