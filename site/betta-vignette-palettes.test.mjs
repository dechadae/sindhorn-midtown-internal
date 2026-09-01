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
  assert.ok(p.params.scale>=.70&&p.params.scale<=1.30,`${key} stays inside approved camera-editor scale range`);
  assert.ok(Math.abs(p.params.rotationX)<=1.25,`${key} x rotation stays inside editor range`);
  assert.ok(Math.abs(p.params.rotationY)<=1.25,`${key} y rotation stays inside editor range`);
  assert.ok(p.params.tiltStrength>=.15&&p.params.tiltStrength<=.24,`${key} has bounded device tilt response`);
  assert.ok(p.params.offsetX>=-2.6&&p.params.offsetX<=2.6,`${key} x position stays inside editor range`);
  assert.ok(p.params.offsetY>=-2.2&&p.params.offsetY<=2.2,`${key} y position stays inside editor range`);
  assert.ok(p.params.cameraDepth>=-.5&&p.params.cameraDepth<=.8,`${key} z position stays inside editor range`);
  assert.ok(Math.abs(p.params.rotation)<=3.14,`${key} z rotation stays inside editor range`);
  assert.ok(p.params.brightness>=1.6,`${key} compensates old shader darkness`);
  assert.ok(p.params.opacity>=.48,`${key} remains visibly colored`);
}

assert.deepEqual(BETTA_DAY_PERIODS.map(p=>p.referenceId),[1,2,3,4,5,6,7,8]);
assert.deepEqual(BETTA_DAY_PERIODS.map(p=>p.baseline),['reference1','reference2','reference3','reference4','reference5','reference6','reference7','reference8']);

const expectedCamera={
  reference1:{offsetX:1.88,offsetY:-.80,cameraDepth:.10,scale:1.11,rotationX:.09,rotationY:-.61,rotation:3.14},
  reference2:{offsetX:-1.90,offsetY:-.48,cameraDepth:.80,scale:.92,rotationX:.24,rotationY:-.53,rotation:-.22},
  reference3:{offsetX:1.98,offsetY:-.64,cameraDepth:.04,scale:.97,rotationX:-.42,rotationY:.71,rotation:2.29},
  reference4:{offsetX:-1.76,offsetY:-.36,cameraDepth:.12,scale:1.26,rotationX:-.51,rotationY:.54,rotation:-.03},
  reference5:{offsetX:2.16,offsetY:.16,cameraDepth:.08,scale:1.06,rotationX:-.52,rotationY:.17,rotation:-3.14},
  reference6:{offsetX:-1.62,offsetY:-.58,cameraDepth:.09,scale:1.02,rotationX:.38,rotationY:-.18,rotation:.30},
  reference7:{offsetX:-1.86,offsetY:.26,cameraDepth:.11,scale:1.00,rotationX:.41,rotationY:-.32,rotation:-.89},
  reference8:{offsetX:1.84,offsetY:.18,cameraDepth:.10,scale:1.06,rotationX:.30,rotationY:-.56,rotation:-3.14}
};

for(const [key,expected] of Object.entries(expectedCamera)){
  const actual=BETTA_PRESETS[key].params;
  for(const [field,value] of Object.entries(expected))assert.equal(actual[field],value,`${key} ${field} matches the user-saved final camera composition`);
}

assert.equal(BETTA_PRESETS.reference5.morphMode,1,'Fish #5 keeps multicolor koi patch mode');
assert.equal(BETTA_PRESETS.reference6.morphMode,4,'Fish #6 exposes pale ray ridges');
assert.equal(BETTA_PRESETS.reference8.morphMode,4,'Fish #8 exposes electric blue ray ridges');
console.log('Final Betta user-saved camera composition contract PASS');
