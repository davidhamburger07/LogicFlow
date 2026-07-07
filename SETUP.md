# LogicFlow — standalone-site backend setup

This sets up **accounts + course entitlements** for the **standalone website**
build (your own domain). It is **not** used on CrazyGames — that build stays
free + ad-supported. Leave `js/config.js` blank for the CrazyGames upload and
the backend stays off.

The stack is **Supabase** (Postgres + Auth + Row-Level Security). Entitlements
are enforced server-side; the client only mirrors them.

---

## 1. Create a Supabase project
1. Sign up at <https://supabase.com> and create a new project (free tier is fine).
2. Wait for it to finish provisioning.

## 2. Run the database migration
1. In the dashboard: **SQL Editor → New query**.
2. Paste the whole contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and **Run**.
3. This creates `courses`, `entitlements`, `purchases`, the Row-Level Security
   policies, the `claim_free_course()` function, and seeds the Computer Science
   course. Re-running it is safe (idempotent).

## 3. Turn on email auth
1. **Authentication → Providers → Email**: enable it.
2. **Authentication → Sign In / Providers**: keep **"Confirm email"** ON, so new
   accounts must verify their email (this is part of the anti-abuse story).
3. Optional: set your site URL + redirect URLs under **Authentication → URL
   Configuration** so confirmation links point at your domain.

## 4. Wire the keys into the game
In [`js/config.js`](js/config.js) set:
```js
export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR-PUBLIC-ANON-KEY';
```
Find both under **Project Settings → API**. The anon key is a **public** key —
safe to ship, because RLS restricts every read to the signed-in user's own rows.

`backendEnabled()` flips on automatically once both are set. Sign-in appears on
the **Courses** screen.

## 5. Deploy the standalone site
Build with `node build.mjs` (which bundles the config), and host `dist/` on your
domain. **For the CrazyGames upload, leave `config.js` blank** so that build has
no accounts/payments.

---

## What works after this (Increment 2)
- Create account (with email verification) / sign in / sign out.
- The game reads the signed-in user's owned courses from the database.
- `claim_free_course()` exists and enforces **one free course per account**.

## Still to come
- **Increment 3 (Stripe):** paying to unlock extra courses — needs a Stripe
  account, a Checkout call, and a webhook Edge Function that grants the
  entitlement server-side. The "claim your free course" and "buy" buttons on the
  Courses screen land here.
- **Increment 4:** paid course content served from the backend only after an
  entitlement check (so locked content never ships to the client).

## Anti-abuse note
"One free course per account" is enforced in `claim_free_course()`. Email
verification adds friction against throwaway accounts. A determined user can
still make multiple verified emails — that residual leakage is accepted on
purpose (heavy device fingerprinting is inappropriate for a minors' audience),
and the paid courses carry the revenue.
