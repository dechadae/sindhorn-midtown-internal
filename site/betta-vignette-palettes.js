const clampByte=value=>Math.max(0,Math.min(255,Math.round(value)));
const hexToRgb=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
const rgbToHex=rgb=>'#'+rgb.map(value=>clampByte(value).toString(16).padStart(2,'0')).join('');
const mixHex=(hex,tint,amount)=>{const a=hexToRgb(hex),b=hexToRgb(tint);return rgbToHex(a.map((value,index)=>value+(b[index]-value)*amount))};
const freezeGrade=grade=>Object.freeze(Object.fromEntries(Object.entries(grade).map(([key,value])=>[key,Object.freeze([...value])])));

const REFERENCE_BASE=Object.freeze({
  reference1:Object.freeze(['#06152f','#124a92','#b73518','#ff6a24']),
  reference2:Object.freeze(['#300307','#77100b','#c91a0e','#ff4c1d']),
  reference3:Object.freeze(['#511033','#962052','#d94c62','#f38b50']),
  reference4:Object.freeze(['#dce6e8','#a7c4d4','#c77370','#e8b5ab']),
  reference5:Object.freeze(['#42a9c9','#071827','#d5a52d','#f0efe6']),
  reference6:Object.freeze(['#34394d','#6d3158','#a92260','#d96684']),
  reference7:Object.freeze(['#071824','#17374a','#336579','#91a1a0']),
  reference8:Object.freeze(['#020917','#072354','#0c59ad','#4a95df'])
});

function makeCoolGrade(amount){
  const tint='#667cc0';
  return freezeGrade(Object.fromEntries(Object.entries(REFERENCE_BASE).map(([key,palette])=>[key,palette.map(hex=>mixHex(hex,tint,amount))])));
}
const GRADE_A=makeCoolGrade(.035);
const GRADE_B=makeCoolGrade(.070);
const SELECTED_KEYS=Object.freeze({reference1:'b',reference7:'a',reference4:'b',reference6:'b',reference2:'a',reference3:'a',reference5:'b',reference8:'a'});
const SELECTED=freezeGrade(Object.fromEntries(Object.entries(SELECTED_KEYS).map(([key,grade])=>[key,(grade==='b'?GRADE_B:GRADE_A)[key]])));

export const VIGNETTE_SELECTED_BY_PERIOD=Object.freeze({
  'midnight':'b','before-dawn':'a','first-light':'b','bright-morning':'b','midday':'a','afternoon':'a','golden-hour':'b','blue-hour':'a'
});

export const VIGNETTE_GRADES=Object.freeze({
  a:Object.freeze({key:'a',name:'Vignette A',description:'Very restrained cool editorial tint over the reference-fin colors.',palettes:GRADE_A}),
  b:Object.freeze({key:'b',name:'Vignette B',description:'Slightly stronger indigo editorial tint while preserving each reference-fin identity.',palettes:GRADE_B}),
  selected:Object.freeze({key:'selected',name:'Selected Mix',description:'Approved B → A → B → B → A → A → B → A period sequence over the reference-tail palettes.',palettes:SELECTED})
});

export function applyVignetteGrade(presets,gradeKey){
  const grade=VIGNETTE_GRADES[gradeKey];
  if(!grade)return null;
  for(const [key,palette] of Object.entries(grade.palettes)){
    if(!presets[key])throw new Error(`Missing Betta preset: ${key}`);
    const target=presets[key].palette;
    if(!Array.isArray(target))throw new Error(`Missing Betta palette: ${key}`);
    target.splice(0,target.length,...palette);
  }
  return grade;
}
