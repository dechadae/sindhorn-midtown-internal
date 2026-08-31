import assert from 'node:assert/strict';
import {BETTA_PRESETS} from './betta-fin-presets.js';
import {BETTA_DAY_PERIODS} from './betta-day-periods.js';

const keys=Object.keys(BETTA_PRESETS);
assert.equal(keys.length,8);
for(const key of keys){
  const p=BETTA_PRESETS[key];
  assert.equal(p.referenceId,Number(key.replace('reference','')));
  assert.equal(p.palette.length,4);
  assert.ok(p.params.spread>=2.6&&p.params.spread<=3.5,`${key} fan angle stays reference-scaled`);
  assert.ok(p.params.foldDensity>=8&&p.params.foldDensity<=12,`${key} keeps fine ray rhythm`);
  assert.ok(p.params.scale>=.70&&p.params.scale<=1.08,`${key} stays inside editorial live-wallpaper crop scale`);
  assert.ok(Math.abs(p.params.rotationX)>=.18&&Math.abs(p.params.rotationX)<=.42,`${key} has deliberate x-axis perspective`);
  assert.ok(Math.abs(p.params.rotationY)>=.24&&Math.abs(p.params.rotationY)<=.62,`${key} has deliberate y-axis perspective`);
  assert.ok(p.params.tiltStrength>=.15&&p.params.tiltStrength<=.24,`${key} has bounded device tilt response`);
  assert.ok(p.params.offsetX>=-1.85&&p.params.offsetX<=.40,`${key} stays inside the approved asymmetric x crop envelope`);
  assert.ok(p.params.offsetY>=-1.25&&p.params.offsetY<=1.00,`${key} stays inside the approved asymmetric y crop envelope`);
  assert.ok(Math.abs(p.params.rotation)>=.10&&Math.abs(p.params.rotation)<=.48,`${key} keeps a deliberate diagonal wallpaper angle`);
  assert.ok(p.params.brightness>=1.6,`${key} compensates old shader darkness`);
  assert.ok(p.params.opacity>=.48,`${key} remains visibly colored`);
}
assert.deepEqual(BETTA_DAY_PERIODS.map(p=>p.referenceId),[1,2,3,4,5,6,7,8]);
assert.deepEqual(BETTA_DAY_PERIODS.map(p=>p.baseline),['reference1','reference2','reference3','reference4','reference5','reference6','reference7','reference8']);
assert.ok(BETTA_PRESETS.reference1.params.offsetX>.3&&BETTA_PRESETS.reference1.params.offsetY<-1,'Midnight drops into the lower-right and leaves a quiet upper-left field');
assert.ok(BETTA_PRESETS.reference2.params.offsetX<-1.5&&BETTA_PRESETS.reference2.params.offsetY<-1,'Before Dawn approved aggressive corner crop remains unchanged');
assert.ok(BETTA_PRESETS.reference3.params.offsetX<-1.6&&BETTA_PRESETS.reference3.params.offsetY>.4,'First Light now enters from the left edge');
assert.ok(BETTA_PRESETS.reference4.params.offsetX<-1.2&&BETTA_PRESETS.reference4.params.scale>.9&&BETTA_PRESETS.reference4.params.rotation>0&&BETTA_PRESETS.reference4.params.rotationY<0,'Bright Morning is mirrored to the opposite side and enlarged slightly');
assert.ok(BETTA_PRESETS.reference5.params.scale>1,'Midday approved macro texture crop remains unchanged');
assert.ok(BETTA_PRESETS.reference6.params.offsetX<-1.6&&BETTA_PRESETS.reference6.params.offsetY>.7,'Afternoon sweeps from the upper-left');
assert.ok(BETTA_PRESETS.reference7.params.offsetX>.3&&BETTA_PRESETS.reference7.params.offsetY<-.5&&BETTA_PRESETS.reference7.params.scale>=1,'Golden Hour keeps its lower-right crescent and is enlarged');
assert.equal(BETTA_PRESETS.reference8.params.scale,.84,'Blue Hour approved crop scale remains unchanged');
assert.equal(BETTA_PRESETS.reference8.params.offsetX,-1.06,'Blue Hour approved horizontal crop remains unchanged');
assert.equal(BETTA_PRESETS.reference8.params.offsetY,-.20,'Blue Hour approved vertical crop remains unchanged');
assert.equal(BETTA_PRESETS.reference5.morphMode,1,'Fish #5 keeps multicolor koi patch mode');
assert.equal(BETTA_PRESETS.reference6.morphMode,4,'Fish #6 exposes pale ray ridges');
assert.equal(BETTA_PRESETS.reference8.morphMode,4,'Fish #8 exposes electric blue ray ridges');
console.log('Final Betta revised editorial crop contract PASS');
