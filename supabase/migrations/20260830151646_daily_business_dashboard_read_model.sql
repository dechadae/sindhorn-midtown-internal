-- Historical read-model migration backfilled from the live Supabase schema.
-- The RPC is the authenticated browser boundary; underlying business tables remain closed.

create or replace function public.sindhorn_business_dashboard_read_model(p_business_date date default null::date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_run uuid;
  v_date date;
  v_result jsonb;
begin
  if not public.sindhorn_has_capability('business_dashboard.read') then
    raise exception 'insufficient_privilege' using errcode='42501';
  end if;

  if p_business_date is null then
    select p.run_id,p.business_date into v_run,v_date
    from public.business_dashboard_publications p
    order by p.business_date desc limit 1;
  else
    select p.run_id,p.business_date into v_run,v_date
    from public.business_dashboard_publications p where p.business_date=p_business_date;
  end if;

  if v_run is null then return null; end if;

  select jsonb_build_object(
    'businessDate',v_date,
    'runId',r.id,
    'revision',r.revision,
    'importedAt',r.imported_at,
    'publishedAt',p.published_at,
    'validationStatus',r.validation_status,
    'validation',r.validation_summary,
    'sources',coalesce((select jsonb_agg(jsonb_build_object(
      'type',s.source_type,'filename',s.filename,'sha256',s.sha256,'byteSize',s.byte_size,
      'detectedReportDate',s.detected_report_date,'sheetCount',s.source_sheet_count,'pageCount',s.source_page_count,'metadata',s.metadata
    ) order by s.source_type) from public.source_report_files s where s.run_id=v_run),'[]'::jsonb),
    'fnb',jsonb_build_object(
      'summary',(select jsonb_build_object(
        'daily',jsonb_build_object('revenue',f.daily_revenue,'forecast',f.daily_forecast,'variance',f.daily_variance,'covers',f.daily_covers,'coverForecast',f.daily_cover_forecast,'food',f.daily_food_revenue,'foodForecast',f.daily_food_forecast,'beverage',f.daily_beverage_revenue,'beverageForecast',f.daily_beverage_forecast,'other',f.daily_other_revenue,'otherForecast',f.daily_other_forecast,'otherDiscount',f.daily_other_discount),
        'mtd',jsonb_build_object('revenue',f.mtd_revenue,'forecast',f.mtd_forecast,'variance',f.mtd_variance,'covers',f.mtd_covers,'coverForecast',f.mtd_cover_forecast,'food',f.mtd_food_revenue,'foodForecast',f.mtd_food_forecast,'beverage',f.mtd_beverage_revenue,'beverageForecast',f.mtd_beverage_forecast,'other',f.mtd_other_revenue,'otherForecast',f.mtd_other_forecast,'otherDiscount',f.mtd_other_discount),
        'validation',f.validation
      ) from public.fnb_daily_summary f where f.run_id=v_run),
      'outlets',coalesce((select jsonb_agg(jsonb_build_object(
        'key',o.outlet_key,'label',o.outlet_label,'revenue',o.revenue,'forecast',o.forecast,'variance',o.variance,'covers',o.covers,
        'foodGross',o.food_gross,'foodDiscount',o.food_discount,'foodNet',o.food_net,'nonAlcoholGross',o.non_alcohol_gross,'nonAlcoholDiscount',o.non_alcohol_discount,
        'beverageGross',o.beverage_gross,'beverageDiscount',o.beverage_discount,'beverageNet',o.beverage_net,'other',o.other_revenue,'otherDiscount',o.other_discount,
        'validation',o.validation,
        'dayparts',coalesce((select jsonb_agg(jsonb_build_object('key',d.daypart_key,'label',d.daypart_label,'covers',d.covers,'amenities',d.amenity_count,'contactlessOrders',d.contactless_order_count,'foodGross',d.food_gross,'foodDiscount',d.food_discount,'foodNet',d.food_net,'nonAlcoholGross',d.non_alcohol_gross,'nonAlcoholDiscount',d.non_alcohol_discount,'beverageGross',d.beverage_gross,'beverageDiscount',d.beverage_discount,'beverageNet',d.beverage_net,'other',d.other_revenue,'otherDiscount',d.other_discount,'revenue',d.net_revenue) order by d.display_order) from public.fnb_outlet_daypart d where d.run_id=v_run and d.outlet_key=o.outlet_key),'[]'::jsonb)
      ) order by o.display_order) from public.fnb_outlet_daily o where o.run_id=v_run),'[]'::jsonb),
      'notes',coalesce((select jsonb_agg(jsonb_build_object('outletKey',n.outlet_key,'outlet',n.outlet_label,'daypartKey',n.daypart_key,'daypart',n.daypart_label,'rawText',n.raw_text,'displayText',n.display_text,'sourceCell',n.source_cell) order by n.outlet_key,n.daypart_key) from public.fnb_operational_notes n where n.run_id=v_run),'[]'::jsonb)
    ),
    'rooms',jsonb_build_object(
      'months',coalesce((select jsonb_agg(jsonb_build_object(
        'stayMonth',m.stay_month,'sourcePage',m.source_page,
        'pickup',jsonb_build_object('rns',m.pickup_rns,'adr',m.pickup_adr,'revenue',m.pickup_revenue),
        'otb',jsonb_build_object('rns',m.otb_rns,'adr',m.otb_adr,'revenue',m.otb_revenue,'occupancy',m.occupancy_otb,'revpar',m.revpar_otb),
        'forecast',jsonb_build_object('rns',m.forecast_rns,'adr',m.forecast_adr,'revenue',m.forecast_revenue,'occupancy',m.occupancy_forecast,'revpar',m.revpar_forecast),
        'budget',jsonb_build_object('rns',m.budget_rns,'adr',m.budget_adr,'revenue',m.budget_revenue,'occupancy',m.occupancy_budget,'revpar',m.revpar_budget),
        'stly',jsonb_build_object('rns',m.stly_rns,'adr',m.stly_adr,'revenue',m.stly_revenue,'occupancy',m.occupancy_stly,'revpar',m.revpar_stly),
        'lastYear',jsonb_build_object('rns',m.last_year_rns,'adr',m.last_year_adr,'revenue',m.last_year_revenue,'occupancy',m.occupancy_last_year,'revpar',m.revpar_last_year),
        'otbVsStly',jsonb_build_object('rns',m.otb_vs_stly_rns,'adr',m.otb_vs_stly_adr,'revenue',m.otb_vs_stly_revenue),
        'forecastRemaining',jsonb_build_object('rns',m.forecast_remaining_rns,'adr',m.forecast_remaining_adr,'revenue',m.forecast_remaining_revenue,'revenuePerDay',m.forecast_remaining_revenue_per_day),
        'historicalRemainingToActualLy',jsonb_build_object('rns',m.historical_remaining_rns,'adr',m.historical_remaining_adr,'revenue',m.historical_remaining_revenue,'revenuePerDay',m.historical_remaining_revenue_per_day),
        'validation',m.validation
      ) order by m.stay_month) from public.rooms_monthly_summary m where m.run_id=v_run),'[]'::jsonb),
      'segments',coalesce((select jsonb_agg(jsonb_build_object(
        'stayMonth',s.stay_month,'key',s.segment_key,'label',s.segment_label,'code',s.segment_code,'parentKey',s.parent_segment_key,'level',s.hierarchy_level,'isSubtotal',s.is_subtotal,'isGrandTotal',s.is_grand_total,'includedInGrandTotal',s.included_in_grand_total,
        'pickup',jsonb_build_object('rns',s.pickup_rns,'adr',s.pickup_adr,'revenue',s.pickup_revenue),
        'otb',jsonb_build_object('rns',s.otb_rns,'adr',s.otb_adr,'revenue',s.otb_revenue),
        'forecast',jsonb_build_object('rns',s.forecast_rns,'adr',s.forecast_adr,'revenue',s.forecast_revenue),
        'budget',jsonb_build_object('rns',s.budget_rns,'adr',s.budget_adr,'revenue',s.budget_revenue),
        'stly',jsonb_build_object('rns',s.stly_rns,'adr',s.stly_adr,'revenue',s.stly_revenue),
        'lastYear',jsonb_build_object('rns',s.last_year_rns,'adr',s.last_year_adr,'revenue',s.last_year_revenue),
        'forecastRemaining',jsonb_build_object('rns',s.forecast_remaining_rns,'adr',s.forecast_remaining_adr,'revenue',s.forecast_remaining_revenue),
        'validation',s.validation
      ) order by s.stay_month,s.display_order) from public.rooms_market_segment s where s.run_id=v_run),'[]'::jsonb)
    ),
    'flags',coalesce((select jsonb_agg(jsonb_build_object('domain',f.domain,'scopeKey',f.scope_key,'metricKey',f.metric_key,'severity',f.severity,'title',f.title,'detail',f.detail,'ruleKey',f.rule_key,'payload',f.payload) order by f.sort_order) from public.business_dashboard_flags f where f.run_id=v_run),'[]'::jsonb),
    'rules',coalesce((select jsonb_object_agg(x.key,x.config) from public.business_dashboard_rules x where x.active=true),'{}'::jsonb)
  ) into v_result
  from public.business_report_runs r
  join public.business_dashboard_publications p on p.run_id=r.id
  where r.id=v_run;

  return v_result;
end;
$$;

revoke all on function public.sindhorn_business_dashboard_read_model(date) from public, anon;
grant execute on function public.sindhorn_business_dashboard_read_model(date) to authenticated, service_role;
