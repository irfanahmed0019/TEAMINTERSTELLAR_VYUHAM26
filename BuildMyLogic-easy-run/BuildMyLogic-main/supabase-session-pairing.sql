-- BuildMyLogic short-lived extension pairing. Additive; no existing table/data changes.
-- Apply only to the same Supabase project used by buildmylogicxyz.vercel.app.
create table if not exists public.session_pairing_codes (
  code_hash text primary key check (code_hash ~ '^[a-f0-9]{64}$'),
  session_id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_cipher text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint session_pairing_codes_ttl check (expires_at > created_at and expires_at <= created_at + interval '10 minutes')
);
alter table public.session_pairing_codes enable row level security;
revoke all on public.session_pairing_codes from public, anon, authenticated;
grant select, insert, delete on public.session_pairing_codes to service_role;
create index if not exists session_pairing_codes_expiry_idx on public.session_pairing_codes(expires_at);
-- No browser/client policies. Only the server service role accesses the table.
-- Codes are SHA256 hashes; connection tokens are AES-256-GCM encrypted server-side.
-- Atomic DELETE with hash + unexpired predicate and return=representation consumes a code.
-- Expired rows are never claimable. Maintenance can delete expired rows separately.
