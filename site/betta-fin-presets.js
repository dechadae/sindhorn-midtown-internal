export const BETTA_LUMINOSITY_STANDARD=Object.freeze({
  source:'Reference-fin retune on approved radial membrane engine',
  brightness:1.18,
  opacity:.42,
  transmission:.78,
  bloom:.30
});

const preset=value=>Object.freeze(value);

export const BETTA_PRESETS={
  reference1:preset({
    referenceId:1,number:'01',name:'Fish #1 · Cobalt + Orange Halfmoon',morphMode:2,
    description:'Midnight authority. Deep cobalt root with orange-red outer fan, broad side-profile Halfmoon silhouette and crisp ray separation.',
    background:'#04060d',
    palette:['#06152f','#124a92','#b73518','#ff6a24'],
    params:{
      spread:3.62,rayCount:68,foldDensity:5.65,curl:.46,twist:.10,edgeFlutter:.066,depth:.66,
      currentStrength:.24,motionSpeed:.36,turbulence:.18,motionAmplitude:.43,
      opacity:.43,transmission:.78,rimStrength:.84,foldHighlight:.80,iridescence:.30,bloom:.31,
      saturation:1.20,brightness:1.21,gradientPosition:-.015,
      scale:1.18,rotation:-.10,cameraDepth:.12,offsetX:.12,offsetY:-.08
    },
    layers:[
      {seed:71.1,scale:1.00,rotation:0,offset:[0,0,.06],alpha:.94,phase:1.2},
      {seed:74.8,scale:.985,rotation:.035,offset:[.07,.02,-.10],alpha:.20,phase:17.6},
    ]
  }),
  reference2:preset({
    referenceId:2,number:'02',name:'Fish #2 · Super Red Halfmoon',morphMode:0,
    description:'Dense rounded scarlet Halfmoon with a nearly continuous circular fan and strong radial folds.',
    background:'#080203',
    palette:['#300307','#77100b','#c91a0e','#ff4c1d'],
    params:{
      spread:4.08,rayCount:72,foldDensity:5.9,curl:.52,twist:.17,edgeFlutter:.060,depth:.70,
      currentStrength:.23,motionSpeed:.34,turbulence:.17,motionAmplitude:.41,
      opacity:.46,transmission:.72,rimStrength:.80,foldHighlight:.82,iridescence:.12,bloom:.30,
      saturation:1.18,brightness:1.20,gradientPosition:-.06,
      scale:1.16,rotation:.10,cameraDepth:.05,offsetX:.02,offsetY:-.04
    },
    layers:[
      {seed:82.4,scale:1.00,rotation:0,offset:[0,0,.08],alpha:.94,phase:4.9},
      {seed:87.1,scale:.992,rotation:-.025,offset:[-.04,.05,-.11],alpha:.18,phase:21.2},
    ]
  }),
  reference3:preset({
    referenceId:3,number:'03',name:'Fish #3 · Coral Magenta Flow',morphMode:0,
    description:'Warm magenta, rose and coral-orange fan with softer asymmetric sweep and layered couture folds.',
    background:'#090408',
    palette:['#511033','#962052','#d94c62','#f38b50'],
    params:{
      spread:3.72,rayCount:64,foldDensity:5.65,curl:.66,twist:.26,edgeFlutter:.075,depth:.72,
      currentStrength:.25,motionSpeed:.37,turbulence:.21,motionAmplitude:.46,
      opacity:.43,transmission:.80,rimStrength:.82,foldHighlight:.76,iridescence:.28,bloom:.30,
      saturation:1.17,brightness:1.23,gradientPosition:-.025,
      scale:1.17,rotation:.18,cameraDepth:.05,offsetX:.04,offsetY:-.12
    },
    layers:[
      {seed:93.6,scale:1.03,rotation:-.03,offset:[-.06,-.03,.10],alpha:.91,phase:8.7},
      {seed:98.2,scale:.96,rotation:.12,offset:[.12,.08,-.14],alpha:.26,phase:26.4},
    ]
  }),
  reference4:preset({
    referenceId:4,number:'04',name:'Fish #4 · Pearl Blush Veiltail',morphMode:2,
    description:'Airy pale-blue and pearl membrane with blush-red outer accents, longer lower sweep and visibly delicate rays.',
    background:'#080b12',
    palette:['#dce6e8','#a7c4d4','#c77370','#e8b5ab'],
    params:{
      spread:3.34,rayCount:60,foldDensity:5.15,curl:.76,twist:-.34,edgeFlutter:.082,depth:.60,
      currentStrength:.21,motionSpeed:.32,turbulence:.18,motionAmplitude:.40,
      opacity:.31,transmission:.92,rimStrength:.79,foldHighlight:.66,iridescence:.20,bloom:.24,
      saturation:1.02,brightness:1.30,gradientPosition:.02,
      scale:1.15,rotation:-.18,cameraDepth:.18,offsetX:.06,offsetY:-.05
    },
    layers:[
      {seed:104.4,scale:1.04,rotation:-.06,offset:[-.08,-.06,.12],alpha:.84,phase:12.1},
      {seed:109.7,scale:.90,rotation:.24,offset:[.18,.16,-.16],alpha:.30,phase:31.5},
    ]
  }),
  reference5:preset({
    referenceId:5,number:'05',name:'Fish #5 · Mustard Galaxy Koi',morphMode:1,
    description:'Compact irregular fan combining ink blue, cyan, mustard-gold and pearl-white patches.',
    background:'#06070b',
    palette:['#42a9c9','#071827','#d5a52d','#f0efe6'],
    params:{
      spread:3.30,rayCount:58,foldDensity:5.72,curl:.70,twist:.32,edgeFlutter:.084,depth:.70,
      currentStrength:.25,motionSpeed:.39,turbulence:.23,motionAmplitude:.47,
      opacity:.46,transmission:.76,rimStrength:.84,foldHighlight:.82,iridescence:.38,bloom:.34,
      saturation:1.18,brightness:1.22,gradientPosition:-.03,
      scale:1.12,rotation:-.06,cameraDepth:.04,offsetX:.08,offsetY:-.03
    },
    layers:[
      {seed:116.2,scale:1.05,rotation:-.08,offset:[-.12,-.05,.12],alpha:.89,phase:15.8},
      {seed:121.6,scale:.93,rotation:.20,offset:[.16,.11,-.15],alpha:.32,phase:36.7},
    ]
  }),
  reference6:preset({
    referenceId:6,number:'06',name:'Fish #6 · Wine Orchid Halfmoon',morphMode:0,
    description:'Broad wine-magenta Halfmoon with cool lilac/silver inner rays, pale rim and strong radial rhythm.',
    background:'#06040b',
    palette:['#34394d','#6d3158','#a92260','#d96684'],
    params:{
      spread:4.18,rayCount:72,foldDensity:6.08,curl:.44,twist:-.08,edgeFlutter:.058,depth:.66,
      currentStrength:.23,motionSpeed:.34,turbulence:.17,motionAmplitude:.41,
      opacity:.47,transmission:.76,rimStrength:.88,foldHighlight:.84,iridescence:.34,bloom:.32,
      saturation:1.16,brightness:1.23,gradientPosition:.015,
      scale:1.17,rotation:-.08,cameraDepth:.10,offsetX:.02,offsetY:-.02
    },
    layers:[
      {seed:128.4,scale:1.00,rotation:0,offset:[0,0,.08],alpha:.94,phase:19.4},
      {seed:133.8,scale:.988,rotation:.025,offset:[.04,-.03,-.11],alpha:.17,phase:40.2},
    ]
  }),
  reference7:preset({
    referenceId:7,number:'07',name:'Fish #7 · Steel Blue Rosetail',morphMode:4,
    description:'Huge smoky steel-blue rosetail with soft teal folds, irregular ruffled edge and layered overlapping membrane.',
    background:'#04070b',
    palette:['#071824','#17374a','#336579','#91a1a0'],
    params:{
      spread:4.34,rayCount:76,foldDensity:6.25,curl:.78,twist:.30,edgeFlutter:.100,depth:.80,
      currentStrength:.24,motionSpeed:.31,turbulence:.27,motionAmplitude:.48,
      opacity:.43,transmission:.83,rimStrength:.91,foldHighlight:.86,iridescence:.32,bloom:.34,
      saturation:1.04,brightness:1.20,gradientPosition:.035,
      scale:1.20,rotation:.13,cameraDepth:.14,offsetX:.00,offsetY:.02
    },
    layers:[
      {seed:141.5,scale:1.04,rotation:.00,offset:[-.05,0,.12],alpha:.90,phase:23.6},
      {seed:147.9,scale:.91,rotation:.16,offset:[.16,.10,-.18],alpha:.36,phase:45.1},
    ]
  }),
  reference8:preset({
    referenceId:8,number:'08',name:'Fish #8 · Electric Blue Halfmoon',morphMode:4,
    description:'Monumental near-circular electric cobalt Halfmoon with dark navy root and highly legible radiating folds.',
    background:'#02040a',
    palette:['#020917','#072354','#0c59ad','#4a95df'],
    params:{
      spread:4.42,rayCount:80,foldDensity:6.02,curl:.50,twist:.06,edgeFlutter:.060,depth:.70,
      currentStrength:.22,motionSpeed:.32,turbulence:.17,motionAmplitude:.41,
      opacity:.49,transmission:.76,rimStrength:.94,foldHighlight:.88,iridescence:.42,bloom:.36,
      saturation:1.20,brightness:1.24,gradientPosition:.015,
      scale:1.18,rotation:-.11,cameraDepth:.14,offsetX:.02,offsetY:.00
    },
    layers:[
      {seed:155.2,scale:1.00,rotation:0,offset:[0,0,.08],alpha:.95,phase:27.8},
      {seed:161.4,scale:.992,rotation:-.02,offset:[-.04,.03,-.12],alpha:.18,phase:49.3},
    ]
  })
};

export const DEFAULT_PRESET='reference1';
export function clonePreset(key){
  const source=BETTA_PRESETS[key]||BETTA_PRESETS[DEFAULT_PRESET];
  return JSON.parse(JSON.stringify(source));
}
