-- Additive performance follow-up from Supabase advisor findings.
-- No business data or runtime configuration is stored here.

create index if not exists business_dashboard_flags_rule_key_idx
  on public.business_dashboard_flags(rule_key);

create index if not exists business_dashboard_publications_supersedes_run_idx
  on public.business_dashboard_publications(supersedes_run_id)
  where supersedes_run_id is not null;
