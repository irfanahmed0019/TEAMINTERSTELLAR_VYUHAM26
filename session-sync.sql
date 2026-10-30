-- Isolated project sync. No access to existing learner or mentor tables.
create table if not exists public.bml_project_sessions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 project text not null check(length(project) between 1 and 120),
 token_hash text check(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null default (now()+interval '24 hours'),
 paused boolean not null default false,
 snapshot jsonb not null default '{}'::jsonb,
 note text not null default '' check(length(note)<=4000),
 updated_at timestamptz not null default now(),
 connected_at timestamptz
);
alter table public.bml_project_sessions enable row level security;
revoke all on public.bml_project_sessions from anon;
grant select,insert,update,delete on public.bml_project_sessions to authenticated;
create policy bml_sync_owner on public.bml_project_sessions for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create or replace function public.bml_project_sync(sid uuid, credential text, operation text default 'read', data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare s public.bml_project_sessions; begin
 if credential is null or length(credential)<>64 then raise exception 'Invalid connection'; end if;
 select * into s from public.bml_project_sessions where id=sid for update;
 if not found or s.token_hash is null or s.token_hash<>encode(extensions.digest(credential,'sha256'),'hex') or s.expires_at<=now() then raise exception 'Connection expired or revoked'; end if;
 if operation='snapshot' then
  if s.paused then raise exception 'Sync paused on website'; end if;
  if jsonb_typeof(data)<>'object' or octet_length(data::text)>300000 or jsonb_typeof(data->'files')<>'array' or jsonb_array_length(data->'files')>100 then raise exception 'Snapshot exceeds project limits'; end if;
  update public.bml_project_sessions set snapshot=data,updated_at=now(),connected_at=coalesce(connected_at,now()) where id=sid returning * into s;
 elsif operation in ('pause','resume') then
  update public.bml_project_sessions set paused=(operation='pause'),updated_at=now() where id=sid returning * into s;
 elsif operation<>'read' then raise exception 'Unknown operation'; end if;
 return jsonb_build_object('id',s.id,'project',s.project,'paused',s.paused,'note',s.note,'updated_at',s.updated_at,'connected_at',s.connected_at,'snapshot',s.snapshot,'expires_at',s.expires_at);
end $$;
revoke all on function public.bml_project_sync(uuid,text,text,jsonb) from public;
grant execute on function public.bml_project_sync(uuid,text,text,jsonb) to anon,authenticated;
select tablename,rowsecurity from pg_tables where tablename='bml_project_sessions';
