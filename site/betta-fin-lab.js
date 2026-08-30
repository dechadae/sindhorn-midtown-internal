import * as THREE from './vendor/three.module.js';
import {BETTA_PRESETS,DEFAULT_PRESET,clonePreset} from './betta-fin-presets.js';
import {BETTA_VERTEX_SHADER,BETTA_FRAGMENT_SHADER} from './betta-fin-shader.js';

const DPR=2;
const RADIAL_SEGMENTS=72;
const canvas=document.querySelector('#bettaCanvas');
const descriptionEl=document.querySelector('#presetDescription');
const diagnosticsEl=document.querySelector('#diagnostics');
const tuneSheet=document.querySelector('#tuneSheet');
const tuneButton=document.querySelector('#tuneButton');
const closeTune=document.querySelector('#closeTune');
const uiToggle=document.querySelector('#uiToggle');
const uiSpecimen=document.querySelector('#uiSpecimen');
const tiltButton=document.querySelector('#tiltButton');
const sheetPresetName=document.querySelector('#sheetPresetName');
const inputs=[...document.querySelectorAll('[data-param]')];
const outputs=new Map([...document.querySelectorAll('[data-output]')].map(el=>[el.dataset.output,el]));

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(32,1,.1,50);
camera.position.set(0,0,9);
const renderer=new THREE.WebGLRenderer({
  canvas,
  antialias:false,
  alpha:false,
  powerPreference:'high-performance',
  precision:'highp',
  preserveDrawingBuffer:false
});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.setPixelRatio(DPR);

let activeKey=DEFAULT_PRESET;
let active=clonePreset(activeKey);
let sharedGeometry=null;
const meshes=[];
const materials=[];
const drag={active:false,lastX:0,lastY:0,impulse:new THREE.Vector2()};
const living={
  current:new THREE.Vector2(.12,-.06),
  target:new THREE.Vector2(.12,-.06),
  nextChange:0,
  transitionRate:.06,
  tilt:new THREE.Vector2(),
  enabledTilt:false
};
let raf=0;
let activeTime=0;
let previousNow=performance.now();
let sampleStart=performance.now();
let frameCount=0;
let fps=0;
let reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

function random01(){
  if(globalThis.crypto?.getRandomValues){
    const a=new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0]/4294967295;
  }
  return Math.random();
}
function scheduleCurrent(now){
  const angle=random01()*Math.PI*2;
  const magnitude=.18+random01()*.62;
  living.target.set(Math.cos(angle)*magnitude,Math.sin(angle)*magnitude*.76);
  living.nextChange=now+(13000+random01()*29000);
  living.transitionRate=.025+random01()*.055;
}
function makeGeometry(rayCount){
  const rays=Math.max(32,Math.min(80,Math.round(rayCount/4)*4));
  const count=(rays+1)*(RADIAL_SEGMENTS+1);
  const positions=new Float32Array(count*3);
  const aU=new Float32Array(count);
  const aV=new Float32Array(count);
  const aRayJitter=new Float32Array(count);
  const indices=[];
  const rayJitters=[];
  for(let j=0;j<=rays;j++){
    const v=j/rays;
    const n=Math.sin((j+1)*12.9898+78.233)*43758.5453;
    const m=Math.sin((j+7)*4.123+21.731)*15731.743;
    rayJitters[j]=((n-Math.floor(n))-.5)*1.4+((m-Math.floor(m))-.5)*.6;
    for(let i=0;i<=RADIAL_SEGMENTS;i++){
      const idx=j*(RADIAL_SEGMENTS+1)+i;
      aU[idx]=i/RADIAL_SEGMENTS;
      aV[idx]=v;
      aRayJitter[idx]=rayJitters[j];
    }
  }
  for(let j=0;j<rays;j++){
    for(let i=0;i<RADIAL_SEGMENTS;i++){
      const a=j*(RADIAL_SEGMENTS+1)+i;
      const b=a+RADIAL_SEGMENTS+1;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(positions,3));
  g.setAttribute('aU',new THREE.BufferAttribute(aU,1));
  g.setAttribute('aV',new THREE.BufferAttribute(aV,1));
  g.setAttribute('aRayJitter',new THREE.BufferAttribute(aRayJitter,1));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}
function color(hex){return new THREE.Color(hex);}
function makeMaterial(layer,preset){
  const p=preset.params;
  const material=new THREE.ShaderMaterial({
    vertexShader:BETTA_VERTEX_SHADER,
    fragmentShader:BETTA_FRAGMENT_SHADER,
    transparent:true,
    depthTest:true,
    depthWrite:false,
    side:THREE.DoubleSide,
    blending:THREE.NormalBlending,
    uniforms:{
      uTime:{value:0},uSeed:{value:layer.seed},uPhase:{value:layer.phase||0},
      uSpread:{value:p.spread},uFoldDensity:{value:p.foldDensity},uCurl:{value:p.curl},uTwist:{value:p.twist},
      uEdgeFlutter:{value:p.edgeFlutter},uDepth:{value:p.depth},uCurrentStrength:{value:p.currentStrength},
      uMotionSpeed:{value:p.motionSpeed},uTurbulence:{value:p.turbulence},uMotionAmplitude:{value:p.motionAmplitude},
      uCurrent:{value:living.current.clone()},
      uOpacity:{value:p.opacity},uTransmission:{value:p.transmission},uRimStrength:{value:p.rimStrength},
      uFoldHighlight:{value:p.foldHighlight},uIridescence:{value:p.iridescence},uBloom:{value:p.bloom},
      uSaturation:{value:p.saturation},uBrightness:{value:p.brightness},uGradientPosition:{value:p.gradientPosition},
      uLayerAlpha:{value:layer.alpha??1},
      uColor0:{value:color(preset.palette[0])},uColor1:{value:color(preset.palette[1])},
      uColor2:{value:color(preset.palette[2])},uColor3:{value:color(preset.palette[3])}
    }
  });
  return material;
}
function clearFins(){
  for(const mesh of meshes)scene.remove(mesh);
  for(const material of materials)material.dispose();
  meshes.length=0;materials.length=0;
}
function buildFins({rebuildGeometry=true}={}){
  clearFins();
  if(rebuildGeometry){
    sharedGeometry?.dispose();
    sharedGeometry=makeGeometry(active.params.rayCount);
  }
  active.layers.forEach((layer,index)=>{
    const material=makeMaterial(layer,active);
    const mesh=new THREE.Mesh(sharedGeometry,material);
    const common=active.params;
    const s=common.scale*(layer.scale||1);
    mesh.scale.setScalar(s);
    mesh.rotation.z=common.rotation+(layer.rotation||0);
    mesh.position.set(common.offsetX+(layer.offset?.[0]||0),common.offsetY+(layer.offset?.[1]||0),common.cameraDepth+(layer.offset?.[2]||0));
    mesh.renderOrder=index;
    // Vertex positions are reconstructed in GLSL from radial attributes, so the CPU-side
    // zero-position buffer cannot provide a meaningful frustum-culling bound.
    mesh.frustumCulled=false;
    scene.add(mesh);meshes.push(mesh);materials.push(material);
  });
}
function applyUniforms(){
  const p=active.params;
  for(const material of materials){
    const u=material.uniforms;
    u.uSpread.value=p.spread;u.uFoldDensity.value=p.foldDensity;u.uCurl.value=p.curl;u.uTwist.value=p.twist;
    u.uEdgeFlutter.value=p.edgeFlutter;u.uDepth.value=p.depth;u.uCurrentStrength.value=p.currentStrength;
    u.uMotionSpeed.value=p.motionSpeed;u.uTurbulence.value=p.turbulence;u.uMotionAmplitude.value=p.motionAmplitude;
    u.uOpacity.value=p.opacity;u.uTransmission.value=p.transmission;u.uRimStrength.value=p.rimStrength;
    u.uFoldHighlight.value=p.foldHighlight;u.uIridescence.value=p.iridescence;u.uBloom.value=p.bloom;
    u.uSaturation.value=p.saturation;u.uBrightness.value=p.brightness;u.uGradientPosition.value=p.gradientPosition;
  }
  active.layers.forEach((layer,index)=>{
    const mesh=meshes[index];
    if(!mesh)return;
    const s=p.scale*(layer.scale||1);
    mesh.scale.setScalar(s);
    mesh.rotation.z=p.rotation+(layer.rotation||0);
    mesh.position.set(p.offsetX+(layer.offset?.[0]||0),p.offsetY+(layer.offset?.[1]||0),p.cameraDepth+(layer.offset?.[2]||0));
  });
}
function resize(){
  const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  camera.position.z=w/h<.7?10.4:9;
  camera.updateProjectionMatrix();
}
function updateControls(){
  for(const input of inputs){
    const key=input.dataset.param;
    input.value=String(active.params[key]);
    const out=outputs.get(key);
    if(out)out.value=key==='rayCount'?String(active.params[key]):Number(active.params[key]).toFixed(2);
  }
}
function applyPreset(key){
  if(!BETTA_PRESETS[key])return;
  activeKey=key;
  active=clonePreset(key);
  scene.background=color(active.background);
  descriptionEl.textContent=active.description;
  sheetPresetName.textContent=active.name;
  document.querySelectorAll('[data-preset]').forEach(btn=>btn.classList.toggle('is-active',btn.dataset.preset===key));
  buildFins({rebuildGeometry:true});
  updateControls();
}
function diagnostics(){
  const info=renderer.info;
  const tris=info.render.triangles;
  const draws=info.render.calls;
  diagnosticsEl.textContent=`${fps||'—'} fps · ${draws} draw${draws===1?'':'s'} · ${tris.toLocaleString()} tris · DPR ${DPR}`;
}
function animate(now){
  const rawDelta=Math.min(50,Math.max(0,now-previousNow));
  previousNow=now;
  if(now>=living.nextChange)scheduleCurrent(now);
  const motionFactor=reduceMotion?.35:1;
  const response=1-Math.exp(-rawDelta*living.transitionRate*.015);
  living.current.lerp(living.target,response);
  living.current.addScaledVector(drag.impulse,.012);
  living.current.addScaledVector(living.tilt,.006);
  drag.impulse.multiplyScalar(.94);
  activeTime+=rawDelta*.001*motionFactor;
  for(const material of materials){
    material.uniforms.uTime.value=activeTime;
    material.uniforms.uCurrent.value.copy(living.current);
  }
  renderer.render(scene,camera);
  frameCount++;
  if(now-sampleStart>=700){
    fps=Math.round(frameCount*1000/(now-sampleStart));
    frameCount=0;sampleStart=now;diagnostics();
  }
  raf=requestAnimationFrame(animate);
}
function start(){
  if(raf)return;
  previousNow=performance.now();
  sampleStart=previousNow;frameCount=0;
  raf=requestAnimationFrame(animate);
}
function stop(){
  if(!raf)return;
  cancelAnimationFrame(raf);raf=0;
}
function openTune(open){
  tuneSheet.classList.toggle('is-open',open);
  tuneSheet.setAttribute('aria-hidden',String(!open));
  tuneButton.setAttribute('aria-expanded',String(open));
}
document.querySelectorAll('[data-preset]').forEach(btn=>btn.addEventListener('click',()=>applyPreset(btn.dataset.preset)));
tuneButton.addEventListener('click',()=>openTune(!tuneSheet.classList.contains('is-open')));
closeTune.addEventListener('click',()=>openTune(false));
uiToggle.addEventListener('click',()=>{
  const show=uiSpecimen.hidden;
  uiSpecimen.hidden=!show;
  uiToggle.setAttribute('aria-pressed',String(show));
});
inputs.forEach(input=>input.addEventListener('input',()=>{
  const key=input.dataset.param;
  const value=Number(input.value);
  active.params[key]=value;
  const out=outputs.get(key);
  if(out)out.value=key==='rayCount'?String(Math.round(value)):value.toFixed(2);
  if(key==='rayCount')buildFins({rebuildGeometry:true});else applyUniforms();
}));
canvas.addEventListener('pointerdown',event=>{
  drag.active=true;drag.lastX=event.clientX;drag.lastY=event.clientY;canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(!drag.active)return;
  const dx=(event.clientX-drag.lastX)/Math.max(innerWidth,1);
  const dy=(event.clientY-drag.lastY)/Math.max(innerHeight,1);
  drag.impulse.x+=dx*1.8;drag.impulse.y-=dy*1.8;
  drag.lastX=event.clientX;drag.lastY=event.clientY;
});
const release=()=>{drag.active=false};
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);

async function enableTilt(){
  if(typeof DeviceOrientationEvent==='undefined'){
    tiltButton.textContent='No tilt';return;
  }
  try{
    if(typeof DeviceOrientationEvent.requestPermission==='function'){
      const answer=await DeviceOrientationEvent.requestPermission();
      if(answer!=='granted')return;
    }
    living.enabledTilt=!living.enabledTilt;
    tiltButton.setAttribute('aria-pressed',String(living.enabledTilt));
    tiltButton.textContent=living.enabledTilt?'Tilt on':'Tilt';
  }catch(error){
    console.warn('Tilt permission unavailable',error);
  }
}
tiltButton.addEventListener('click',enableTilt);
addEventListener('deviceorientation',event=>{
  if(!living.enabledTilt)return;
  living.tilt.set(
    THREE.MathUtils.clamp((event.gamma||0)/45,-1,1),
    THREE.MathUtils.clamp(-(event.beta||0)/70,-1,1)
  ).multiplyScalar(.28);
});
addEventListener('resize',resize,{passive:true});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)stop();else start();
});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',event=>{reduceMotion=event.matches});

scheduleCurrent(performance.now());
resize();
applyPreset(DEFAULT_PRESET);
start();

window.SindhornBettaLab={
  renderer:'betta-radial-membrane-v1',
  getDiagnostics(){
    const gl=renderer.getContext();
    const attrs=gl.getContextAttributes?.()||{};
    return{
      preset:activeKey,
      dpr:DPR,
      canvasWidth:canvas.width,canvasHeight:canvas.height,
      width:innerWidth,height:innerHeight,
      drawCalls:renderer.info.render.calls,
      triangles:renderer.info.render.triangles,
      geometries:renderer.info.memory.geometries,
      textures:renderer.info.memory.textures,
      antialias:attrs.antialias,
      preserveDrawingBuffer:attrs.preserveDrawingBuffer,
      fps
    };
  },
  setPreset:applyPreset,
  getPreset:()=>clonePreset(activeKey)
};
