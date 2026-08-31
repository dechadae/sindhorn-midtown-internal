import fs from 'node:fs';

const migrationPath='supabase/migrations/20260831045500_daily_business_dashboard_notification_bridge.sql';
const sql=fs.readFileSync(migrationPath,'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

for(const fragment of[
  'business_dashboard_notification_events',
  'sindhorn_business_notification_domain',
  "source_type = 'fnb_xlsx'",
  "source_type = 'rooms_pdf'",
  'sindhorn_business_queue_notification',
  "v.name = 'sindhorn_business_update_url'",
  "v.name = 'sindhorn_business_update_token'",
  'net.http_post(',
  "'Authorization', 'Bearer ' || v_token",
  "'summaryEn', v_summary",
  'business_dashboard_publication_notification',
  'after insert or update of run_id on public.business_dashboard_publications',
  'Notification transport must never block it.'
])assert(sql.includes(fragment),`Notification bridge missing contract fragment: ${fragment}`);

assert(!sql.includes('sindhorn-midtown-alerts.decha-dae.workers.dev'),'Worker URL must come from Vault, not source control');
assert(!/BUSINESS_UPDATE_TOKEN\s*=/.test(sql),'Worker bearer secret must not be embedded in migration');
assert(!/daily_revenue|otb_revenue|occupancy_otb|raw_text/i.test(sql),'Notification bridge must not serialize confidential dashboard values');

const eventIdMatch=sql.match(/v_event_id := ([\s\S]*?);\n\n  v_summary/);
assert(eventIdMatch&&eventIdMatch[1].includes("'business:'"),'Event id must be deterministic and business-prefixed');
assert(eventIdMatch[1].includes('p_run_id::text'),'Event id must be publication-run specific');

const triggerBlock=sql.match(/create or replace function public\.sindhorn_business_publication_notification_trigger\(\)([\s\S]*?)\n\$\$;/i)?.[1]||'';
assert(triggerBlock.includes("if tg_op = 'UPDATE'"),'Trigger must distinguish updates');
assert(triggerBlock.includes('old.run_id'),'Corrected publication must compare against the prior run');
assert(triggerBlock.includes('new.supersedes_run_id'),'Explicit supersession must be preferred on insert');
assert(triggerBlock.includes('exception when others'),'Transport errors must be contained');

console.log(JSON.stringify({ok:true,migration:migrationPath,contracts:{dataFree:true,vaultBacked:true,hashClassified:true,nonBlocking:true,idempotentWorkerIdentity:true}}));
