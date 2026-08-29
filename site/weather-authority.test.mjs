import assert from 'node:assert/strict';
import {resolveWeatherAuthority,classifyRainRate,locationKey,effectiveWeatherSnapshot,TMD_RAIN_NOW_STALE_MS} from './weather-authority.js';
const now=Date.parse('2026-08-29T16:39:07Z');
const weather=(over={})=>({weatherCode:3,precipitationMm:0,rainMm:0,showersMm:0,observedAt:'2026-08-29T16:38:00Z',...over});
const tmd=(over={})=>({ok:true,status:'ok',available:true,provider:'tmd-aws',observedAt:'2026-08-29T16:38:00Z',rainNow:true,rainIntensityMmHr:.4,precipitationIntensityMmHr:.4,weatherCode:61,...over});
let r=resolveWeatherAuthority({weather:weather(),rainNow:tmd(),nowMs:now});assert.equal(r.active,true);assert.equal(r.authority,'tmd-aws');assert.equal(r.label,'Rain');
let effective=effectiveWeatherSnapshot(weather(),r);assert.equal(effective.precipitationActive,true);assert.equal(effective.weatherCode,61);assert.equal(effective.cloudWeatherCode,3);assert.ok(effective.precipitationMm>=.1);
// Exact regression from 29 Aug: model-style drizzle must not override fresh nearby observed dry.
const falseDrizzle=weather({weatherCode:51,precipitationMm:.1,rainMm:.1,observedAt:'2026-08-29T16:30:00Z'}),freshDry=tmd({rainNow:false,rainIntensityMmHr:0,precipitationIntensityMmHr:0,weatherCode:3});
r=resolveWeatherAuthority({weather:falseDrizzle,rainNow:freshDry,nowMs:now});assert.equal(r.active,false);assert.equal(r.precipitationState,'dry');assert.equal(r.authority,'tmd-aws');assert.equal(r.confidence,'dry-observation');effective=effectiveWeatherSnapshot(falseDrizzle,r);assert.equal(effective.precipitationMm,0);assert.equal(effective.rainMm,0);
// Model/base wet can never activate rain by itself.
r=resolveWeatherAuthority({weather:falseDrizzle,rainNow:{ok:false},nowMs:now});assert.equal(r.active,false);assert.notEqual(r.authority,'open-meteo');
// Fresh dry releases an already-wet state immediately; no seven-minute hysteresis remains.
const started=resolveWeatherAuthority({weather:weather(),rainNow:tmd(),nowMs:now-60_000,locationKey:'a'});assert.equal(started.active,true);
r=resolveWeatherAuthority({weather:weather(),rainNow:freshDry,previous:started.state,nowMs:now,locationKey:'a'});assert.equal(r.active,false);assert.equal(r.authority,'tmd-aws');
// Stale wet observation cannot activate rain.
r=resolveWeatherAuthority({weather:weather(),rainNow:tmd({observedAt:new Date(now-TMD_RAIN_NOW_STALE_MS-60_000).toISOString()}),nowMs:now});assert.equal(r.active,false);assert.equal(r.rainNowStale,true);
// Compatibility argument name still works, but it is only a base-weather label source.
r=resolveWeatherAuthority({openMeteo:falseDrizzle,rainNow:freshDry,nowMs:now});assert.equal(r.active,false);assert.equal(r.openMeteoFresh,false);
assert.equal(classifyRainRate(.05),'dry');assert.equal(classifyRainRate(.2),'possible-drizzle');assert.equal(classifyRainRate(.5),'drizzle');assert.equal(classifyRainRate(2),'rain');assert.equal(classifyRainRate(5),'heavy-rain');
assert.equal(locationKey({latitude:13.74,longitude:100.54}),locationKey({latitude:13.7404,longitude:100.5404}));
console.log('weather authority tests PASS: observation-only rain + immediate dry release + false-drizzle regression');
