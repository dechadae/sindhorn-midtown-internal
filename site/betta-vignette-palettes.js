const freezeGrade=grade=>Object.freeze(Object.fromEntries(Object.entries(grade).map(([key,value])=>[key,Object.freeze([...value])])));

export const VIGNETTE_GRADES=Object.freeze({
  a:Object.freeze({
    key:'a',
    name:'Vignette A',
    description:'Restrained cool-world grade. Preserves each approved Betta identity and all production luminosity/material/motion values while moving pigment toward sapphire, petrol, plum, pewter, garnet, silver and cool citron.',
    palettes:freezeGrade({
      royalBlueHalfmoon:['#07173f','#154b9d','#2d7de0','#a7ceff'],
      superRedHalfmoon:['#1c0611','#55102f','#971f55','#d6537e'],
      mustardGas:['#07183f','#174aa0','#9faf29','#d8dc5d'],
      blackOrchid:['#040812','#11172a','#32275a','#777db5'],
      copperMetallic:['#101116','#332e37','#705b69','#b59caa'],
      turquoiseMetallic:['#06343f','#087b86','#35bfb5','#bcefe4'],
      nemoGalaxyKoi:['#174a7d','#68204a','#b74d58','#e7e6e1'],
      redSnowDragon:['#f2f5f7','#c6d1da','#8d214b','#ce4a69']
    })
  }),
  b:Object.freeze({
    key:'b',
    name:'Vignette B',
    description:'Stronger cool-world grade. Pushes the same eight distinct organisms deeper into indigo, petrol, aubergine, rose-pewter and icy pearl while keeping Mustard Gas as the singular cool-citron exception.',
    palettes:freezeGrade({
      royalBlueHalfmoon:['#050b2c','#1a2e86','#4759d4','#b3c1ff'],
      superRedHalfmoon:['#14030f','#3b0a29','#7a1647','#bf3d69'],
      mustardGas:['#050d30','#153687','#779c26','#c8d657'],
      blackOrchid:['#02030a','#0b0d1e','#281a4b','#6268a2'],
      copperMetallic:['#0e0d12','#2a242d','#6f5264','#aa8699'],
      turquoiseMetallic:['#032d37','#006a77','#1daea8','#a8e9de'],
      nemoGalaxyKoi:['#193b70','#55204d','#b0566e','#d9e2e6'],
      redSnowDragon:['#f0f4f7','#b7c5d4','#74163f','#bd315f']
    })
  })
});

export function applyVignetteGrade(presets,gradeKey){
  const grade=VIGNETTE_GRADES[gradeKey];
  if(!grade)return null;
  for(const [key,palette] of Object.entries(grade.palettes)){
    if(!presets[key])throw new Error(`Missing Betta preset: ${key}`);
    presets[key].palette=[...palette];
  }
  return grade;
}
