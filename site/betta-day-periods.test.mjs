import assert from 'node:assert/strict';
import {BETTA_DAY_PERIODS,BANGKOK_TIME_ZONE,DAY_CYCLE_CHECK_MS,DAY_CYCLE_ROLLOVER_MS,DAY_CYCLE_CORRECTION_MS,easeDayCycle,periodForMinuteOfDay,periodForBangkokTime} from './betta-day-periods.js';
import {BETTA_PRESETS,BETTA_LUMINOSITY_STANDARD} from './betta-fin-presets.js';

assert.equal(BANGKOK_TIME_ZONE,'Asia/Bangkok');
assert.equal(BETTA_DAY_PERIODS.length,8);
assert.equal(DAY_CYCLE_CHECK_MS,30000);
assert.equal(DAY_CYCLE_ROLLOVER_MS,60000);
assert.equal(DAY_CYCLE_CORRECTION_MS,900);
const expected=[
  ['midnight',0,'blackOrchid','dark'],['before-dawn',3,'copperMetallic','dark'],['first-light',6,'turquoiseMetallic','bright'],['bright-morning',9,'royalBlueHalfmoon','bright'],['midday',12,'redSnowDragon','bright'],['afternoon',15,'mustardGas','bright'],['golden-hour',18,'nemoGalaxyKoi','dark'],['blue-hour',21,'superRedHalfmoon','dark']
];
for(let i=0;i<expected.length;i++){const [key,start,baseline,tone]=expected[i],p=BETTA_DAY_PERIODS[i];assert.equal(p.key,key);assert.equal(p.startHour,start);assert.equal(p.baseline,baseline);assert.equal(p.tone,tone);assert.ok(BETTA_PRESETS[baseline]);}
const cases=[[0,'midnight'],[179,'midnight'],[180,'before-dawn'],[359,'before-dawn'],[360,'first-light'],[539,'first-light'],[540,'bright-morning'],[719,'bright-morning'],[720,'midday'],[899,'midday'],[900,'afternoon'],[1079,'afternoon'],[1080,'golden-hour'],[1259,'golden-hour'],[1260,'blue-hour'],[1439,'blue-hour']];
for(const [minute,key] of cases)assert.equal(periodForMinuteOfDay(minute).key,key,`${minute} -> ${key}`);
assert.equal(periodForMinuteOfDay(-1).key,'blue-hour');
assert.equal(periodForMinuteOfDay(1440).key,'midnight');
assert.equal(periodForBangkokTime(new Date('2026-08-30T23:00:00Z')).key,'first-light'); // 06:00 Bangkok
for(const period of BETTA_DAY_PERIODS){const expectedTone=period.startHour>=6&&period.startHour<18?'bright':'dark';assert.equal(period.tone,expectedTone,`${period.key} tone`);}
const luxuryCaps={edgeFlutter:.08,currentStrength:.28,motionSpeed:.44,turbulence:.22,motionAmplitude:.5,foldDensity:5.4,curl:.68,depth:.74};
for(const [key,preset] of Object.entries(BETTA_PRESETS))for(const [param,max] of Object.entries(luxuryCaps))assert.ok(preset.params[param]<=max,`${key}.${param} ${preset.params[param]} <= ${max}`);
assert.equal(BETTA_LUMINOSITY_STANDARD.source,'Nemo Galaxy Koi pre-luxury-cycle');
assert.deepEqual({brightness:BETTA_LUMINOSITY_STANDARD.brightness,opacity:BETTA_LUMINOSITY_STANDARD.opacity,transmission:BETTA_LUMINOSITY_STANDARD.transmission,bloom:BETTA_LUMINOSITY_STANDARD.bloom},{brightness:.96,opacity:.42,transmission:.70,bloom:.34});
const nemo=BETTA_PRESETS.nemoGalaxyKoi;
assert.deepEqual(nemo.palette,['#1679b8','#b92b1c','#ee8e2e','#f1e7d7']);
for(const key of ['brightness','opacity','transmission','bloom'])assert.equal(nemo.params[key],BETTA_LUMINOSITY_STANDARD[key],`Nemo ${key} preserves luminosity standard`);
for(const period of BETTA_DAY_PERIODS){const brightness=BETTA_PRESETS[period.baseline].params.brightness;if(period.tone==='bright')assert.ok(brightness>=1.08,`${period.key} vivid brightness`);else{assert.ok(brightness>=BETTA_LUMINOSITY_STANDARD.brightness,`${period.key} meets Nemo visibility floor`);assert.ok(brightness<=1.0,`${period.key} remains nocturnal`);}}
assert.equal(easeDayCycle(0),0);assert.equal(easeDayCycle(1),1);assert.ok(easeDayCycle(.5)>.5);let last=0;for(let i=1;i<=100;i++){const next=easeDayCycle(i/100);assert.ok(next>=last);last=next;}
console.log('Betta day-cycle contract PASS');
