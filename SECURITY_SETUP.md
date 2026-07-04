# Security fix — setup steps (do these before deploying)

Your app used to talk to Supabase directly from the browser with a public key, and
stored passwords in plain text. That's now fixed — the browser talks only to a
Netlify function, which holds a secret key and hashes passwords. You need to do
3 things in Supabase and Netlify for it to work.

## 1. Run this in Supabase → SQL Editor

```sql
alter table clinic_users add column if not exists password_hash text;
alter table clinic_users add column if not exists password_salt text;

-- Lock the tables down so ONLY the server (service_role key) can read/write them.
-- The browser no longer has any key that can access these tables directly.
alter table patients enable row level security;
alter table clinic_users enable row level security;
```

Do **not** add any policies after this — leaving zero policies means "deny everyone
except service_role," which is exactly what you want now.

Your existing plain-text passwords in the `password` column will keep working:
the first time each user logs in, the app checks the old plain-text password,
then silently upgrades that account to a hashed password and clears the old field.

## 2. Get your Supabase service_role key

Supabase dashboard → your project → **Project Settings → API**. Copy the
**`service_role`** secret key (NOT the `anon`/`publishable` key you were using
before). This key bypasses RLS, so it must only ever live in Netlify's server
environment — never in app.js, never committed to git.

## 3. Set environment variables in Netlify

Netlify dashboard → your site → **Site configuration → Environment variables**,
add:

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://vstfquvvtsmgmztmnnaq.supabase.co` |
| `SUPABASE_SERVICE_KEY` | the `service_role` key from step 2 |
| `SESSION_SECRET` | any long random string (e.g. run `openssl rand -hex 32`) |

Then redeploy. Log in once with an existing doctor account to confirm it still
works — that first login is what upgrades the password automatically.

## Recommended, not required

Your old `anon`/`publishable` key was sitting in a zip file, so it's technically
exposed. Once RLS is enabled (step 1), that key can no longer read or write your
data even if someone has it — but if you want to be extra safe, you can generate
a new one from the same API settings page and just... not use it anywhere.

## What changed, in short

- `app.js` no longer contains any Supabase key. Every request goes through
  `netlify/functions/api.js`.
- Passwords are hashed (scrypt + per-user salt) instead of stored as plain text.
- Login issues a signed session token (7-day expiry); the server checks it on
  every request instead of trusting the browser.
- A doctor account can only ever read/write its own patients — enforced on the
  server, not just by what the UI happens to display.
- Removed unused leftover files from earlier iterations (`force-fix.js`,
  `force-final.js`, `final-repair.js`, `language_final_patch.js`,
  `language_names_override.js`, their `.css` counterparts, `ZZ_FINAL_PATCH.txt`,
  `index.html.bak`) — none of them were even linked from `index.html`.
