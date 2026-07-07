-- ============================================================
-- 0001_init.sql — LogicFlow accounts + course entitlements (Supabase / Postgres)
--
-- Run this in the Supabase SQL editor (or `supabase db push`). It creates the
-- catalog, per-account entitlements, purchase records, and Row-Level Security
-- so a signed-in user can only ever READ their own entitlements. Grants happen
-- only through controlled paths — claim_free_course() for the one free course,
-- and the Stripe webhook (service role) for purchases — never a direct client
-- write. This is the real enforcement layer; the client is just a mirror.
-- ============================================================

-- ── courses catalog (server source of truth for price + availability) ──
create table if not exists public.courses (
  id               text primary key,          -- matches js/courses.js ids, e.g. 'compsci'
  name             text not null,
  stripe_price_id  text,                       -- set once the course is purchasable
  published        boolean not null default false,
  created_at       timestamptz not null default now()
);
alter table public.courses enable row level security;
drop policy if exists "courses readable by everyone" on public.courses;
create policy "courses readable by everyone" on public.courses for select using (true);

-- ── entitlements (which courses a user owns) ──
do $$ begin
  create type public.entitlement_source as enum ('free_token', 'purchase');
exception when duplicate_object then null; end $$;

create table if not exists public.entitlements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_id   text not null references public.courses(id),
  source      public.entitlement_source not null,
  created_at  timestamptz not null default now(),
  unique (user_id, course_id)
);
alter table public.entitlements enable row level security;
-- READ own only. No INSERT/UPDATE/DELETE policy = clients can never write
-- entitlements directly (grants go through the function / service role below).
drop policy if exists "read own entitlements" on public.entitlements;
create policy "read own entitlements" on public.entitlements for select using (auth.uid() = user_id);

-- ── purchases (Stripe records; written by the webhook via the service role) ──
create table if not exists public.purchases (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  course_id          text not null references public.courses(id),
  stripe_session_id  text unique,
  status             text not null default 'pending',   -- pending | paid | failed
  amount             integer,                            -- pence
  created_at         timestamptz not null default now()
);
alter table public.purchases enable row level security;
drop policy if exists "read own purchases" on public.purchases;
create policy "read own purchases" on public.purchases for select using (auth.uid() = user_id);

-- ── one free course per account, enforced server-side ──
-- SECURITY DEFINER so it can insert an entitlement (which clients otherwise
-- cannot), while checking the caller hasn't already used their free token.
create or replace function public.claim_free_course(p_course_id text)
returns public.entitlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.entitlements;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.courses where id = p_course_id and published) then
    raise exception 'unknown or unpublished course';
  end if;
  if exists (select 1 from public.entitlements where user_id = v_uid and source = 'free_token') then
    raise exception 'free course already claimed';
  end if;

  insert into public.entitlements (user_id, course_id, source)
    values (v_uid, p_course_id, 'free_token')
    on conflict (user_id, course_id) do nothing
    returning * into v_row;

  if v_row is null then   -- already owned via a purchase → idempotent success
    select * into v_row from public.entitlements
      where user_id = v_uid and course_id = p_course_id;
  end if;
  return v_row;
end;
$$;
grant execute on function public.claim_free_course(text) to authenticated;

-- ── seed the one built course ──
insert into public.courses (id, name, published) values ('compsci', 'Computer Science', true)
  on conflict (id) do update set name = excluded.name, published = excluded.published;
