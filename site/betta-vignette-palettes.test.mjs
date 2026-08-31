import assert from 'node:assert/strict';
import {BETTA_PRESETS} from './betta-fin-presets.js';
import {BETTA_DAY_PERIODS} from './betta-day-periods.js';
import {VIGNETTE_GRADES,VIGNETTE_SELECTED_BY_PERIOD,applyVignetteGrade} from './betta-vignette-palettes.js';
const keys=Object.keys(BETTA_PRESETS);assert.equal(keys.length,8);
for(const key of keys){const p=BETTA_PRESETS[key];assert.equal(p.referenceId,Number(key.replace('reference','')));assert.equal(p.palette.length,4);assert.ok(p.params.spread>=3.2&&p.params.spread<=4.5);assert.ok(p.params.foldDensity>=5&&p.params.foldDensity<=6.4)}
const snapshot=structuredClone(BETTA_PRESETS);
for(const gradeKey of ['a','b','selected']){const working=structuredClone(BETTA_PRESETS);applyVignetteGrade(working,gradeKey);for(const key of keys){assert.deepEqual(working[key].params,snapshot[key].params,`${gradeKey}/${key} preserves tail morphology`);assert.equal(working[key].background,snapshot[key].background,`${gradeKey}/${key} preserves background`);assert.equal(working[key].palette.length,4)}}
assert.deepEqual(Object.keys(VIGNETTE_SELECTED_BY_PERIOD).sort(),BETTA_DAY_PERIODS.map(p=>p.key).sort());
for(const period of BETTA_DAY_PERIODS){const grade=VIGNETTE_SELECTED_BY_PERIOD[period.key];assert.deepEqual(VIGNETTE_GRADES.selected.palettes[period.baseline],VIGNETTE_GRADES[grade].palettes[period.baseline])}
console.log('Reference-tail palette contract PASS');
