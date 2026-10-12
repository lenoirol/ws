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
| Mailbox (password-reset mails land here) | http://127.0.0.1:54324 |
| PostgreSQL | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

`.env` already points at the local API. When you move to a real Supabase project, only the two
values in `.env` change; the code stays the same.

[local/auth_shim.sql](local/auth_shim.sql) is only for running the migration on a plain PostgreSQL
server without Supabase. You do not need it with the commands above.

## 1. Create the project

1. Sign in at https://supabase.com and create a new project. Pick the region closest to your users.
2. Open **SQL Editor**, paste all of [migrations/0001_init.sql](migrations/0001_init.sql) and run it.

## 2. Configure sign-in

In **Authentication**:

- **Providers → Email**: enable. Keep "Confirm email" on so password reset and verification mail work.
- **URL Configuration**:
  - Site URL: your published address (the GitHub Pages URL).
  - Redirect URLs: add the same address, plus `http://localhost:5173` for local development.

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
| `projects` | Saved puzzles. `deleted_at` set = in trash | Owner; admins all |
| `work_sessions` | One row per visit, guests included | Admins only |

Trash is the `deleted_at` column, not a separate table:

- Delete: `update projects set deleted_at = now() where id = any($ids)`
- Restore: `update projects set deleted_at = null where id = any($ids)`
- Delete forever: `delete from projects where id = any($ids)` (allowed only when `deleted_at` is not null)

Items stay in the trash until the user empties them.

Sessions are written through `start_session()` and `touch_session()` so guests can log
a visit without any read access to the table.
