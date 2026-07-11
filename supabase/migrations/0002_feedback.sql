-- 0002_feedback.sql — player feedback inbox.
--
-- Players (signed in or not) can INSERT feedback; nothing can be read back
-- through the public API (no SELECT policy), so the inbox is only visible in
-- the dashboard / with the service role. Safe to re-run (idempotent).

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid default auth.uid() references auth.users(id) on delete set null,
  email      text check (email is null or char_length(email) <= 200),
  message    text not null check (char_length(message) between 3 and 2000),
  context    jsonb not null default '{}'::jsonb
);

alter table public.feedback enable row level security;

-- anyone may leave feedback…
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert to anon, authenticated with check (true);

-- …and nobody may read it via the API (no select policy on purpose).
