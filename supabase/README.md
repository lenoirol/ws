# Supabase setup

Backend for accounts, saved projects, trash and the work-session log.

## Local development

The whole Supabase stack (PostgreSQL, Auth, API, test mailbox) runs in Docker on your machine.
Open Docker Desktop first, then:

```bash
npm run db:start    # first run downloads images; applies everything in migrations/
npm run db:status   # prints URLs and keys
npm run db:reset    # wipe local data and re-apply migrations
npm run db:stop
```

| What | Address |
|---|---|
| API (what the app talks to) | http://127.0.0.1:54321 |
| Studio (browse tables, users) | http://127.0.0.1:54323 |
| Mailbox (only used if email confirmation is switched on) | http://127.0.0.1:54324 |
| PostgreSQL | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

`.env` already points at the local API. When you move to a real Supabase project, only the two
values in `.env` change; the code stays the same.

[local/auth_shim.sql](local/auth_shim.sql) is only for running the migration on a plain PostgreSQL
server without Supabase. You do not need it with the commands above.

## 1. Create the project

1. Sign in at https://supabase.com and create a new project. Pick the region closest to your users.
2. Open **SQL Editor** and run these three files **in order**, one at a time (paste, press Run, wait for "Success"):
   1. [migrations/0001_init.sql](migrations/0001_init.sql)
   2. [migrations/0002_puzzle_types.sql](migrations/0002_puzzle_types.sql)
   3. [migrations/0003_admin_console.sql](migrations/0003_admin_console.sql)

## 2. Configure sign-in

In **Authentication**:

- **Providers → Email**: enable. Password reset does not use email (admins approve it in the app), so
  "Confirm email" is optional. Hosted Supabase's built-in mailer only sends a few messages per hour;
  switch it off unless you set up your own SMTP.
- **Sign In / Providers → Password**: minimum length 8, to match local development.
- **URL Configuration**:
  - Site URL: your published address (https://phuhuy.live).
  - Redirect URLs: add the same address (and the www variant), plus `http://localhost:5173` for local development.

## 3. Make the first admin

Register an account in the app, then in the SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

After that, admins can promote or demote others from the **Admin → Users** tab in the app, or with `select public.set_user_role('<user-id>', 'admin');`.

## 4. Connect the app

Copy `.env.example` to `.env` and fill in the two values from **Project Settings → API**:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

The anon key is meant to be public. Row level security is what protects the data,
so never put the `service_role` key in the app or in git.

## Data model

| Table | Purpose | Who can read |
|---|---|---|
| `profiles` | Account info and role (`user` / `admin`) | Own row; admins all |
| `projects` | Saved puzzles. `deleted_at` set = in trash | Owner; admins see everyone's active projects, never their trash |
| `password_reset_requests` | "Forgot password" requests waiting for an admin | Admins only |
| `work_sessions` | One row per visit, guests included | Admins only |

Trash is the `deleted_at` column, not a separate table:

- Delete: `update projects set deleted_at = now() where id = any($ids)`
- Restore: `update projects set deleted_at = null where id = any($ids)`
- Delete forever: `delete from projects where id = any($ids)` (allowed only when `deleted_at` is not null)

Items stay in the trash until the user empties them.

Sessions are written through `start_session()` and `touch_session()` so guests can log
a visit without any read access to the table.

## Forgot password and admin actions

There is no email step. A person asks with `request_password_reset(email)`; an admin approves with
`admin_reset_password(request)`, which sets the default password (`123456`), ends the account's
sessions and flags it so the app asks for a new password at the next sign-in. Editing an account is
`admin_update_user(...)`, and `admin_users()` returns the account list with counts and last visit.
Every one of these checks `is_admin()` itself, so calling them from outside the app gets the same answer.
