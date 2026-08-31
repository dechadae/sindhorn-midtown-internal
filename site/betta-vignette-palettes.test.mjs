import assert from 'node:assert/strict';
import {BETTA_PRESETS} from './betta-fin-presets.js';
import {VIGNETTE_GRADES,applyVignetteGrade} from './betta-vignette-palettes.js';

const presetKeys=Object.keys(BETTA_PRESETS);
assert.equal(presetKeys.length,8,'exactly eight canonical Betta presets');
const motionKeys=['spread','foldDensity','curl','twist','edgeFlutter','depth','currentStrength','motionSpeed','turbulence','motionAmplitude','scale','rotation','cameraDepth','offsetX','offsetY'];
const opticalKeys=['opacity','transmission','rimStrength','foldHighlight','iridescence','bloom','saturation','brightness','gradientPosition'];
const snapshots=Object.fromEntries(presetKeys.map(key=>[key,{background:BETTA_PRESETS[key].background,params:structuredClone(BETTA_PRESETS[key].params),palette:[...BETTA_PRESETS[key].palette]}]));
const hex=/^#[0-9a-f]{6}$/i;
const rgb=value=>[1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
const average=palette=>palette.map(rgb).reduce((sum,c)=>sum.map((v,i)=>v+c[i]),[0,0,0]).map(v=>v/palette.length);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

for(const gradeKey of ['a','b']){
  const grade=VIGNETTE_GRADES[gradeKey];
  assert.ok(grade,`grade ${gradeKey} exists`);
  assert.deepEqual(Object.keys(grade.palettes).sort(),[...presetKeys].sort(),`grade ${gradeKey} covers all eight fish`);
  const signatures=new Set();
  const centers={};
  for(const key of presetKeys){
    const palette=grade.palettes[key];
    assert.equal(palette.length,4,`${gradeKey}/${key} has four palette stops`);
    palette.forEach(value=>assert.match(value,hex,`${gradeKey}/${key} valid hex`));
    const signature=palette.join('|').toLowerCase();
    assert.ok(!signatures.has(signature),`${gradeKey}/${key} palette is unique`);
    signatures.add(signature);
    centers[key]=average(palette);
  }
  for(let i=0;i<presetKeys.length;i++)for(let j=i+1;j<presetKeys.length;j++){
    const a=presetKeys[i],b=presetKeys[j],d=distance(centers[a],centers[b]);
    assert.ok(d>=40,`${gradeKey}: ${a} and ${b} remain visually separated (${d.toFixed(1)})`);
  }

  const working=structuredClone(BETTA_PRESETS);
  applyVignetteGrade(working,gradeKey);
  for(const key of presetKeys){
    assert.equal(working[key].background,snapshots[key].background,`${gradeKey}/${key} background remains byte-identical`);
    for(const param of [...motionKeys,...opticalKeys])assert.equal(working[key].params[param],snapshots[key].params[param],`${gradeKey}/${key} preserves ${param}`);
    assert.deepEqual(working[key].palette,[...grade.palettes[key]],`${gradeKey}/${key} applies only the intended palette`);
  }
}

console.log('Cool Vignette palette contract passed: 8 distinct fish, unchanged dark backgrounds, unchanged motion and approved optical values.');
