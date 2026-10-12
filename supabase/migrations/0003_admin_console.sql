-- Admin console: see users' active projects (never their trash), approve password resets,
-- edit account details. Every admin action is a function that re-checks the caller's role.

------------------------------------------------------------------------------
-- 1. Admins read other people's active projects, but not their trash
------------------------------------------------------------------------------
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (owner_id = auth.uid() or (public.is_admin() and deleted_at is null));

------------------------------------------------------------------------------
-- 2. Accounts that must pick a new password after an admin reset
------------------------------------------------------------------------------
alter table public.profiles add column if not exists must_change_password boolean not null default false;

create function public.clear_must_change_password()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

------------------------------------------------------------------------------
-- 3. Password reset requests, decided by an admin
------------------------------------------------------------------------------
create table public.password_reset_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  email        text not null,
  requested_at timestamptz not null default now(),
  user_agent   text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  handled_by   uuid references public.profiles (id) on delete set null,
  handled_at   timestamptz
);

create index password_reset_requests_status_idx on public.password_reset_requests (status, requested_at desc);

alter table public.password_reset_requests enable row level security;

create policy password_reset_requests_select on public.password_reset_requests
  for select to authenticated
  using (public.is_admin());

revoke all on public.password_reset_requests from anon, authenticated;
grant select on public.password_reset_requests to authenticated;

-- Anyone may ask, signed in or not. The answer is always the same, so the form cannot be used to
-- find out which emails have an account. One open request per account; at most 5 an hour.
create function public.request_password_reset(p_email text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.profiles;
begin
  select * into v_user from public.profiles where lower(email) = lower(btrim(p_email));
  if not found then
    return;
  end if;
  if exists (select 1 from public.password_reset_requests where user_id = v_user.id and status = 'pending') then
    return;
  end if;
  if (select count(*) from public.password_reset_requests
       where user_id = v_user.id and requested_at > now() - interval '1 hour') >= 5 then
    return;
  end if;
  insert into public.password_reset_requests (user_id, email, user_agent)
  values (v_user.id, v_user.email, left(p_user_agent, 300));
end;
$$;

-- Approve: the password becomes the default, every session of the account is ended, and the account
-- is flagged so the app asks for a new password at the next sign-in.
create function public.admin_reset_password(p_request uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.password_reset_requests;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select * into v_req from public.password_reset_requests where id = p_request for update;
  if not found or v_req.status <> 'pending' then
    raise exception 'request is no longer pending' using errcode = '22023';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt('123456', extensions.gen_salt('bf')),
         updated_at = now()
   where id = v_req.user_id;
  delete from auth.sessions where user_id = v_req.user_id;
  update public.profiles set must_change_password = true where id = v_req.user_id;
  update public.password_reset_requests
     set status = 'approved', handled_by = auth.uid(), handled_at = now()
   where id = p_request;
end;
$$;

create function public.admin_dismiss_request(p_request uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update public.password_reset_requests
     set status = 'dismissed', handled_by = auth.uid(), handled_at = now()
   where id = p_request and status = 'pending';
end;
$$;

------------------------------------------------------------------------------
-- 4. Edit an account's details
------------------------------------------------------------------------------
create function public.admin_update_user(p_user uuid, p_display_name text, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
  v_name  text := nullif(btrim(p_display_name), '');
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email and id <> p_user) then
    raise exception 'that email is already used by another account' using errcode = '23505';
  end if;

  update auth.users
     set email = v_email,
         updated_at = now(),
         raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{display_name}', to_jsonb(coalesce(v_name, '')))
   where id = p_user;
  update auth.identities
     set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_email))
   where user_id = p_user and provider = 'email';
  update public.profiles set email = v_email, display_name = v_name where id = p_user;
end;
$$;

------------------------------------------------------------------------------
-- 5. One call for the user list: counts and last visit, without the trash
------------------------------------------------------------------------------
create function public.admin_users()
returns table (
  id                   uuid,
  email                text,
  display_name         text,
  role                 text,
  created_at           timestamptz,
  must_change_password boolean,
  project_count        bigint,
  visit_count          bigint,
  last_seen_at         timestamptz,
  last_user_agent      text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
  select p.id, p.email, p.display_name, p.role, p.created_at, p.must_change_password,
         (select count(*) from public.projects pr where pr.owner_id = p.id and pr.deleted_at is null),
         (select count(*) from public.work_sessions s where s.user_id = p.id),
         (select max(s.last_seen_at) from public.work_sessions s where s.user_id = p.id),
         (select s.user_agent from public.work_sessions s where s.user_id = p.id order by s.last_seen_at desc limit 1)
    from public.profiles p
   order by (select max(s.last_seen_at) from public.work_sessions s where s.user_id = p.id) desc nulls last, p.created_at desc;
end;
$$;

------------------------------------------------------------------------------
-- Function privileges
------------------------------------------------------------------------------
revoke execute on function public.clear_must_change_password()              from public, anon;
revoke execute on function public.request_password_reset(text, text)        from public;
revoke execute on function public.admin_reset_password(uuid)                from public, anon;
revoke execute on function public.admin_dismiss_request(uuid)               from public, anon;
revoke execute on function public.admin_update_user(uuid, text, text)       from public, anon;
revoke execute on function public.admin_users()                             from public, anon;

grant execute on function public.clear_must_change_password()               to authenticated;
grant execute on function public.request_password_reset(text, text)         to anon, authenticated;
grant execute on function public.admin_reset_password(uuid)                 to authenticated;
grant execute on function public.admin_dismiss_request(uuid)                to authenticated;
grant execute on function public.admin_update_user(uuid, text, text)       to authenticated;
grant execute on function public.admin_users()                              to authenticated;
