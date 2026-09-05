/* Per-period readability at release (IDUI enforcement check 5, r29c).

   The Readability Test saves a Betta style for a period only after Ink,
   Muted and Accent clear 4.5:1 on the rendered frame, and the server refuses
   anything less (sindhorn_betta_period_save_v1). So a saved row passes by
   construction; what can still go wrong at release is the code around it:
   the randomizer changes and a saved seed no longer draws the fish that was
   measured, a period key disappears, or the read RPC stops answering
   anonymously and every launch falls back to the bundled fish. This gate
   reads the live map the way a phone does - the anon read, the publishable
   key from auth-client.js, no credential - and checks each saved style
   against the current code: the seed is well-formed, the period exists, and
   generateBettaStyle(baseline, seed) reproduces the saved style. Periods
   without a saved style are reported; with --require-all they fail, the
   setting for the day all eight are saved.

     node scripts/betta-periods-release-smoke.mjs
     node scripts/betta-periods-release-smoke.mjs --require-all */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {BETTA_DAY_PERIODS} from '../site/betta-day-periods.js';
import {generateBettaStyle} from '../site/betta-random.js';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const requireAll=process.argv.includes('--require-all');
const client=readFileSync(join(root,'site/auth-client.js'),'utf8');
const url=client.match(/const SUPABASE_URL='([^']+)'/)?.[1];
const key=client.match(/const SUPABASE_KEY='([^']+)'/)?.[1];
if(!url||!key){console.error('auth-client.js: SUPABASE_URL or SUPABASE_KEY not found');process.exit(1)}

/* BETTA_PERIODS_FIXTURE=<file> judges a saved JSON map instead of the live
   one, so the checks themselves can be exercised without a save. */
async function liveStyles(){
  if(process.env.BETTA_PERIODS_FIXTURE)return JSON.parse(readFileSync(process.env.BETTA_PERIODS_FIXTURE,'utf8'));
  const response=await fetch(`${url}/rest/v1/rpc/sindhorn_betta_periods_v1`,{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:'{}'});
  const body=await response.json().catch(()=>null);
  if(!response.ok||!body?.ok){console.error(`sindhorn_betta_periods_v1: HTTP ${response.status} ${JSON.stringify(body)}`);process.exit(1)}
  return body.styles&&typeof body.styles==='object'?body.styles:{};
}
const styles=await liveStyles();

/* Numbers are compared with a small tolerance: jsonb keeps every digit, but
   a float that went through the page's JSON and back deserves the slack. */
function same(a,b){
  if(typeof a==='number'&&typeof b==='number')return Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b));
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]));
  if(a&&b&&typeof a==='object'&&typeof b==='object'){const ka=Object.keys(a).sort(),kb=Object.keys(b).sort();return ka.length===kb.length&&ka.every((k,i)=>k===kb[i]&&same(a[k],b[k]))}
  return a===b;
}

const failures=[],rows=[];
for(const key of Object.keys(styles))if(!BETTA_DAY_PERIODS.some(p=>p.key===key))failures.push(`${key}: saved style for a period the app no longer has`);
for(const period of BETTA_DAY_PERIODS){
  const style=styles[period.key];
  if(!style){rows.push({period:period.key,saved:false});if(requireAll)failures.push(`${period.key}: no saved style`);continue}
  const seed=String(style.seed??'');
  if(!/^[0-9]{1,20}$/.test(seed)){failures.push(`${period.key}: seed "${seed}" is not a decimal uint64`);rows.push({period:period.key,saved:true,seed,reproducible:false});continue}
  const drawn=generateBettaStyle(period.baseline,BigInt(seed));
  const reproducible=Boolean(drawn)&&same(drawn,style);
  if(!reproducible)failures.push(`${period.key}: seed ${seed} no longer draws the saved fish - the randomizer changed after the save; re-run the Readability Test for this period`);
  rows.push({period:period.key,saved:true,seed,reproducible});
}

const saved=rows.filter(r=>r.saved).length;
console.log(JSON.stringify({ok:failures.length===0,periods:rows.length,saved,unsaved:rows.length-saved,requireAll,rows}));
if(failures.length){console.error('Betta periods release gate FAILED:');for(const f of failures)console.error('  '+f);process.exit(1)}
