export const BETTA_LUMINOSITY_STANDARD=Object.freeze({
  source:'Final photographic-reference retune on approved radial membrane engine',
  brightness:1.58,
  opacity:.59,
  transmission:.73,
  bloom:.34
});

const preset=value=>Object.freeze(value);

export const BETTA_PRESETS={
  reference1:preset({
    referenceId:1,number:'01',name:'Fish #1 · Cobalt + Orange Halfmoon',morphMode:2,
    description:'Deep cobalt/navy inner fan with a brighter photographic vermilion-orange outer membrane, broad Halfmoon sweep and crisp rays.',
    background:'#02040a',
    backgroundGradient:['#070b18','#102746','#351713'],
    palette:['#0a2454','#237fd2','#ef421f','#ff8a48'],
    params:{
      spread:3.15,rayCount:80,foldDensity:9.6,curl:.42,twist:.08,edgeFlutter:.070,depth:.58,
      currentStrength:.20,motionSpeed:.34,turbulence:.16,motionAmplitude:.37,
      opacity:.62,transmission:.71,rimStrength:1.10,foldHighlight:1.16,iridescence:.27,bloom:.36,
      saturation:1.34,brightness:1.72,gradientPosition:.015,
      scale:1.11,rotation:3.14,rotationX:.09,rotationY:-.61,tiltStrength:.18,cameraDepth:.10,offsetX:1.88,offsetY:-.80
    },
    layers:[
      {seed:71.1,scale:1.00,rotation:0,offset:[0,0,.06],alpha:.96,phase:1.2},
      {seed:74.8,scale:.94,rotation:.055,offset:[.06,.01,-.10],alpha:.28,phase:17.6},
    ]
  }),
  reference2:preset({
    referenceId:2,number:'02',name:'Fish #2 · Super Red Halfmoon',morphMode:0,
    description:'Rounded saturated scarlet Halfmoon with a near-black inner root, deep crimson transition and vivid scarlet-vermilion outer fin.',
    background:'#050101',
    backgroundGradient:['#120508','#36090d','#521611'],
    palette:['#090103','#5e0506','#e6180e','#ff5a20'],
    params:{
      spread:3.22,rayCount:80,foldDensity:10.4,curl:.25,twist:.035,edgeFlutter:.050,depth:.56,
      currentStrength:.18,motionSpeed:.32,turbulence:.13,motionAmplitude:.34,
      opacity:.66,transmission:.66,rimStrength:1.10,foldHighlight:1.22,iridescence:.08,bloom:.35,
      saturation:1.42,brightness:1.76,gradientPosition:-.08,
      scale:.92,rotation:-.22,rotationX:.24,rotationY:-.53,tiltStrength:.16,cameraDepth:.80,offsetX:-1.90,offsetY:-.48
    },
    layers:[
      {seed:82.4,scale:1.00,rotation:0,offset:[0,0,.07],alpha:.98,phase:4.9},
      {seed:87.1,scale:.955,rotation:-.035,offset:[-.02,.025,-.10],alpha:.23,phase:21.2},
    ]
  }),
  reference3:preset({
    referenceId:3,number:'03',name:'Fish #3 · Coral Magenta Flow',morphMode:0,
    description:'Asymmetric photographic rose-magenta fan with vivid pink, coral-orange and pale lilac separation rather than a uniform red wash.',
    background:'#060207',
    backgroundGradient:['#100712','#3a1026','#511c20'],
    palette:['#652047','#d33d86','#ff755f','#e8b1d6'],
    params:{
      spread:3.00,rayCount:76,foldDensity:9.4,curl:.70,twist:.26,edgeFlutter:.085,depth:.64,
      currentStrength:.20,motionSpeed:.35,turbulence:.19,motionAmplitude:.40,
      opacity:.61,transmission:.74,rimStrength:1.08,foldHighlight:1.16,iridescence:.24,bloom:.37,
      saturation:1.40,brightness:1.78,gradientPosition:.025,
      scale:.97,rotation:2.29,rotationX:-.42,rotationY:.71,tiltStrength:.20,cameraDepth:.04,offsetX:1.98,offsetY:-.64
    },
    layers:[
      {seed:93.6,scale:1.00,rotation:-.025,offset:[-.02,-.03,.09],alpha:.95,phase:8.7},
      {seed:98.2,scale:.90,rotation:.14,offset:[.08,.08,-.13],alpha:.34,phase:26.4},
    ]
  }),
  reference4:preset({
    referenceId:4,number:'04',name:'Fish #4 · Pearl Blush Veiltail',morphMode:2,
    description:'Pale pearl and icy-blue translucent fan with a clearly visible vivid coral-red outer mix and warm coral streak character.',
    background:'#05070b',
    backgroundGradient:['#08111b','#183647','#45221f'],
    palette:['#fbfdff','#9fdaf0','#ff4d3f','#ff9a82'],
    params:{
      spread:2.68,rayCount:72,foldDensity:8.7,curl:.94,twist:-.46,edgeFlutter:.105,depth:.52,
      currentStrength:.17,motionSpeed:.30,turbulence:.16,motionAmplitude:.34,
      opacity:.50,transmission:.91,rimStrength:1.08,foldHighlight:1.08,iridescence:.16,bloom:.34,
      saturation:1.24,brightness:1.84,gradientPosition:.035,
      scale:1.26,rotation:-.03,rotationX:-.51,rotationY:.54,tiltStrength:.17,cameraDepth:.12,offsetX:-1.76,offsetY:-.36
    },
    layers:[
      {seed:104.4,scale:1.00,rotation:-.03,offset:[-.02,-.04,.11],alpha:.89,phase:12.1},
      {seed:109.7,scale:.84,rotation:.24,offset:[.12,.13,-.15],alpha:.38,phase:31.5},
    ]
  }),
  reference5:preset({
    referenceId:5,number:'05',name:'Fish #5 · Mustard Galaxy Koi',morphMode:1,
    description:'Distinct ink-blue, cyan, mustard-gold and pearl-white photographic patches with protected color separation instead of an amber/brown blend.',
    background:'#030507',
    backgroundGradient:['#071017','#163847','#46310e'],
    palette:['#67d7e9','#071820','#e5b13b','#fff8ea'],
    params:{
      spread:2.78,rayCount:72,foldDensity:9.8,curl:.82,twist:.34,edgeFlutter:.120,depth:.66,
      currentStrength:.20,motionSpeed:.35,turbulence:.23,motionAmplitude:.41,
      opacity:.64,transmission:.72,rimStrength:1.14,foldHighlight:1.22,iridescence:.34,bloom:.40,
      saturation:1.40,brightness:1.76,gradientPosition:-.05,
      scale:1.06,rotation:-3.14,rotationX:-.52,rotationY:.17,tiltStrength:.21,cameraDepth:.08,offsetX:2.16,offsetY:.16
    },
    layers:[
      {seed:116.2,scale:1.00,rotation:-.05,offset:[-.03,-.02,.10],alpha:.94,phase:15.8},
      {seed:121.6,scale:.82,rotation:.22,offset:[.12,.10,-.15],alpha:.48,phase:36.7},
    ]
  }),
  reference6:preset({
    referenceId:6,number:'06',name:'Fish #6 · Wine Orchid Halfmoon',morphMode:4,
    description:'Broad wine-magenta Halfmoon with deeper burgundy/plum valleys and a restrained sunset-gold highlight carried by the bright outer rays.',
    background:'#040207',
    backgroundGradient:['#100713','#3d132b','#553715'],
    palette:['#21152f','#5c1748','#c42f79','#e7ae61'],
    params:{
      spread:3.24,rayCount:80,foldDensity:10.8,curl:.34,twist:-.035,edgeFlutter:.055,depth:.56,
      currentStrength:.18,motionSpeed:.32,turbulence:.13,motionAmplitude:.34,
      opacity:.64,transmission:.71,rimStrength:1.16,foldHighlight:1.30,iridescence:.29,bloom:.39,
      saturation:1.31,brightness:1.72,gradientPosition:-.01,
      scale:1.02,rotation:.30,rotationX:.38,rotationY:-.18,tiltStrength:.18,cameraDepth:.09,offsetX:-1.62,offsetY:-.58
    },
    layers:[
      {seed:128.4,scale:1.00,rotation:0,offset:[0,0,.07],alpha:.97,phase:19.4},
      {seed:133.8,scale:.95,rotation:.035,offset:[.025,-.02,-.10],alpha:.25,phase:40.2},
    ]
  }),
  reference7:preset({
    referenceId:7,number:'07',name:'Fish #7 · Steel Blue Rosetail',morphMode:4,
    description:'Smoky steel blue-green rosetail with a darker teal root, silver-blue midtones and restrained rose-gold ray and tip highlights on the approved layered ruffled form.',
    background:'#020507',
    backgroundGradient:['#071116','#193946','#3c242c'],
    palette:['#061820','#17495b','#4e91a5','#d7a49a'],
    params:{
      spread:3.42,rayCount:80,foldDensity:11.6,curl:1.02,twist:.43,edgeFlutter:.165,depth:.78,
      currentStrength:.19,motionSpeed:.29,turbulence:.27,motionAmplitude:.41,
      opacity:.58,transmission:.79,rimStrength:1.22,foldHighlight:1.30,iridescence:.30,bloom:.40,
      saturation:1.22,brightness:1.68,gradientPosition:.02,
      scale:1.00,rotation:-.89,rotationX:.41,rotationY:-.32,tiltStrength:.22,cameraDepth:.11,offsetX:-1.86,offsetY:.26
    },
    layers:[
      {seed:141.5,scale:1.00,rotation:-.02,offset:[-.03,0,.11],alpha:.93,phase:23.6},
      {seed:147.9,scale:.80,rotation:.22,offset:[.13,.09,-.18],alpha:.52,phase:45.1},
    ]
  }),
  reference8:preset({
    referenceId:8,number:'08',name:'Fish #8 · Electric Blue Halfmoon',morphMode:4,
    description:'Near-circular royal/electric cobalt Halfmoon with a dark navy root and highly legible bright blue radiating rays.',
    background:'#01030a',
    backgroundGradient:['#050b1c','#0c285a','#143472'],
    palette:['#020a20','#0a2f71','#1677d2','#79b9f4'],
    params:{
      spread:3.28,rayCount:80,foldDensity:11.2,curl:.27,twist:.018,edgeFlutter:.048,depth:.56,
      currentStrength:.17,motionSpeed:.30,turbulence:.12,motionAmplitude:.33,
      opacity:.66,transmission:.68,rimStrength:1.18,foldHighlight:1.26,iridescence:.36,bloom:.42,
      saturation:1.34,brightness:1.72,gradientPosition:-.035,
      scale:1.06,rotation:-3.14,rotationX:.30,rotationY:-.56,tiltStrength:.19,cameraDepth:.10,offsetX:1.84,offsetY:.18
    },
    layers:[
      {seed:155.2,scale:1.00,rotation:0,offset:[0,0,.07],alpha:.98,phase:27.8},
      {seed:161.4,scale:.955,rotation:-.025,offset:[-.02,.02,-.11],alpha:.24,phase:49.3},
    ]
  })
};

export const DEFAULT_PRESET='reference1';
export function clonePreset(key){
  const source=BETTA_PRESETS[key]||BETTA_PRESETS[DEFAULT_PRESET];
  return JSON.parse(JSON.stringify(source));
}
