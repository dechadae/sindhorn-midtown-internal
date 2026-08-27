import {hmacHex} from './security.js';

const WINDOW_SECONDS=15*60;
const MAX_ATTEMPTS=12;
const BLOCK_SECONDS=30*60;

export async function ensureRateSchema(env){
  if(!env.DB)return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_activation_rate_limits (
    key TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    blocked_until INTEGER
  )`).run();
}

export async function consumeActivationAttempt(env,request){
  if(!env.DB)return{allowed:true,remaining:null};
  await ensureRateSchema(env);
  const rawIp=request.headers.get('cf-connecting-ip')||'unknown';
  const key=await hmacHex(env.ACTIVATION_PEPPER,`ip:${rawIp}`);
  const now=Math.floor(Date.now()/1000);
  const row=await env.DB.prepare('SELECT window_start,attempts,blocked_until FROM auth_activation_rate_limits WHERE key=?').bind(key).first();
  if(row?.blocked_until&&Number(row.blocked_until)>now)return{allowed:false,retryAfter:Number(row.blocked_until)-now};
  let windowStart=Number(row?.window_start)||now,attempts=Number(row?.attempts)||0;
  if(now-windowStart>=WINDOW_SECONDS){windowStart=now;attempts=0}
  attempts++;
  const blockedUntil=attempts>MAX_ATTEMPTS?now+BLOCK_SECONDS:null;
  await env.DB.prepare(`INSERT INTO auth_activation_rate_limits(key,window_start,attempts,blocked_until)
    VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,attempts=excluded.attempts,blocked_until=excluded.blocked_until`)
    .bind(key,windowStart,attempts,blockedUntil).run();
  return blockedUntil?{allowed:false,retryAfter:BLOCK_SECONDS}:{allowed:true,remaining:Math.max(0,MAX_ATTEMPTS-attempts)};
}

export async function clearActivationRate(env,request){
  if(!env.DB)return;
  const rawIp=request.headers.get('cf-connecting-ip')||'unknown';
  const key=await hmacHex(env.ACTIVATION_PEPPER,`ip:${rawIp}`);
  await env.DB.prepare('DELETE FROM auth_activation_rate_limits WHERE key=?').bind(key).run();
}
