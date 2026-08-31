const freezeGrade=grade=>Object.freeze(Object.fromEntries(Object.entries(grade).map(([key,value])=>[key,Object.freeze([...value])])));

export const VIGNETTE_GRADES=Object.freeze({
  a:Object.freeze({
    key:'a',
    name:'Vignette A',
    description:'Restrained cool-world grade. Preserves each approved Betta identity and all production luminosity/material/motion values while moving pigment toward sapphire, petrol, blue-violet orchid, rose-pewter, garnet, silver and cool citron.',
    palettes:freezeGrade({
      royalBlueHalfmoon:['#081942','#1a53a6','#3386e4','#b4d5ff'],
      superRedHalfmoon:['#220615','#67133a','#aa285f','#e15d89'],
      mustardGas:['#081a45','#1b52aa','#a8b72a','#e6e46a'],
      blackOrchid:['#050716','#171b42','#4b4d92','#a69ed9'],
      copperMetallic:['#17141a','#4a3445','#99627d','#d1a6bb'],
      turquoiseMetallic:['#063944','#087e89','#39c7bc','#c7f3e8'],
      nemoGalaxyKoi:['#1e6098','#852d61','#d16472','#f5efeb'],
      redSnowDragon:['#f7f9fb','#d4dee7','#a3295a','#e05f83']
    })
  }),
  b:Object.freeze({
    key:'b',
    name:'Vignette B',
    description:'Stronger cool-world grade with luminous pigment separation. Pushes the same eight distinct organisms deeper into indigo, petrol, blue-violet orchid, aubergine, rose-pewter and icy pearl while keeping Mustard Gas as the singular cool-citron exception.',
    palettes:freezeGrade({
      royalBlueHalfmoon:['#070d30','#233b94','#556ade','#c5ccff'],
      superRedHalfmoon:['#1b0412','#511032','#922056','#d84b7b'],
      mustardGas:['#071036','#194293','#86a52a','#d9df5d'],
      blackOrchid:['#0a061e','#401d65','#a259d2','#dbb9f7'],
      copperMetallic:['#17121a','#4b3143','#9a5c7a','#d6a1ba'],
      turquoiseMetallic:['#043944','#087c89','#23c1b8','#c1f2e7'],
      nemoGalaxyKoi:['#2268a4','#91346b','#df6f84','#fff2ec'],
      redSnowDragon:['#f5f8fb','#cbd9e5','#8f2051','#df4f7c']
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
