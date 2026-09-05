-- Sindhorn Betta periods: the saved fish for each period of the hotel day
-- (r29b, 5 Sep 2026). The Readability Test (Settings › System, developer
-- account) draws a candidate Betta for a period from a seed, measures the
-- app's ink over the live glass, and may save it once Ink, Muted and Accent
-- all clear 4.5:1. r29a kept that on one device; this table makes it the
-- app's configuration, read by every phone at launch.
--
-- Access model, following the accepted capability pattern
-- (sindhorn_settings_capability_authority, 29 Aug 2026): RLS on with no
-- policies, no grants to anon or authenticated, every access through a
-- security-definer RPC. The read is open to anon: the atmosphere renders
-- before sign-in and a fish's colours are not sensitive, so the read RPC
-- returns the style map and nothing else (no who, no when). Writes are
-- gated on system.manage, and the RPC re-checks the contract itself: a
-- reading below 4.5:1 on any role is refused server-side, so the rule holds
-- even if the page is bypassed. A style is configuration, never a live
-- input: nothing here modulates the render, it only chooses the preset.

create table if not exists public.sindhorn_betta_periods (
  period_key text primary key check (period_key ~ '^[a-z][a-z0-9-]{1,39}$'),
  seed text not null check (seed ~ '^[0-9]{1,20}$'),
  style jsonb not null check (jsonb_typeof(style) = 'object' and pg_column_size(style) <= 16384),
  reading jsonb not null check (jsonb_typeof(reading) = 'object'),
  saved_by uuid references public.sindhorn_employees(id) on delete set null,
  saved_at timestamptz not null default now()
);
alter table public.sindhorn_betta_periods enable row level security;
revoke all on public.sindhorn_betta_periods from public, anon, authenticated;
grant select, insert, update, delete on public.sindhorn_betta_periods to service_role;
comment on table public.sindhorn_betta_periods is 'Saved Betta style per period of the hotel day; written only through sindhorn_betta_period_save_v1 after the readability contract passes.';

-- ---------------------------------------------------------------------------
-- Helpers (private)
-- ---------------------------------------------------------------------------
create or replace function sindhorn_private.require_betta_manager()
returns uuid
language plpgsql stable security definer set search_path=''
as $$
declare v_employee_id uuid := sindhorn_private.current_employee_id();
begin
  if v_employee_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not public.sindhorn_has_capability('system.manage') then raise exception 'capability required: system.manage' using errcode='42501'; end if;
  return v_employee_id;
end $$;
revoke all on function sindhorn_private.require_betta_manager() from public, anon, authenticated;

-- The contract, as the page states it: every role's lowest observed ratio
-- clears 4.5:1. The reading is {roles:[{key,ratio,pass,...}...],pass,...}
-- exactly as betta-readability.js produced it; only the three ratios are
-- judged here, the rest is kept for the record.
create or replace function sindhorn_private.betta_reading_passes(p_reading jsonb)
returns boolean
language sql immutable set search_path=''
as $$
  select p_reading is not null
    and jsonb_typeof(p_reading->'roles') = 'array'
    and (select count(*) from jsonb_array_elements(p_reading->'roles') r where r->>'key' in ('ink','muted','accent')) = 3
    and not exists (
      select 1 from jsonb_array_elements(p_reading->'roles') r
      where r->>'key' in ('ink','muted','accent')
        and (r->>'ratio' is null or (r->>'ratio')::numeric < 4.5)
    );
$$;
revoke all on function sindhorn_private.betta_reading_passes(jsonb) from public, anon, authenticated;

create or replace function sindhorn_private.betta_styles_json()
returns jsonb
language sql stable security definer set search_path=''
as $$
  select coalesce(jsonb_object_agg(period_key, style), '{}'::jsonb) from public.sindhorn_betta_periods;
$$;
revoke all on function sindhorn_private.betta_styles_json() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
-- Read: the style map keyed by period, for the runtime at launch. Open to
-- anon on purpose (see the header); returns nothing but styles.
create or replace function public.sindhorn_betta_periods_v1()
returns jsonb
language sql stable security definer set search_path=''
as $$
  select jsonb_build_object('ok', true, 'styles', sindhorn_private.betta_styles_json());
$$;
revoke all on function public.sindhorn_betta_periods_v1() from public, anon, authenticated;
grant execute on function public.sindhorn_betta_periods_v1() to anon, authenticated;
comment on function public.sindhorn_betta_periods_v1() is 'Saved Betta style per period for the atmosphere at launch; anon-readable, styles only.';

-- Save one period's fish. The seed must match the style it drew, and the
-- reading must pass; both are the page's, checked again here.
create or replace function public.sindhorn_betta_period_save_v1(p_key text, p_seed text, p_style jsonb, p_reading jsonb)
returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare v_actor uuid := sindhorn_private.require_betta_manager();
begin
  if p_key is null or p_key !~ '^[a-z][a-z0-9-]{1,39}$' then raise exception 'period key required' using errcode='22023'; end if;
  if p_style is null or jsonb_typeof(p_style) <> 'object' then raise exception 'style required' using errcode='22023'; end if;
  if p_seed is null or p_seed !~ '^[0-9]{1,20}$' or p_style->>'seed' is distinct from p_seed then raise exception 'seed must match the style' using errcode='22023'; end if;
  if not sindhorn_private.betta_reading_passes(p_reading) then raise exception 'reading below 4.5:1' using errcode='23514'; end if;
  insert into public.sindhorn_betta_periods (period_key, seed, style, reading, saved_by, saved_at)
  values (p_key, p_seed, p_style, p_reading, v_actor, now())
  on conflict (period_key) do update set seed = excluded.seed, style = excluded.style, reading = excluded.reading, saved_by = excluded.saved_by, saved_at = now();
  return jsonb_build_object('ok', true, 'styles', sindhorn_private.betta_styles_json());
end $$;
revoke all on function public.sindhorn_betta_period_save_v1(text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.sindhorn_betta_period_save_v1(text,text,jsonb,jsonb) to authenticated;
comment on function public.sindhorn_betta_period_save_v1(text,text,jsonb,jsonb) is 'Save a period''s Betta style; requires system.manage and a reading that clears 4.5:1 on ink, muted and accent.';

-- Original: the period goes back to the bundled fish.
create or replace function public.sindhorn_betta_period_reset_v1(p_key text)
returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare v_actor uuid := sindhorn_private.require_betta_manager();
begin
  delete from public.sindhorn_betta_periods where period_key = p_key;
  return jsonb_build_object('ok', true, 'styles', sindhorn_private.betta_styles_json());
end $$;
revoke all on function public.sindhorn_betta_period_reset_v1(text) from public, anon, authenticated;
grant execute on function public.sindhorn_betta_period_reset_v1(text) to authenticated;
comment on function public.sindhorn_betta_period_reset_v1(text) is 'Return a period to the bundled Betta; requires system.manage.';
