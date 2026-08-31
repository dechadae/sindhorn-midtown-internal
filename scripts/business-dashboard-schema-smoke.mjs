import fs from 'node:fs';

const files={
  foundation:'supabase/migrations/20260830151557_daily_business_dashboard_foundation.sql',
  flags:'supabase/migrations/20260830151616_daily_business_dashboard_flag_builder.sql',
  readModel:'supabase/migrations/20260830151646_daily_business_dashboard_read_model.sql',
  fkIndexes:'supabase/migrations/20260831050000_daily_business_dashboard_fk_indexes.sql'
};
const sql=Object.fromEntries(Object.entries(files).map(([key,path])=>[key,fs.readFileSync(path,'utf8')]));
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

for(const table of[
  'business_report_runs','source_report_files','fnb_daily_summary','fnb_outlet_daily','fnb_outlet_daypart','fnb_operational_notes','rooms_monthly_summary','rooms_market_segment','business_dashboard_rules','business_dashboard_flags','business_dashboard_publications'
])assert(sql.foundation.includes(`create table public.${table}`),`Foundation migration missing ${table}`);

for(const table of[
  'business_report_runs','source_report_files','fnb_daily_summary','fnb_outlet_daily','fnb_outlet_daypart','fnb_operational_notes','rooms_monthly_summary','rooms_market_segment','business_dashboard_rules','business_dashboard_flags','business_dashboard_publications'
]){
  assert(sql.foundation.includes(`alter table public.${table} enable row level security`),`RLS missing for ${table}`);
  assert(sql.foundation.includes(`revoke all on table public.${table} from anon, authenticated`),`Direct employee grants not revoked for ${table}`);
}

assert(!sql.foundation.includes('fnb_auxiliary_metrics'),'Stale prototype auxiliary table must not return');
assert(sql.foundation.includes("'business_dashboard.read'"),'Dashboard read capability missing');
assert(sql.foundation.includes("'business_data.manage'"),'Business data management capability missing');
assert(sql.flags.includes('create or replace function public.sindhorn_business_rebuild_flags'),'Flag builder migration missing function');
assert(sql.flags.includes('revoke all on function public.sindhorn_business_rebuild_flags(uuid) from public, anon, authenticated'),'Flag builder must not be executable by ordinary employees');
assert(sql.readModel.includes('create or replace function public.sindhorn_business_dashboard_read_model'),'Read-model migration missing RPC');
assert(sql.readModel.includes("sindhorn_has_capability('business_dashboard.read')"),'Read model must enforce capability authority');
assert(sql.readModel.includes('grant execute on function public.sindhorn_business_dashboard_read_model(date) to authenticated, service_role'),'Authenticated app must receive only the read-model RPC');
assert(sql.fkIndexes.includes('business_dashboard_flags_rule_key_idx'),'Rule foreign key must have a covering index');
assert(sql.fkIndexes.includes('on public.business_dashboard_flags(rule_key)'),'Rule index must cover rule_key');
assert(sql.fkIndexes.includes('business_dashboard_publications_supersedes_run_idx'),'Superseded publication foreign key must have a covering index');
assert(sql.fkIndexes.includes('on public.business_dashboard_publications(supersedes_run_id)'),'Supersession index must cover supersedes_run_id');

const forbiddenDataInserts=[
  'insert into public.fnb_daily_summary',
  'insert into public.fnb_outlet_daily',
  'insert into public.fnb_outlet_daypart',
  'insert into public.fnb_operational_notes',
  'insert into public.rooms_monthly_summary',
  'insert into public.rooms_market_segment',
  'insert into public.source_report_files',
  'insert into public.business_report_runs',
  'insert into public.business_dashboard_publications'
];
for(const fragment of forbiddenDataInserts)assert(!sql.foundation.toLowerCase().includes(fragment),`Historical schema migration must remain data-free: ${fragment}`);

console.log(JSON.stringify({ok:true,migrations:Object.values(files),contracts:{historicalVersionsRestored:true,dataFree:true,rlsClosed:true,capabilityReadModel:true,foreignKeysCovered:true}}));
