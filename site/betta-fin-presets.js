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
    description:'Deep cobalt/navy inner fan with a strongly visible orange-red outer membrane. Root sits left of center and the fan opens to the right, matching the side-profile reference.',
    background:'#02040a',
    palette:['#071a3a','#1768bb','#d84822','#ff7942'],
    params:{
      spread:3.15,rayCount:80,foldDensity:9.6,curl:.42,twist:.08,edgeFlutter:.070,depth:.58,
      currentStrength:.20,motionSpeed:.34,turbulence:.16,motionAmplitude:.37,
      opacity:.62,transmission:.71,rimStrength:1.08,foldHighlight:1.12,iridescence:.27,bloom:.36,
      saturation:1.27,brightness:1.62,gradientPosition:-.08,
      scale:.66,rotation:.10,cameraDepth:.10,offsetX:-1.04,offsetY:-.08
    },
    layers:[
      {seed:71.1,scale:1.00,rotation:0,offset:[0,0,.06],alpha:.96,phase:1.2},
      {seed:74.8,scale:.94,rotation:.055,offset:[.06,.01,-.10],alpha:.28,phase:17.6},
    ]
  }),
  reference2:preset({
    referenceId:2,number:'02',name:'Fish #2 · Super Red Halfmoon',morphMode:0,
    description:'Rounded saturated scarlet Halfmoon. Root is lower-left and the circular fan opens upward/right like the photographic fish.',
    background:'#050101',
    palette:['#570303','#a70a06','#ef1c0d','#ff5b24'],
    params:{
      spread:3.22,rayCount:80,foldDensity:10.4,curl:.25,twist:.035,edgeFlutter:.050,depth:.56,
      currentStrength:.18,motionSpeed:.32,turbulence:.13,motionAmplitude:.34,
      opacity:.66,transmission:.66,rimStrength:1.06,foldHighlight:1.18,iridescence:.08,bloom:.34,
      saturation:1.32,brightness:1.66,gradientPosition:-.11,
      scale:.64,rotation:.46,cameraDepth:.08,offsetX:-.92,offsetY:-.36
    },
    layers:[
      {seed:82.4,scale:1.00,rotation:0,offset:[0,0,.07],alpha:.98,phase:4.9},
      {seed:87.1,scale:.955,rotation:-.035,offset:[-.02,.025,-.10],alpha:.23,phase:21.2},
    ]
  }),
  reference3:preset({
    referenceId:3,number:'03',name:'Fish #3 · Coral Magenta Flow',morphMode:0,
    description:'Asymmetric rose-magenta fan with coral-orange rays. Root stays left/lower and the warmer fan sweeps broadly to the right.',
    background:'#060207',
    palette:['#4f102d','#a52d5d','#e45d73','#f19a68'],
    params:{
      spread:3.00,rayCount:76,foldDensity:9.4,curl:.70,twist:.26,edgeFlutter:.085,depth:.64,
      currentStrength:.20,motionSpeed:.35,turbulence:.19,motionAmplitude:.40,
      opacity:.61,transmission:.72,rimStrength:1.03,foldHighlight:1.08,iridescence:.24,bloom:.35,
      saturation:1.26,brightness:1.64,gradientPosition:-.045,
      scale:.66,rotation:.32,cameraDepth:.08,offsetX:-.92,offsetY:-.22
    },
    layers:[
      {seed:93.6,scale:1.00,rotation:-.025,offset:[-.02,-.03,.09],alpha:.95,phase:8.7},
      {seed:98.2,scale:.90,rotation:.14,offset:[.08,.08,-.13],alpha:.34,phase:26.4},
    ]
  }),
  reference4:preset({
    referenceId:4,number:'04',name:'Fish #4 · Pearl Blush Veiltail',morphMode:2,
    description:'Pale pearl and icy-blue translucent fan with blush-red outer streaks. Root is upper-right and the long veiltail falls left/down like the reference.',
    background:'#05070b',
    palette:['#e9eef0','#9fc7dc','#ca6e68','#efb8ae'],
    params:{
      spread:2.68,rayCount:72,foldDensity:8.7,curl:.94,twist:-.46,edgeFlutter:.105,depth:.52,
      currentStrength:.17,motionSpeed:.30,turbulence:.16,motionAmplitude:.34,
      opacity:.49,transmission:.90,rimStrength:1.00,foldHighlight:.98,iridescence:.16,bloom:.31,
      saturation:1.10,brightness:1.70,gradientPosition:.00,
      scale:.69,rotation:-2.42,cameraDepth:.12,offsetX:.92,offsetY:.42
    },
    layers:[
      {seed:104.4,scale:1.00,rotation:-.03,offset:[-.02,-.04,.11],alpha:.89,phase:12.1},
      {seed:109.7,scale:.84,rotation:.24,offset:[.12,.13,-.15],alpha:.38,phase:31.5},
    ]
  }),
  reference5:preset({
    referenceId:5,number:'05',name:'Fish #5 · Mustard Galaxy Koi',morphMode:1,
    description:'Compact irregular couture fan with distinct ink-blue, cyan, mustard-gold and pearl-white patches. Root is slightly left/lower with the layered fan opening upward/right.',
    background:'#030507',
    palette:['#62d1e8','#081923','#e0ad3c','#fff4dd'],
    params:{
      spread:2.78,rayCount:72,foldDensity:9.8,curl:.82,twist:.34,edgeFlutter:.120,depth:.66,
      currentStrength:.20,motionSpeed:.35,turbulence:.23,motionAmplitude:.41,
      opacity:.64,transmission:.69,rimStrength:1.10,foldHighlight:1.16,iridescence:.34,bloom:.39,
      saturation:1.34,brightness:1.68,gradientPosition:-.05,
      scale:.62,rotation:.54,cameraDepth:.08,offsetX:-.72,offsetY:-.26
    },
    layers:[
      {seed:116.2,scale:1.00,rotation:-.05,offset:[-.03,-.02,.10],alpha:.94,phase:15.8},
      {seed:121.6,scale:.82,rotation:.22,offset:[.12,.10,-.15],alpha:.48,phase:36.7},
    ]
  }),
  reference6:preset({
    referenceId:6,number:'06',name:'Fish #6 · Wine Orchid Halfmoon',morphMode:4,
    description:'Broad wine-magenta Halfmoon with deep plum valleys and lavender-silver rays. Root is right/lower and the Halfmoon opens left/up like the reference.',
    background:'#040207',
    palette:['#2f203f','#6f2355','#b73175','#ead0e7'],
    params:{
      spread:3.24,rayCount:80,foldDensity:10.8,curl:.34,twist:-.035,edgeFlutter:.055,depth:.56,
      currentStrength:.18,motionSpeed:.32,turbulence:.13,motionAmplitude:.34,
      opacity:.64,transmission:.70,rimStrength:1.12,foldHighlight:1.22,iridescence:.28,bloom:.38,
      saturation:1.28,brightness:1.68,gradientPosition:-.01,
      scale:.64,rotation:2.56,cameraDepth:.09,offsetX:.92,offsetY:-.18
    },
    layers:[
      {seed:128.4,scale:1.00,rotation:0,offset:[0,0,.07],alpha:.97,phase:19.4},
      {seed:133.8,scale:.95,rotation:.035,offset:[.025,-.02,-.10],alpha:.25,phase:40.2},
    ]
  }),
  reference7:preset({
    referenceId:7,number:'07',name:'Fish #7 · Steel Blue Rosetail',morphMode:4,
    description:'Smoky steel/teal blue rosetail with layered overlapping lobes. Root is upper-right and the ruffled fan rolls left/down behind the fish as in the photograph.',
    background:'#020507',
    palette:['#0b202c','#28576d','#588aa0','#c5d0d2'],
    params:{
      spread:3.42,rayCount:80,foldDensity:11.6,curl:1.02,twist:.43,edgeFlutter:.165,depth:.78,
      currentStrength:.19,motionSpeed:.29,turbulence:.27,motionAmplitude:.41,
      opacity:.58,transmission:.78,rimStrength:1.18,foldHighlight:1.24,iridescence:.28,bloom:.39,
      saturation:1.17,brightness:1.62,gradientPosition:.015,
      scale:.62,rotation:-2.82,cameraDepth:.11,offsetX:.96,offsetY:.28
    },
    layers:[
      {seed:141.5,scale:1.00,rotation:-.02,offset:[-.03,0,.11],alpha:.93,phase:23.6},
      {seed:147.9,scale:.80,rotation:.22,offset:[.13,.09,-.18],alpha:.52,phase:45.1},
    ]
  }),
  reference8:preset({
    referenceId:8,number:'08',name:'Fish #8 · Electric Blue Halfmoon',morphMode:4,
    description:'Near-circular royal/electric cobalt Halfmoon with a dark navy root. Root sits left/lower and the fan rises strongly to the upper-right like the photographic reference.',
    background:'#01030a',
    palette:['#020a20','#0a2f71','#1677d2','#79b9f4'],
    params:{
      spread:3.28,rayCount:80,foldDensity:11.2,curl:.27,twist:.018,edgeFlutter:.048,depth:.56,
      currentStrength:.17,motionSpeed:.30,turbulence:.12,motionAmplitude:.33,
      opacity:.66,transmission:.68,rimStrength:1.18,foldHighlight:1.26,iridescence:.36,bloom:.42,
      saturation:1.34,brightness:1.72,gradientPosition:-.035,
      scale:.64,rotation:.64,cameraDepth:.10,offsetX:-.92,offsetY:-.28
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
