-- Sindhorn Midtown F&B operational content authority.
-- Business content is imported from the approved Excel workbooks after this schema migration;
-- it is intentionally not seeded in Git migrations.

create table if not exists public.sindhorn_fnb_promotions (
  id text primary key,
  title text not null,
  summary text not null default '',
  start_date date not null,
  end_date date not null,
  display_date_label text,
  brief text,
  copy_en text,
  copy_th text,
  display_outlets text[] not null default '{}'::text[],
  sort_order integer not null default 0,
  published boolean not null default true,
  source_workbook text,
  source_sheet text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sindhorn_fnb_promotions_date_order check (start_date <= end_date)
);

create table if not exists public.sindhorn_fnb_promotion_activations (
  id text primary key,
  promotion_id text not null references public.sindhorn_fnb_promotions(id) on update cascade on delete cascade,
  outlet text not null,
  service_time text,
  ihg_one_rewards text,
  brief text,
  copy_en text,
  copy_th text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sindhorn_fnb_artwork_requirements (
  id text primary key,
  activation_id text not null references public.sindhorn_fnb_promotion_activations(id) on update cascade on delete cascade,
  name text not null,
  dimensions_format text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sindhorn_fnb_activation_links (
  activation_id text primary key references public.sindhorn_fnb_promotion_activations(id) on update cascade on delete cascade,
  artwork_folder_url text not null check (artwork_folder_url ~ '^https://'),
  source_kind text not null check (source_kind in ('workbook','approved-manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sindhorn_fnb_promotions_dates_idx on public.sindhorn_fnb_promotions(start_date,end_date);
create index if not exists sindhorn_fnb_promotions_published_sort_idx on public.sindhorn_fnb_promotions(published,sort_order,id);
create index if not exists sindhorn_fnb_activations_promotion_idx on public.sindhorn_fnb_promotion_activations(promotion_id,sort_order,id);
create index if not exists sindhorn_fnb_artworks_activation_idx on public.sindhorn_fnb_artwork_requirements(activation_id,sort_order,id);

create or replace function public.sindhorn_fnb_touch_updated_at()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  new.updated_at:=now();
  return new;
end;
$$;

drop trigger if exists sindhorn_fnb_promotions_touch on public.sindhorn_fnb_promotions;
create trigger sindhorn_fnb_promotions_touch before update on public.sindhorn_fnb_promotions for each row execute function public.sindhorn_fnb_touch_updated_at();
drop trigger if exists sindhorn_fnb_activations_touch on public.sindhorn_fnb_promotion_activations;
create trigger sindhorn_fnb_activations_touch before update on public.sindhorn_fnb_promotion_activations for each row execute function public.sindhorn_fnb_touch_updated_at();
drop trigger if exists sindhorn_fnb_artworks_touch on public.sindhorn_fnb_artwork_requirements;
create trigger sindhorn_fnb_artworks_touch before update on public.sindhorn_fnb_artwork_requirements for each row execute function public.sindhorn_fnb_touch_updated_at();
drop trigger if exists sindhorn_fnb_links_touch on public.sindhorn_fnb_activation_links;
create trigger sindhorn_fnb_links_touch before update on public.sindhorn_fnb_activation_links for each row execute function public.sindhorn_fnb_touch_updated_at();

create or replace function public.sindhorn_fnb_is_active_employee()
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select auth.uid() is not null
     and exists (
       select 1 from public.sindhorn_employees e
       where e.auth_user_id=auth.uid() and e.active=true
     );
$$;

alter table public.sindhorn_fnb_promotions enable row level security;
alter table public.sindhorn_fnb_promotion_activations enable row level security;
alter table public.sindhorn_fnb_artwork_requirements enable row level security;
alter table public.sindhorn_fnb_activation_links enable row level security;

drop policy if exists "active employees read fnb promotions" on public.sindhorn_fnb_promotions;
create policy "active employees read fnb promotions" on public.sindhorn_fnb_promotions for select to authenticated using (public.sindhorn_fnb_is_active_employee());
drop policy if exists "active employees read fnb activations" on public.sindhorn_fnb_promotion_activations;
create policy "active employees read fnb activations" on public.sindhorn_fnb_promotion_activations for select to authenticated using (public.sindhorn_fnb_is_active_employee());
drop policy if exists "active employees read fnb artworks" on public.sindhorn_fnb_artwork_requirements;
create policy "active employees read fnb artworks" on public.sindhorn_fnb_artwork_requirements for select to authenticated using (public.sindhorn_fnb_is_active_employee());
drop policy if exists "active employees read fnb links" on public.sindhorn_fnb_activation_links;
create policy "active employees read fnb links" on public.sindhorn_fnb_activation_links for select to authenticated using (public.sindhorn_fnb_is_active_employee());

revoke all on public.sindhorn_fnb_promotions from anon;
revoke all on public.sindhorn_fnb_promotion_activations from anon;
revoke all on public.sindhorn_fnb_artwork_requirements from anon;
revoke all on public.sindhorn_fnb_activation_links from anon;
grant select on public.sindhorn_fnb_promotions,public.sindhorn_fnb_promotion_activations,public.sindhorn_fnb_artwork_requirements,public.sindhorn_fnb_activation_links to authenticated;

create or replace function public.sindhorn_fnb_read_model()
returns jsonb
language plpgsql
stable
set search_path=public,pg_temp
as $$
declare result jsonb;
begin
  if not public.sindhorn_fnb_is_active_employee() then raise exception 'not authorized' using errcode='42501'; end if;
  select coalesce(jsonb_agg(p.payload order by p.sort_order,p.id),'[]'::jsonb) into result
  from (
    select pr.sort_order,pr.id,jsonb_build_object(
      'id',pr.id,'title',pr.title,'start',to_char(pr.start_date,'YYYY-MM-DD'),'end',to_char(pr.end_date,'YYYY-MM-DD'),
      'dateLabel',coalesce(pr.display_date_label,''),'summary',coalesce(pr.summary,''),'brief',coalesce(pr.brief,''),
      'copyEn',coalesce(pr.copy_en,''),'copyTh',coalesce(pr.copy_th,''),'displayOutlets',to_jsonb(pr.display_outlets),
      'updatedAt',to_char(pr.updated_at at time zone 'Asia/Bangkok','YYYY-MM-DD"T"HH24:MI:SS'),
      'activations',coalesce((select jsonb_agg(jsonb_build_object(
        'id',ac.id,'outlet',ac.outlet,'time',coalesce(ac.service_time,'TBC'),'discount',coalesce(ac.ihg_one_rewards,'N/A'),
        'brief',coalesce(ac.brief,''),'copyEn',coalesce(ac.copy_en,''),'copyTh',coalesce(ac.copy_th,''),'artworkUrl',lk.artwork_folder_url,
        'artworks',coalesce((select jsonb_agg(jsonb_build_object('id',ar.id,'name',ar.name,'dimensions',ar.dimensions_format,'notes',ar.notes) order by ar.sort_order,ar.id) from public.sindhorn_fnb_artwork_requirements ar where ar.activation_id=ac.id),'[]'::jsonb)
      ) order by ac.sort_order,ac.id) from public.sindhorn_fnb_promotion_activations ac left join public.sindhorn_fnb_activation_links lk on lk.activation_id=ac.id where ac.promotion_id=pr.id),'[]'::jsonb)
    ) payload from public.sindhorn_fnb_promotions pr where pr.published=true
  ) p;
  return result;
end;
$$;

-- Explicit anonymous allowlist. By product decision, artwork folder URLs are included here;
-- the SharePoint targets still require IHG authentication. No employee/auth/admin data is joined.
create or replace function public.sindhorn_fnb_public_read_model()
returns jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select coalesce(jsonb_agg(p.payload order by p.sort_order,p.id),'[]'::jsonb)
  from (
    select pr.sort_order,pr.id,jsonb_build_object(
      'id',pr.id,'title',pr.title,'start',to_char(pr.start_date,'YYYY-MM-DD'),'end',to_char(pr.end_date,'YYYY-MM-DD'),
      'dateLabel',coalesce(pr.display_date_label,''),'summary',coalesce(pr.summary,''),'brief',coalesce(pr.brief,''),
      'copyEn',coalesce(pr.copy_en,''),'copyTh',coalesce(pr.copy_th,''),'displayOutlets',to_jsonb(pr.display_outlets),
      'updatedAt',to_char(pr.updated_at at time zone 'Asia/Bangkok','YYYY-MM-DD"T"HH24:MI:SS'),
      'activations',coalesce((select jsonb_agg(jsonb_build_object(
        'id',ac.id,'outlet',ac.outlet,'time',coalesce(ac.service_time,'TBC'),'discount',coalesce(ac.ihg_one_rewards,'N/A'),
        'brief',coalesce(ac.brief,''),'copyEn',coalesce(ac.copy_en,''),'copyTh',coalesce(ac.copy_th,''),'artworkUrl',lk.artwork_folder_url,
        'artworks',coalesce((select jsonb_agg(jsonb_build_object('id',ar.id,'name',ar.name,'dimensions',ar.dimensions_format,'notes',ar.notes) order by ar.sort_order,ar.id) from public.sindhorn_fnb_artwork_requirements ar where ar.activation_id=ac.id),'[]'::jsonb)
      ) order by ac.sort_order,ac.id) from public.sindhorn_fnb_promotion_activations ac left join public.sindhorn_fnb_activation_links lk on lk.activation_id=ac.id where ac.promotion_id=pr.id),'[]'::jsonb)
    ) payload from public.sindhorn_fnb_promotions pr where pr.published=true
  ) p;
$$;

revoke all on function public.sindhorn_fnb_read_model() from public,anon;
grant execute on function public.sindhorn_fnb_read_model() to authenticated;
revoke all on function public.sindhorn_fnb_public_read_model() from public;
grant execute on function public.sindhorn_fnb_public_read_model() to anon,authenticated;
