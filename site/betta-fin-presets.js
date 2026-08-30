export const BETTA_PRESETS={
  cobaltVeil:{
    number:'01',name:'Cobalt Veil',
    description:'One enormous cobalt veil enters from the lower right, opening slowly into violet negative space.',
    background:'#09070d',
    palette:['#061a64','#164eea','#6735e8','#d12b9d'],
    params:{
      spread:3.42,rayCount:56,foldDensity:5.9,curl:.58,twist:-.33,edgeFlutter:.19,depth:.62,
      currentStrength:.36,motionSpeed:.22,turbulence:.42,motionAmplitude:.56,
      opacity:.46,transmission:.68,rimStrength:.72,foldHighlight:.88,iridescence:.24,bloom:.36,
      saturation:1.04,brightness:.92,gradientPosition:.05,
      scale:1.42,rotation:-.54,cameraDepth:.15,offsetX:1.26,offsetY:-1.08
    },
    layers:[
      {seed:1.17,scale:1,rotation:0,offset:[0,0,0],alpha:1,phase:0},
    ]
  },
  crimsonSilk:{
    number:'02',name:'Crimson Silk',
    description:'Two opposing crimson membranes fold through each other with denser rays and warm translucent overlaps.',
    background:'#0b0509',
    palette:['#390313','#980d2e','#ef3158','#ff8b9b'],
    params:{
      spread:3.82,rayCount:64,foldDensity:8.4,curl:1.08,twist:.52,edgeFlutter:.28,depth:.96,
      currentStrength:.45,motionSpeed:.19,turbulence:.59,motionAmplitude:.7,
      opacity:.39,transmission:.76,rimStrength:.84,foldHighlight:1.18,iridescence:.12,bloom:.44,
      saturation:1.1,brightness:.9,gradientPosition:-.08,
      scale:1.13,rotation:.17,cameraDepth:-.1,offsetX:.08,offsetY:-.15
    },
    layers:[
      {seed:4.31,scale:1.12,rotation:-.12,offset:[-1.28,-.35,.12],alpha:.93,phase:7.4},
      {seed:8.63,scale:.92,rotation:3.03,offset:[1.42,.48,-.24],alpha:.72,phase:19.7},
    ]
  },
  turquoiseDrift:{
    number:'03',name:'Turquoise Drift',
    description:'Cool translucent fins drift at staggered depths, leaving a quiet central cleft of darkness.',
    background:'#040a0d',
    palette:['#00395c','#00a6ad','#59e4d7','#6948c9'],
    params:{
      spread:3.18,rayCount:52,foldDensity:6.7,curl:.72,twist:-.74,edgeFlutter:.16,depth:1.08,
      currentStrength:.28,motionSpeed:.14,turbulence:.36,motionAmplitude:.5,
      opacity:.36,transmission:.82,rimStrength:.94,foldHighlight:.78,iridescence:.34,bloom:.31,
      saturation:.93,brightness:.96,gradientPosition:.12,
      scale:1.05,rotation:-.1,cameraDepth:.38,offsetX:.05,offsetY:.06
    },
    layers:[
      {seed:12.9,scale:1.03,rotation:-.72,offset:[-1.53,-.82,.42],alpha:.88,phase:4.2},
      {seed:22.4,scale:.87,rotation:2.16,offset:[1.72,.91,-.36],alpha:.68,phase:32.1},
    ]
  },
  midnightPlum:{
    number:'04',name:'Midnight Plum',
    description:'A restrained burgundy-plum fold fills the frame quietly; only selected ridges and coral edges catch light.',
    background:'#100914',
    palette:['#210b27','#5d173e','#9b3154','#e48c77'],
    params:{
      spread:4.28,rayCount:48,foldDensity:4.7,curl:1.3,twist:.82,edgeFlutter:.1,depth:1.2,
      currentStrength:.2,motionSpeed:.1,turbulence:.25,motionAmplitude:.43,
      opacity:.31,transmission:.86,rimStrength:.62,foldHighlight:.7,iridescence:.1,bloom:.2,
      saturation:.77,brightness:.72,gradientPosition:.19,
      scale:1.62,rotation:1.25,cameraDepth:.58,offsetX:-1.35,offsetY:.18
    },
    layers:[
      {seed:31.6,scale:1.08,rotation:.06,offset:[0,0,.2],alpha:.9,phase:13.8},
    ]
  }
};

export const DEFAULT_PRESET='cobaltVeil';
export function clonePreset(key){
  const source=BETTA_PRESETS[key]||BETTA_PRESETS[DEFAULT_PRESET];
  return JSON.parse(JSON.stringify(source));
}
