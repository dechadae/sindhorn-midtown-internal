export const BETTA_LUMINOSITY_STANDARD=Object.freeze({
  source:'Nemo Galaxy Koi pre-luxury-cycle',
  brightness:.96,
  opacity:.42,
  transmission:.70,
  bloom:.34
});

export const BETTA_PRESETS={
  royalBlueHalfmoon:{
    number:'01',name:'Royal Blue Halfmoon',morphMode:0,
    description:'Daylight luxury baseline: vivid cobalt and electric royal blue in a broad, delicate Halfmoon fan with translucent silk movement.',
    background:'#07101d',
    palette:['#071b3c','#124ea3','#2584e6','#9ad3ff'],
    params:{
      spread:3.48,rayCount:56,foldDensity:5.1,curl:.52,twist:-.28,edgeFlutter:.07,depth:.62,
      currentStrength:.27,motionSpeed:.43,turbulence:.21,motionAmplitude:.48,
      opacity:.42,transmission:.8,rimStrength:.78,foldHighlight:.72,iridescence:.34,bloom:.24,
      saturation:1.12,brightness:1.16,gradientPosition:.03,
      scale:1.12,rotation:-.46,cameraDepth:.15,offsetX:.48,offsetY:-.58
    },
    layers:[
      {seed:1.17,scale:1,rotation:0,offset:[0,0,0],alpha:.94,phase:0},
    ]
  },
  superRedHalfmoon:{
    number:'02',name:'Super Red Halfmoon',morphMode:0,
    description:'Night luxury baseline: deep garnet and velvet crimson with Nemo-standard luminosity, restrained scarlet edges and slow, fluid Halfmoon folds.',
    background:'#080305',
    palette:['#210207','#600711','#a61621','#e33d40'],
    params:{
      spread:3.84,rayCount:64,foldDensity:5.35,curl:.62,twist:.25,edgeFlutter:.07,depth:.72,
      currentStrength:.26,motionSpeed:.4,turbulence:.21,motionAmplitude:.47,
      opacity:.39,transmission:.75,rimStrength:.76,foldHighlight:.72,iridescence:.12,bloom:.27,
      saturation:1.05,brightness:.98,gradientPosition:-.06,
      scale:1.12,rotation:.16,cameraDepth:-.1,offsetX:.08,offsetY:-.12
    },
    layers:[
      {seed:4.31,scale:1.12,rotation:-.12,offset:[-1.22,-.32,.12],alpha:.88,phase:7.4},
      {seed:8.63,scale:.92,rotation:3.03,offset:[1.36,.46,-.24],alpha:.36,phase:19.7},
    ]
  },
  mustardGas:{
    number:'03',name:'Mustard Gas',morphMode:3,
    description:'Daylight luxury baseline: vivid cool cobalt root opening into luminous citron-mustard membrane, bright without becoming warm-heavy.',
    background:'#07101b',
    palette:['#071b43','#174ea6','#d9ad1c','#ffe46a'],
    params:{
      spread:4.05,rayCount:60,foldDensity:5.2,curl:.56,twist:-.2,edgeFlutter:.07,depth:.64,
      currentStrength:.27,motionSpeed:.42,turbulence:.22,motionAmplitude:.49,
      opacity:.4,transmission:.81,rimStrength:.74,foldHighlight:.7,iridescence:.2,bloom:.22,
      saturation:1.12,brightness:1.1,gradientPosition:-.02,
      scale:1.18,rotation:-.2,cameraDepth:.08,offsetX:.28,offsetY:-.4
    },
    layers:[
      {seed:6.14,scale:1.02,rotation:0,offset:[0,0,.05],alpha:.94,phase:3.2},
    ]
  },
  blackOrchid:{
    number:'04',name:'Black Orchid',morphMode:4,
    description:'Midnight luxury baseline: readable blue-black orchid silk held to the Nemo luminosity standard with soft steel-blue inner light.',
    background:'#05070a',
    palette:['#040912','#0d1c2d','#23405c','#5a8fbd'],
    params:{
      spread:4.24,rayCount:52,foldDensity:4.8,curl:.66,twist:.34,edgeFlutter:.055,depth:.74,
      currentStrength:.22,motionSpeed:.35,turbulence:.17,motionAmplitude:.4,
      opacity:.42,transmission:.78,rimStrength:.86,foldHighlight:.76,iridescence:.38,bloom:.27,
      saturation:.98,brightness:.99,gradientPosition:.07,
      scale:1.46,rotation:1.1,cameraDepth:.45,offsetX:-.92,offsetY:.1
    },
    layers:[
      {seed:31.6,scale:1.05,rotation:.04,offset:[0,0,.18],alpha:.92,phase:13.8},
    ]
  },
  copperMetallic:{
    number:'05',name:'Copper Metallic',morphMode:5,
    description:'Pre-dawn luxury baseline: smoky graphite and muted bronze at Nemo-standard luminosity with fine satin-metal reflections, never rigid or foil-like.',
    background:'#070605',
    palette:['#151311','#3d312c','#825f52','#c7a48f'],
    params:{
      spread:3.55,rayCount:52,foldDensity:4.95,curl:.56,twist:.22,edgeFlutter:.06,depth:.7,
      currentStrength:.23,motionSpeed:.36,turbulence:.18,motionAmplitude:.42,
      opacity:.37,transmission:.76,rimStrength:.76,foldHighlight:.72,iridescence:.46,bloom:.26,
      saturation:.82,brightness:.98,gradientPosition:.06,
      scale:1.08,rotation:.06,cameraDepth:.24,offsetX:.08,offsetY:.03
    },
    layers:[
      {seed:15.7,scale:1.08,rotation:-.58,offset:[-1.3,-.68,.25],alpha:.78,phase:5.7},
      {seed:19.8,scale:.9,rotation:2.28,offset:[1.5,.76,-.25],alpha:.32,phase:23.1},
    ]
  },
  turquoiseMetallic:{
    number:'06',name:'Turquoise Metallic',morphMode:0,
    description:'First-light luxury baseline: vivid pale aqua and pearl turquoise in the softest, most translucent couture membrane of the cycle.',
    background:'#061116',
    palette:['#073846','#0b8994','#42cfc5','#c9f6eb'],
    params:{
      spread:3.34,rayCount:56,foldDensity:4.8,curl:.44,twist:-.3,edgeFlutter:.05,depth:.62,
      currentStrength:.21,motionSpeed:.33,turbulence:.15,motionAmplitude:.38,
      opacity:.28,transmission:.9,rimStrength:.68,foldHighlight:.56,iridescence:.42,bloom:.18,
      saturation:1.02,brightness:1.18,gradientPosition:.08,
      scale:1.08,rotation:-.05,cameraDepth:.3,offsetX:.08,offsetY:.03
    },
    layers:[
      {seed:12.9,scale:1.02,rotation:-.55,offset:[-1.34,-.64,.32],alpha:.76,phase:4.2},
      {seed:22.4,scale:.9,rotation:2.08,offset:[1.48,.72,-.26],alpha:.28,phase:32.1},
    ]
  },
  nemoGalaxyKoi:{
    number:'07',name:'Nemo Galaxy Koi',morphMode:1,
    description:'Evening luminosity standard: the original vivid blue, red, orange and cream Nemo palette preserved on the new soft luxury membrane.',
    background:'#080506',
    palette:['#1679b8','#b92b1c','#ee8e2e','#f1e7d7'],
    params:{
      spread:3.72,rayCount:60,foldDensity:5.15,curl:.6,twist:.27,edgeFlutter:.065,depth:.7,
      currentStrength:.25,motionSpeed:.38,turbulence:.21,motionAmplitude:.46,
      opacity:.42,transmission:.70,rimStrength:.8,foldHighlight:.78,iridescence:.28,bloom:.34,
      saturation:1.08,brightness:.96,gradientPosition:-.03,
      scale:1.1,rotation:.14,cameraDepth:.02,offsetX:.04,offsetY:-.08
    },
    layers:[
      {seed:42.3,scale:1.08,rotation:-.2,offset:[-1.05,-.28,.15],alpha:.84,phase:6.8},
      {seed:47.1,scale:.9,rotation:2.94,offset:[1.25,.44,-.2],alpha:.34,phase:26.3},
    ]
  },
  redSnowDragon:{
    number:'08',name:'Red Snow Dragon',morphMode:2,
    description:'Midday luxury baseline: luminous pearl-white and silver membrane with vivid red accents, softened so the dragon structure floats rather than feels armored.',
    background:'#121318',
    palette:['#fffaf1','#dce4e7','#c91b24','#ff6154'],
    params:{
      spread:3.92,rayCount:56,foldDensity:4.9,curl:.5,twist:.14,edgeFlutter:.055,depth:.6,
      currentStrength:.22,motionSpeed:.35,turbulence:.17,motionAmplitude:.4,
      opacity:.36,transmission:.84,rimStrength:.76,foldHighlight:.68,iridescence:.2,bloom:.2,
      saturation:1.08,brightness:1.14,gradientPosition:.01,
      scale:1.2,rotation:-.12,cameraDepth:.12,offsetX:.24,offsetY:-.32
    },
    layers:[
      {seed:52.7,scale:1.02,rotation:-.04,offset:[0,0,.08],alpha:.86,phase:9.3},
      {seed:57.4,scale:.76,rotation:3.06,offset:[.72,.28,-.18],alpha:.28,phase:28.7},
    ]
  }
};

export const DEFAULT_PRESET='royalBlueHalfmoon';
export function clonePreset(key){
  const source=BETTA_PRESETS[key]||BETTA_PRESETS[DEFAULT_PRESET];
  return JSON.parse(JSON.stringify(source));
}
