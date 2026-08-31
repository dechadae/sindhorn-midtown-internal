-- Historical function migration backfilled from the live Supabase schema.
-- Data-free: thresholds are read from business_dashboard_rules.

create or replace function public.sindhorn_business_rebuild_flags(p_run_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_count integer := 0;
  v_business_date date;
  v_limit integer := 3;
  v_negative numeric := -0.25;
  v_min_forecast numeric := 10000;
  v_occ_negative numeric := -0.05;
  v_room_rev_negative numeric := -0.10;
begin
  select r.business_date into v_business_date from public.business_report_runs r where r.id=p_run_id;
  if v_business_date is null then raise exception 'Unknown business report run'; end if;

  delete from public.business_dashboard_flags where run_id=p_run_id;

  select coalesce((config->>'negative_pct')::numeric,-0.10)
  into v_negative from public.business_dashboard_rules where key='fnb_total_below_forecast' and active=true;

  insert into public.business_dashboard_flags(run_id,domain,scope_key,metric_key,severity,title,detail,rule_key,sort_order,payload)
  select p_run_id,'fnb','total','daily_revenue','warning','F&B is below daily forecast',
    'Daily revenue is materially behind forecast.','fnb_total_below_forecast',10,
    jsonb_build_object('actual',s.daily_revenue,'forecast',s.daily_forecast,'variance',s.daily_variance,'variancePct',s.daily_variance/nullif(s.daily_forecast,0))
  from public.fnb_daily_summary s
  where s.run_id=p_run_id and s.daily_forecast>0 and s.daily_variance/nullif(s.daily_forecast,0) <= v_negative;

  select coalesce((config->>'negative_pct')::numeric,-0.25),
         coalesce((config->>'min_forecast')::numeric,10000),
         coalesce((config->>'max_flags')::integer,3)
  into v_negative,v_min_forecast,v_limit
  from public.business_dashboard_rules where key='fnb_outlet_below_forecast' and active=true;

  insert into public.business_dashboard_flags(run_id,domain,scope_key,metric_key,severity,title,detail,rule_key,sort_order,payload)
  select p_run_id,'fnb',x.outlet_key,'outlet_revenue','watch',x.outlet_label||' is below forecast',
    'Outlet revenue is materially behind its daily forecast.','fnb_outlet_below_forecast',20+x.rn,
    jsonb_build_object('outlet',x.outlet_label,'actual',x.revenue,'forecast',x.forecast,'variance',x.variance,'variancePct',x.variance/nullif(x.forecast,0))
  from (
    select o.*,row_number() over(order by o.variance asc)::integer as rn
    from public.fnb_outlet_daily o
    where o.run_id=p_run_id and o.forecast >= v_min_forecast and o.variance/nullif(o.forecast,0) <= v_negative
    order by o.variance asc
    limit v_limit
  ) x;

  select coalesce((config->>'negative_pp')::numeric,-0.05)
  into v_occ_negative from public.business_dashboard_rules where key='rooms_occupancy_below_forecast' and active=true;

  insert into public.business_dashboard_flags(run_id,domain,scope_key,metric_key,severity,title,detail,rule_key,sort_order,payload)
  select p_run_id,'rooms',to_char(m.stay_month,'YYYY-MM'),'occupancy','warning','Occupancy is below forecast',
    'Current-month OTB occupancy is materially behind forecast.','rooms_occupancy_below_forecast',40,
    jsonb_build_object('otb',m.occupancy_otb,'forecast',m.occupancy_forecast,'variancePp',(m.occupancy_otb-m.occupancy_forecast)*100)
  from public.rooms_monthly_summary m
  where m.run_id=p_run_id and m.stay_month=date_trunc('month',v_business_date)::date
    and m.occupancy_forecast is not null and m.occupancy_otb-m.occupancy_forecast <= v_occ_negative;

  select coalesce((config->>'negative_pct')::numeric,-0.10)
  into v_room_rev_negative from public.business_dashboard_rules where key='rooms_revenue_below_forecast' and active=true;

  insert into public.business_dashboard_flags(run_id,domain,scope_key,metric_key,severity,title,detail,rule_key,sort_order,payload)
  select p_run_id,'rooms',to_char(m.stay_month,'YYYY-MM'),'room_revenue','warning','Room revenue is below forecast',
    'Current-month OTB room revenue is materially behind forecast.','rooms_revenue_below_forecast',50,
    jsonb_build_object('otb',m.otb_revenue,'forecast',m.forecast_revenue,'variance',m.otb_revenue-m.forecast_revenue,'variancePct',(m.otb_revenue-m.forecast_revenue)/nullif(m.forecast_revenue,0))
  from public.rooms_monthly_summary m
  where m.run_id=p_run_id and m.stay_month=date_trunc('month',v_business_date)::date
    and m.forecast_revenue>0 and (m.otb_revenue-m.forecast_revenue)/nullif(m.forecast_revenue,0) <= v_room_rev_negative;

  select count(*) into v_count from public.business_dashboard_flags where run_id=p_run_id;
  return v_count;
end;
$$;

revoke all on function public.sindhorn_business_rebuild_flags(uuid) from public, anon, authenticated;
grant execute on function public.sindhorn_business_rebuild_flags(uuid) to service_role;
