-- WS by PHN: accounts, saved projects (with trash) and work-session log.
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- Login, registration and password reset are handled by Supabase Auth (auth.users).

------------------------------------------------------------------------------
-- profiles: one row per account, holds role and display name
------------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  role         text not null default 'user' check (role in ('user', 'admin')),
  created_at   timestamptz not null default now()
);

-- Create the profile automatically when someone registers.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Used by RLS policies. security definer so it can read profiles without recursion.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

------------------------------------------------------------------------------
-- projects: what users saved. deleted_at is NULL while active, set = in trash.
------------------------------------------------------------------------------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null default '',
  puzzle_type text not null check (puzzle_type in ('ws', 'scramble')),
  state       jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint projects_state_is_object check (jsonb_typeof(state) = 'object'),
  constraint projects_state_size check (pg_column_size(state) <= 1048576)
);

create index projects_owner_idx
  on public.projects (owner_id, deleted_at, updated_at desc);

-- Only bump updated_at when content changes, not on delete/restore.
create function public.projects_touch()
returns trigger
language plpgsql
as $$
begin
  if new.name is distinct from old.name or new.state is distinct from old.state then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

create trigger projects_touch
  before update on public.projects
  for each row execute function public.projects_touch();

------------------------------------------------------------------------------
-- work_sessions: one row per visit, guests included. Only admins can read.
-- Writes go through the functions below, so a guest can log a session
-- without being able to read or edit anyone else's.
------------------------------------------------------------------------------
create table public.work_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles (id) on delete set null,
  started_as_guest boolean not null,
  started_at       timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  ended_at         timestamptz,
  user_agent       text,
  summary          jsonb not null default '{}'::jsonb,
  constraint work_sessions_summary_is_object check (jsonb_typeof(summary) = 'object'),
  constraint work_sessions_summary_size check (pg_column_size(summary) <= 4096)
);

create index work_sessions_started_idx on public.work_sessions (started_at desc);
create index work_sessions_user_idx on public.work_sessions (user_id, started_at desc);

-- Begin a session. Works for guests (auth.uid() is NULL) and signed-in users.
create function public.start_session(p_user_agent text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.work_sessions (user_id, started_as_guest, user_agent)
  values (auth.uid(), auth.uid() is null, left(p_user_agent, 300))
  returning id into v_id;
  return v_id;
end;
$$;

-- Heartbeat / finish. If a guest signs in mid-session the row is attached to them.
-- The session id is an unguessable uuid, which acts as the capability to update it.
create function public.touch_session(
  p_id      uuid,
  p_summary jsonb   default null,
  p_end     boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.work_sessions
     set last_seen_at = now(),
         summary      = coalesce(p_summary, summary),
         user_id      = coalesce(user_id, auth.uid()),
         ended_at     = case when p_end then now() else ended_at end
   where id = p_id
     and ended_at is null;
end;
$$;

-- Promote or demote an account. Admins only.
create function public.set_user_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_role not in ('user', 'admin') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  update public.profiles set role = p_role where id = p_user;
end;
$$;

------------------------------------------------------------------------------
-- Row level security
------------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.projects      enable row level security;
alter table public.work_sessions enable row level security;

-- profiles: read your own (admins read all); edit only your display name.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- projects: owners manage their own; admins can read everything.
create policy projects_select on public.projects
  for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

create policy projects_insert on public.projects
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy projects_update on public.projects
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Permanent delete is only allowed for items already in the trash.
create policy projects_delete on public.projects
  for delete to authenticated
  using (owner_id = auth.uid() and deleted_at is not null);

-- work_sessions: admins read; nobody writes directly (use the functions).
create policy work_sessions_select on public.work_sessions
  for select to authenticated
  using (public.is_admin());

revoke all on public.work_sessions from anon, authenticated;
grant select on public.work_sessions to authenticated;

-- Guests have no table access at all.
revoke all on public.profiles from anon;
revoke all on public.projects from anon;

------------------------------------------------------------------------------
-- Function privileges
------------------------------------------------------------------------------
revoke execute on function public.handle_new_user()                    from public, anon, authenticated;
revoke execute on function public.is_admin()                           from public, anon;
revoke execute on function public.set_user_role(uuid, text)            from public, anon;
revoke execute on function public.start_session(text)                  from public;
revoke execute on function public.touch_session(uuid, jsonb, boolean)  from public;

grant execute on function public.is_admin()                           to authenticated;
grant execute on function public.set_user_role(uuid, text)            to authenticated;
grant execute on function public.start_session(text)                  to anon, authenticated;
grant execute on function public.touch_session(uuid, jsonb, boolean)  to anon, authenticated;
