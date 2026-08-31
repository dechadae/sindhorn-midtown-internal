const freezeGrade=grade=>Object.freeze(Object.fromEntries(Object.entries(grade).map(([key,value])=>[key,Object.freeze([...value])])));

export const VIGNETTE_GRADES=Object.freeze({
  a:Object.freeze({
    key:'a',
    name:'Vignette A',
    description:'Restrained cool-world grade. Preserves each approved Betta identity and all production luminosity/material/motion values while moving pigment toward sapphire, petrol, plum, rose-pewter, garnet, silver and cool citron.',
    palettes:freezeGrade({
      royalBlueHalfmoon:['#081942','#1a53a6','#3386e4','#b4d5ff'],
      superRedHalfmoon:['#220615','#67133a','#aa285f','#e15d89'],
      mustardGas:['#081a45','#1b52aa','#a8b72a','#e6e46a'],
      blackOrchid:['#060b16','#17213a','#48557c','#9aabd2'],
      copperMetallic:['#17141a','#4a3445','#99627d','#d1a6bb'],
      turquoiseMetallic:['#063944','#087e89','#39c7bc','#c7f3e8'],
      nemoGalaxyKoi:['#1b568a','#762654','#c75a64','#eee9e4'],
      redSnowDragon:['#f6f8fa','#d2dce4','#9b2853','#db5575']
    })
  }),
  b:Object.freeze({
    key:'b',
    name:'Vignette B',
    description:'Stronger cool-world grade with luminous pigment separation. Pushes the same eight distinct organisms deeper into indigo, petrol, aubergine, rose-pewter and icy pearl while keeping Mustard Gas as the singular cool-citron exception.',
    palettes:freezeGrade({
      royalBlueHalfmoon:['#070d30','#233b94','#556ade','#c5ccff'],
      superRedHalfmoon:['#1b0412','#511032','#922056','#d84b7b'],
      mustardGas:['#071036','#194293','#86a52a','#d9df5d'],
      blackOrchid:['#070913','#161d34','#465078','#91a8d2'],
      copperMetallic:['#17121a','#4b3143','#9a5c7a','#d6a1ba'],
      turquoiseMetallic:['#043944','#087c89','#23c1b8','#c1f2e7'],
      nemoGalaxyKoi:['#1a5087','#7a2a5c','#d06471','#f0e9e3'],
      redSnowDragon:['#f3f7fb','#c5d5e3','#922551','#e05478']
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
