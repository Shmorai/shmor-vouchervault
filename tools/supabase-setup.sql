-- =====================================================================
-- VoucherVault database (Supabase / Postgres). Run once in the Supabase
-- dashboard: SQL Editor → New query → paste this file → Run.
--
-- leads   = people who unlocked a code (name, email, mobile, marketing opt-ins)
-- signups = Code Alerts email sign-ups
--
-- Security: row-level security is ON. Website visitors (the "anon" role) can
-- only INSERT rows, and only rows that pass the checks below. Nobody can read,
-- change or delete rows from the website; you see them in the dashboard
-- (Table Editor) or export them as CSV from there.
-- Choose an EU/UK region (e.g. London or Frankfurt) when creating the project,
-- since most visitors' data is covered by UK/EU GDPR.
-- =====================================================================

create table if not exists public.leads (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  first_name       text not null check (char_length(first_name) between 1 and 60),
  last_name        text not null check (char_length(last_name) between 1 and 60),
  email            text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  phone            text not null check (char_length(regexp_replace(phone, '\D', '', 'g')) between 7 and 15),
  terms_accepted   boolean not null check (terms_accepted),
  marketing_email  boolean not null default false,
  marketing_sms    boolean not null default false,
  store            text check (char_length(store) <= 60),
  offer            text check (char_length(offer) <= 80),
  page             text check (char_length(page) <= 200)
);

create table if not exists public.signups (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  list        text not null default 'code-alerts' check (char_length(list) <= 40),
  interests   text check (char_length(interests) <= 200),
  store       text check (char_length(store) <= 60),
  placement   text check (char_length(placement) <= 40),
  page        text check (char_length(page) <= 200),
  consent     boolean not null check (consent)
);

alter table public.leads   enable row level security;
alter table public.signups enable row level security;

-- Visitors may add rows, nothing else (no select/update/delete policies exist).
drop policy if exists "website can add leads" on public.leads;
create policy "website can add leads" on public.leads for insert to anon with check (true);
drop policy if exists "website can add signups" on public.signups;
create policy "website can add signups" on public.signups for insert to anon with check (true);

grant insert on public.leads, public.signups to anon;
revoke select, update, delete on public.leads, public.signups from anon;

-- Handy views for you in the dashboard (not exposed to visitors)
create or replace view public.marketing_email_list with (security_invoker = true) as
  select distinct on (email) first_name, last_name, email, created_at from public.leads where marketing_email order by email, created_at desc;
create or replace view public.marketing_sms_list with (security_invoker = true) as
  select distinct on (phone) first_name, last_name, phone, created_at from public.leads where marketing_sms order by phone, created_at desc;
revoke all on public.marketing_email_list, public.marketing_sms_list from anon;
