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
domain. **For the CrazyGames upload, build with `node build.mjs --crazygames`
instead** — that blanks the config in `dist/` so the upload has no
accounts/payments, regardless of what `js/config.js` holds.

---

## What works after step 4 (accounts + entitlements)
- Create account (email verification) / sign in / sign out.
- The game reads the signed-in user's owned courses from the database.
- On the Courses screen: **✦ GET FREE** claims the one free course; owned built
  courses show **▶ PLAY**. (Paid unlock needs Stripe — next.)

---

## 6. Payments (Stripe) — unlock extra courses
The "🔒 £2.99" button starts a Stripe Checkout; a webhook grants the course
**after payment**, server-side. Nothing about payment is trusted to the client.

1. **Stripe account:** sign up at <https://stripe.com>. Use **test mode** while
   developing (test keys + test cards).
2. **Create a product + price** per paid course (Products → Add). Copy each
   **Price ID** (`price_...`), and set it on the course row:
   ```sql
   update public.courses set stripe_price_id = 'price_XXXX', published = true where id = 'maths';
   ```
   (A course is only purchasable once it has a `stripe_price_id` and `published = true`.)
3. **Deploy the Edge Functions** (install the Supabase CLI, `supabase link` your
   project, then):
   ```bash
   supabase functions deploy create-checkout-session
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
   (`--no-verify-jwt` on the webhook: Stripe can't send a Supabase JWT — it's
   authenticated by the Stripe signature instead.)
4. **Set the function secrets** (Edge Functions → Secrets, or `supabase secrets set`):
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL` (your site's origin,
   used for the success/cancel redirects). `SUPABASE_URL` / `SUPABASE_ANON_KEY` /
   `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.
5. **Add the webhook** in Stripe (Developers → Webhooks → Add endpoint):
   - URL: `https://YOUR-PROJECT.supabase.co/functions/v1/stripe-webhook`
   - Event: `checkout.session.completed`
   - Copy the endpoint's **Signing secret** into `STRIPE_WEBHOOK_SECRET` (step 4).
6. **Test** with a Stripe test card (e.g. `4242 4242 4242 4242`, any future
   expiry/CVC). After paying you're redirected to `/?unlocked=<course>` and the
   course appears owned.

---

## Still to come
- **Increment 4:** paid course content served from the backend only after an
  entitlement check (so locked content never ships to the client). This is why
  `stripe_price_id`/`published` gate purchasability — content gating builds on it.

## Anti-abuse note
"One free course per account" is enforced in `claim_free_course()`. Email
verification adds friction against throwaway accounts. A determined user can
still make multiple verified emails — that residual leakage is accepted on
purpose (heavy device fingerprinting is inappropriate for a minors' audience),
and the paid courses carry the revenue.
