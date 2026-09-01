import assert from 'node:assert/strict';
import {BETTA_DAY_PERIODS,BANGKOK_TIME_ZONE,DAY_CYCLE_CHECK_MS,DAY_CYCLE_ROLLOVER_MS,DAY_CYCLE_CORRECTION_MS,easeDayCycle,periodForMinuteOfDay} from './betta-day-periods.js';
import {BETTA_PRESETS} from './betta-fin-presets.js';

assert.equal(BANGKOK_TIME_ZONE,'Asia/Bangkok');
assert.equal(BETTA_DAY_PERIODS.length,8);
assert.equal(DAY_CYCLE_CHECK_MS,30000);assert.equal(DAY_CYCLE_ROLLOVER_MS,60000);assert.equal(DAY_CYCLE_CORRECTION_MS,900);
const expected=[
  ['midnight',0,'reference1',1],['before-dawn',3,'reference2',2],['first-light',6,'reference3',3],['bright-morning',9,'reference4',4],['midday',12,'reference5',5],['afternoon',15,'reference6',6],['golden-hour',18,'reference7',7],['blue-hour',21,'reference8',8]
];
for(let i=0;i<expected.length;i++){const [key,start,baseline,referenceId]=expected[i],p=BETTA_DAY_PERIODS[i];assert.equal(p.key,key);assert.equal(p.startHour,start);assert.equal(p.baseline,baseline);assert.equal(p.referenceId,referenceId);assert.equal(BETTA_PRESETS[baseline].referenceId,referenceId)}
for(const p of BETTA_DAY_PERIODS){assert.ok(BETTA_PRESETS[p.baseline]);assert.ok(BETTA_PRESETS[p.baseline].params.rayCount>=56);assert.ok(BETTA_PRESETS[p.baseline].params.rayCount<=80)}
assert.equal(periodForMinuteOfDay(0).key,'midnight');assert.equal(periodForMinuteOfDay(180).key,'before-dawn');assert.equal(periodForMinuteOfDay(360).key,'first-light');assert.equal(periodForMinuteOfDay(720).key,'midday');assert.equal(periodForMinuteOfDay(1080).key,'golden-hour');assert.equal(periodForMinuteOfDay(1439).key,'blue-hour');
assert.equal(easeDayCycle(0),0);assert.equal(easeDayCycle(1),1);assert.ok(easeDayCycle(.5)>.5);
console.log('Reference-tail day-cycle contract PASS');
