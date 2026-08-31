-- Historical schema migration backfilled from the live Supabase schema.
-- This file intentionally contains no imported hotel report data, source filenames, hashes,
-- financial values or operational notes.

create table public.business_report_runs (
  id uuid default gen_random_uuid() not null,
  business_date date not null,
  revision integer default 1 not null,
  status text default 'draft'::text not null,
  parser_version text not null,
  validation_status text default 'pending'::text not null,
  validation_summary jsonb default '{}'::jsonb not null,
  source_notes text,
  imported_at timestamp with time zone default now() not null,
  approved_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint business_report_runs_business_date_revision_key unique (business_date, revision),
  constraint business_report_runs_pkey primary key (id),
  constraint business_report_runs_revision_check check (revision > 0),
  constraint business_report_runs_status_check check (status = any (array['draft'::text, 'validated'::text, 'approved'::text, 'rejected'::text])),
  constraint business_report_runs_validation_status_check check (validation_status = any (array['pending'::text, 'passed'::text, 'passed_with_warnings'::text, 'failed'::text]))
);

create table public.source_report_files (
  id uuid default gen_random_uuid() not null,
  run_id uuid not null,
  source_type text not null,
  filename text not null,
  sha256 text not null,
  byte_size bigint not null,
  detected_report_date date,
  source_sheet_count integer,
  source_page_count integer,
  storage_path text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint source_report_files_pkey primary key (id),
  constraint source_report_files_run_id_fkey foreign key (run_id) references public.business_report_runs(id) on delete cascade,
  constraint source_report_files_run_id_source_type_key unique (run_id, source_type),
  constraint source_report_files_byte_size_check check (byte_size >= 0),
  constraint source_report_files_sha256_check check (sha256 ~ '^[0-9a-f]{64}$'::text),
  constraint source_report_files_source_type_check check (source_type = any (array['fnb_xlsx'::text, 'rooms_pdf'::text]))
);

create table public.fnb_daily_summary (
  run_id uuid not null,
  business_date date not null,
  source_sheet text not null,
  source_range text not null,
  daily_revenue numeric,
  daily_forecast numeric,
  daily_variance numeric,
  daily_covers numeric,
  daily_cover_forecast numeric,
  daily_food_revenue numeric,
  daily_food_forecast numeric,
  daily_beverage_revenue numeric,
  daily_beverage_forecast numeric,
  daily_other_revenue numeric,
  daily_other_forecast numeric,
  daily_other_discount numeric,
  mtd_revenue numeric,
  mtd_forecast numeric,
  mtd_variance numeric,
  mtd_covers numeric,
  mtd_cover_forecast numeric,
  mtd_food_revenue numeric,
  mtd_food_forecast numeric,
  mtd_beverage_revenue numeric,
  mtd_beverage_forecast numeric,
  mtd_other_revenue numeric,
  mtd_other_forecast numeric,
  mtd_other_discount numeric,
  validation jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint fnb_daily_summary_pkey primary key (run_id),
  constraint fnb_daily_summary_run_id_fkey foreign key (run_id) references public.business_report_runs(id) on delete cascade
);

create table public.fnb_outlet_daily (
  id uuid default gen_random_uuid() not null,
  run_id uuid not null,
  business_date date not null,
  outlet_key text not null,
  outlet_label text not null,
  display_order integer default 0 not null,
  revenue numeric,
  forecast numeric,
  variance numeric,
  covers numeric,
  food_gross numeric,
  food_discount numeric,
  food_net numeric,
  non_alcohol_gross numeric,
  non_alcohol_discount numeric,
  beverage_gross numeric,
  beverage_discount numeric,
  beverage_net numeric,
  other_revenue numeric,
  other_discount numeric,
  source_sheet text not null,
  source_range text not null,
  validation jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint fnb_outlet_daily_pkey primary key (id),
  constraint fnb_outlet_daily_run_id_fkey foreign key (run_id) references public.business_report_runs(id) on delete cascade,
  constraint fnb_outlet_daily_run_id_outlet_key_key unique (run_id, outlet_key)
);

create table public.fnb_outlet_daypart (
  id uuid default gen_random_uuid() not null,
  run_id uuid not null,
  business_date date not null,
  outlet_key text not null,
  outlet_label text not null,
  daypart_key text not null,
  daypart_label text not null,
  display_order integer default 0 not null,
  covers numeric,
  amenity_count numeric,
  contactless_order_count numeric,
  food_gross numeric,
  food_discount numeric,
  food_net numeric,
  non_alcohol_gross numeric,
  non_alcohol_discount numeric,
  beverage_gross numeric,
  beverage_discount numeric,
  beverage_net numeric,
  other_revenue numeric,
  other_discount numeric,
  net_revenue numeric,
  source_sheet text not null,
  source_cell text not null,
  validation jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint fnb_outlet_daypart_pkey primary key (id),
  constraint fnb_outlet_daypart_run_id_fkey foreign key (run_id) references public.business_report_runs(id) on delete cascade,
  constraint fnb_outlet_daypart_run_id_outlet_key_daypart_key_key unique (run_id, outlet_key, daypart_key)
);

create table public.fnb_operational_notes (
  id uuid default gen_random_uuid() not null,
  run_id uuid not null,
  business_date date not null,
  outlet_key text not null,
  outlet_label text not null,
  daypart_key text not null,
  daypart_label text not null,
  raw_text text not null,
  display_text text not null,
  source_sheet text not null,
  source_cell text not null,
  created_at timestamp with time zone default now() not null,
  constraint fnb_operational_notes_pkey primary key (id),
  constraint fnb_operational_notes_run_id_fkey foreign key (run_id) references public.business_report_runs(id) on delete cascade,
  constraint fnb_operational_notes_run_id_outlet_key_daypart_key_key unique (run_id, outlet_key, daypart_key)
);

create table public.rooms_monthly_summary (
  id uuid default gen_random_uuid() not null,
  run_id uuid not null,
  report_date date not null,
  stay_month date not null,
  source_page integer not null,
  source_row_label text default 'Grand Total'::text not null,
  pickup_rns numeric,
  ly_pickup_rns numeric,
  otb_rns numeric,
  forecast_rns numeric,
  budget_rns numeric,
  stly_rns numeric,
  last_year_rns numeric,
  pickup_adr numeric,
  ly_pickup_adr numeric,
  otb_adr numeric,
  forecast_adr numeric,
  budget_adr numeric,
  stly_adr numeric,
  last_year_adr numeric,
  pickup_revenue numeric,
  ly_pickup_revenue numeric,
  otb_revenue numeric,
  forecast_revenue numeric,
  budget_revenue numeric,
  stly_revenue numeric,
  last_year_revenue numeric,
  otb_vs_stly_rns numeric,
  otb_vs_stly_adr numeric,
  otb_vs_stly_revenue numeric,
  forecast_remaining_rns numeric,
  forecast_remaining_adr numeric,
  forecast_remaining_revenue numeric,
  forecast_remaining_revenue_per_day numeric,
  historical_remaining_rns numeric,
  historical_remaining_adr numeric,
  historical_remaining_revenue numeric,
  historical_remaining_revenue_per_day numeric,
  occupancy_pickup numeric,
  occupancy_ly_pickup numeric,
  occupancy_otb numeric,
  occupancy_forecast numeric,
  occupancy_budget numeric,
  occupancy_stly numeric,
  occupancy_last_year numeric,
  revpar_otb numeric,
  revpar_forecast numeric,
  revpar_budget numeric,
  revpar_stly numeric,
  revpar_last_year numeric,
  validation jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint rooms_monthly_summary_pkey primary key (id),
  constraint rooms_monthly_summary_run_id_fkey foreign key (run_id) references public.business_report_runs(id) on delete cascade,
  constraint rooms_monthly_summary_run_id_stay_month_key unique (run_id, stay_month),
  constraint rooms_monthly_summary_source_page_check check (source_page > 0),
  constraint rooms_monthly_summary_stay_month_check check (stay_month = date_trunc('month'::text, stay_month::timestamp with time zone)::date)
);

create table public.rooms_market_segment (
  id uuid default gen_random_uuid() not null,
  run_id uuid not null,
  report_date date not null,
  stay_month date not null,
  segment_key text not null,
  segment_label text not null,
  segment_code text,
  parent_segment_key text,
  hierarchy_level integer default 0 not null,
  display_order integer default 0 not null,
  is_subtotal boolean default false not null,
  is_grand_total boolean default false not null,
  included_in_grand_total boolean default true not null,
  source_page integer not null,
  pickup_rns numeric,
  ly_pickup_rns numeric,
  otb_rns numeric,
  forecast_rns numeric,
  budget_rns numeric,
  stly_rns numeric,
  last_year_rns numeric,
  pickup_adr numeric,
  ly_pickup_adr numeric,
  otb_adr numeric,
  forecast_adr numeric,
  budget_adr numeric,
  stly_adr numeric,
  last_year_adr numeric,
  pickup_revenue numeric,
  ly_pickup_revenue numeric,
  otb_revenue numeric,
  forecast_revenue numeric,
  budget_revenue numeric,
  stly_revenue numeric,
  last_year_revenue numeric,
  otb_vs_stly_rns numeric,
  otb_vs_stly_adr numeric,
  otb_vs_stly_revenue numeric,
  forecast_remaining_rns numeric,
  forecast_remaining_adr numeric,
  forecast_remaining_revenue numeric,
  forecast_remaining_revenue_per_day numeric,
  historical_remaining_rns numeric,
  historical_remaining_adr numeric,
  historical_remaining_revenue numeric,
  historical_remaining_revenue_per_day numeric,
  validation jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint rooms_market_segment_pkey primary key (id),
  constraint rooms_market_segment_run_id_fkey foreign key (run_id) references public.business_report_runs(id) on delete cascade,
  constraint rooms_market_segment_run_id_stay_month_segment_key_key unique (run_id, stay_month, segment_key)
);

create table public.business_dashboard_rules (
  key text not null,
  domain text not null,
  label text not null,
  config jsonb not null,
  active boolean default true not null,
  sort_order integer default 0 not null,
  updated_at timestamp with time zone default now() not null,
  constraint business_dashboard_rules_pkey primary key (key)
);

create table public.business_dashboard_flags (
  id uuid default gen_random_uuid() not null,
  run_id uuid not null,
  domain text not null,
  scope_key text not null,
  metric_key text not null,
  severity text not null,
  title text not null,
  detail text not null,
  rule_key text not null,
  sort_order integer default 0 not null,
  payload jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint business_dashboard_flags_pkey primary key (id),
  constraint business_dashboard_flags_rule_key_fkey foreign key (rule_key) references public.business_dashboard_rules(key),
  constraint business_dashboard_flags_run_id_fkey foreign key (run_id) references public.business_report_runs(id) on delete cascade,
  constraint business_dashboard_flags_run_id_rule_key_scope_key_metric_k_key unique (run_id, rule_key, scope_key, metric_key),
  constraint business_dashboard_flags_severity_check check (severity = any (array['info'::text, 'watch'::text, 'warning'::text, 'critical'::text]))
);

create table public.business_dashboard_publications (
  business_date date not null,
  run_id uuid not null,
  supersedes_run_id uuid,
  published_at timestamp with time zone default now() not null,
  constraint business_dashboard_publications_pkey primary key (business_date),
  constraint business_dashboard_publications_run_id_fkey foreign key (run_id) references public.business_report_runs(id) on delete restrict,
  constraint business_dashboard_publications_run_id_key unique (run_id),
  constraint business_dashboard_publications_supersedes_run_id_fkey foreign key (supersedes_run_id) references public.business_report_runs(id) on delete set null
);

create index business_report_runs_date_idx on public.business_report_runs (business_date desc, revision desc);
create index fnb_outlet_daily_date_idx on public.fnb_outlet_daily (business_date desc, outlet_key);
create index fnb_daypart_date_idx on public.fnb_outlet_daypart (business_date desc, outlet_key, display_order);
create index fnb_notes_date_idx on public.fnb_operational_notes (business_date desc, outlet_key);
create index rooms_monthly_snapshot_idx on public.rooms_monthly_summary (stay_month, report_date desc);
create index rooms_segment_snapshot_idx on public.rooms_market_segment (segment_key, stay_month, report_date desc);
create index business_flags_run_idx on public.business_dashboard_flags (run_id, sort_order, severity);

alter table public.business_report_runs enable row level security;
alter table public.source_report_files enable row level security;
alter table public.fnb_daily_summary enable row level security;
alter table public.fnb_outlet_daily enable row level security;
alter table public.fnb_outlet_daypart enable row level security;
alter table public.fnb_operational_notes enable row level security;
alter table public.rooms_monthly_summary enable row level security;
alter table public.rooms_market_segment enable row level security;
alter table public.business_dashboard_rules enable row level security;
alter table public.business_dashboard_flags enable row level security;
alter table public.business_dashboard_publications enable row level security;

revoke all on table public.business_report_runs from anon, authenticated;
revoke all on table public.source_report_files from anon, authenticated;
revoke all on table public.fnb_daily_summary from anon, authenticated;
revoke all on table public.fnb_outlet_daily from anon, authenticated;
revoke all on table public.fnb_outlet_daypart from anon, authenticated;
revoke all on table public.fnb_operational_notes from anon, authenticated;
revoke all on table public.rooms_monthly_summary from anon, authenticated;
revoke all on table public.rooms_market_segment from anon, authenticated;
revoke all on table public.business_dashboard_rules from anon, authenticated;
revoke all on table public.business_dashboard_flags from anon, authenticated;
revoke all on table public.business_dashboard_publications from anon, authenticated;

grant all on table public.business_report_runs to service_role;
grant all on table public.source_report_files to service_role;
grant all on table public.fnb_daily_summary to service_role;
grant all on table public.fnb_outlet_daily to service_role;
grant all on table public.fnb_outlet_daypart to service_role;
grant all on table public.fnb_operational_notes to service_role;
grant all on table public.rooms_monthly_summary to service_role;
grant all on table public.rooms_market_segment to service_role;
grant all on table public.business_dashboard_rules to service_role;
grant all on table public.business_dashboard_flags to service_role;
grant all on table public.business_dashboard_publications to service_role;

insert into public.sindhorn_capabilities(key,label,description,active,sort_order)
values
  ('business_dashboard.read','Business dashboard','Read approved daily hotel business performance.',true,65),
  ('business_data.manage','Daily business data','Manage and approve normalized daily business-report imports.',true,66)
on conflict (key) do update set
  label=excluded.label,
  description=excluded.description,
  active=excluded.active,
  sort_order=excluded.sort_order,
  updated_at=now();

insert into public.sindhorn_capability_grants(subject_type,subject_key,capability_key,allowed,scope,active)
values
  ('everyone','*','business_dashboard.read',true,'{}'::jsonb,true),
  ('account_type','developer','business_data.manage',true,'{}'::jsonb,true),
  ('role','super_admin','business_data.manage',true,'{}'::jsonb,true)
on conflict (subject_type,subject_key,capability_key) do update set
  allowed=excluded.allowed,
  scope=excluded.scope,
  active=excluded.active,
  updated_at=now();

insert into public.business_dashboard_rules(key,domain,label,config,active,sort_order)
values
  ('fnb_total_below_forecast','fnb','F&B materially below daily forecast','{"negative_pct":-0.1}'::jsonb,true,10),
  ('fnb_outlet_below_forecast','fnb','Outlet materially below daily forecast','{"max_flags":3,"min_forecast":10000,"negative_pct":-0.25}'::jsonb,true,20),
  ('rooms_occupancy_below_forecast','rooms','Current-month occupancy materially below forecast','{"negative_pp":-0.05}'::jsonb,true,30),
  ('rooms_revenue_below_forecast','rooms','Current-month room revenue materially below forecast','{"negative_pct":-0.1}'::jsonb,true,40)
on conflict (key) do update set
  domain=excluded.domain,
  label=excluded.label,
  config=excluded.config,
  active=excluded.active,
  sort_order=excluded.sort_order,
  updated_at=now();
