import assert from 'node:assert/strict';
import {BETTA_DAY_PERIODS,BANGKOK_TIME_ZONE,DAY_CYCLE_CHECK_MS,DAY_CYCLE_ROLLOVER_MS,DAY_CYCLE_CORRECTION_MS,easeDayCycle,periodForMinuteOfDay,periodForBangkokTime} from './betta-day-periods.js';
import {BETTA_PRESETS} from './betta-fin-presets.js';

assert.equal(BANGKOK_TIME_ZONE,'Asia/Bangkok');
assert.equal(BETTA_DAY_PERIODS.length,8);
assert.equal(DAY_CYCLE_CHECK_MS,30000);
assert.equal(DAY_CYCLE_ROLLOVER_MS,60000);
assert.equal(DAY_CYCLE_CORRECTION_MS,900);
const expected=[
  ['midnight',0,'blackOrchid'],['before-dawn',3,'redSnowDragon'],['first-light',6,'mustardGas'],['bright-morning',9,'turquoiseMetallic'],['midday',12,'royalBlueHalfmoon'],['afternoon',15,'copperMetallic'],['golden-hour',18,'nemoGalaxyKoi'],['blue-hour',21,'superRedHalfmoon']
];
for(let i=0;i<expected.length;i++){const [key,start,baseline]=expected[i],p=BETTA_DAY_PERIODS[i];assert.equal(p.key,key);assert.equal(p.startHour,start);assert.equal(p.baseline,baseline);assert.ok(BETTA_PRESETS[baseline]);}
const cases=[[0,'midnight'],[179,'midnight'],[180,'before-dawn'],[359,'before-dawn'],[360,'first-light'],[539,'first-light'],[540,'bright-morning'],[719,'bright-morning'],[720,'midday'],[899,'midday'],[900,'afternoon'],[1079,'afternoon'],[1080,'golden-hour'],[1259,'golden-hour'],[1260,'blue-hour'],[1439,'blue-hour']];
for(const [minute,key] of cases)assert.equal(periodForMinuteOfDay(minute).key,key,`${minute} -> ${key}`);
assert.equal(periodForMinuteOfDay(-1).key,'blue-hour');
assert.equal(periodForMinuteOfDay(1440).key,'midnight');
assert.equal(periodForBangkokTime(new Date('2026-08-30T23:00:00Z')).key,'first-light'); // 06:00 Bangkok
assert.equal(easeDayCycle(0),0);assert.equal(easeDayCycle(1),1);assert.ok(easeDayCycle(.5)>.5);let last=0;for(let i=1;i<=100;i++){const next=easeDayCycle(i/100);assert.ok(next>=last);last=next;}
console.log('Betta day-cycle contract PASS');
