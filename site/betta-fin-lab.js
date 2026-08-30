import * as THREE from './vendor/three.module.js';
import {BETTA_PRESETS,DEFAULT_PRESET,clonePreset} from './betta-fin-presets.js';
import {BETTA_VERTEX_SHADER,BETTA_FRAGMENT_SHADER} from './betta-fin-shader.js';
import {startSatelliteStream,SATELLITE_SOURCE} from './betta-satellite.js';

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
const sheetPresetName=document.querySelector('#sheetPresetName');
const satellitePanel=document.querySelector('#satellitePanel');
const satelliteStatusEl=document.querySelector('#satelliteStatus');
const satelliteObservedEl=document.querySelector('#satelliteObserved');
const satelliteMetricEls=new Map([...document.querySelectorAll('[data-satellite]')].map(el=>[el.dataset.satellite,el]));
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
let raf=0;
let activeTime=0;
let previousNow=performance.now();
let sampleStart=performance.now();
let frameCount=0;
let fps=0;
let reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

const neutralDrivers={
  energy:.58,cloud:.35,cold:.35,cooling:0,texture:.32,vapor:.42,
  motion:[0,0],color:[.18,.23,.52],visible:0,fingerprint:[.5,.5,.5]
};
const copyDrivers=source=>({
  energy:source.energy,cloud:source.cloud,cold:source.cold,cooling:source.cooling,texture:source.texture,vapor:source.vapor,
  motion:[...source.motion],color:[...source.color],visible:source.visible,fingerprint:[...source.fingerprint]
});
const satellite={
  status:'loading',state:null,error:null,
  current:copyDrivers(neutralDrivers),target:copyDrivers(neutralDrivers),
  transitionBoost:0
};

const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));
const lerp=(a,b,t)=>a+(b-a)*t;

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
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('aU',new THREE.BufferAttribute(aU,1));
  geometry.setAttribute('aV',new THREE.BufferAttribute(aV,1));
  geometry.setAttribute('aRayJitter',new THREE.BufferAttribute(aRayJitter,1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
function color(hex){return new THREE.Color(hex)}
function makeMaterial(layer,preset){
  const p=preset.params;
  const s=satellite.current;
  return new THREE.ShaderMaterial({
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
      uCurrent:{value:new THREE.Vector2(s.motion[0],s.motion[1])},
      uOpacity:{value:p.opacity},uTransmission:{value:p.transmission},uRimStrength:{value:p.rimStrength},
      uFoldHighlight:{value:p.foldHighlight},uIridescence:{value:p.iridescence},uBloom:{value:p.bloom},
      uSaturation:{value:p.saturation},uBrightness:{value:p.brightness},uGradientPosition:{value:p.gradientPosition},
      uLayerAlpha:{value:layer.alpha??1},uMorphMode:{value:preset.morphMode||0},
      uColor0:{value:color(preset.palette[0])},uColor1:{value:color(preset.palette[1])},
      uColor2:{value:color(preset.palette[2])},uColor3:{value:color(preset.palette[3])},
      uSatelliteEnergy:{value:s.energy},uSatelliteCloud:{value:s.cloud},uSatelliteCold:{value:s.cold},
      uSatelliteCooling:{value:s.cooling},uSatelliteTexture:{value:s.texture},uSatelliteVapor:{value:s.vapor},
      uSatelliteVisible:{value:s.visible},uSatelliteMotion:{value:new THREE.Vector2(s.motion[0],s.motion[1])},
      uSatelliteColor:{value:new THREE.Vector3(...s.color)},uSatelliteFingerprint:{value:new THREE.Vector3(...s.fingerprint)}
    }
  });
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
    const scale=common.scale*(layer.scale||1);
    mesh.scale.setScalar(scale);
    mesh.rotation.z=common.rotation+(layer.rotation||0);
    mesh.position.set(common.offsetX+(layer.offset?.[0]||0),common.offsetY+(layer.offset?.[1]||0),common.cameraDepth+(layer.offset?.[2]||0));
    mesh.renderOrder=index;
    mesh.frustumCulled=false;
    scene.add(mesh);meshes.push(mesh);materials.push(material);
  });
}
function applyBaseUniforms(){
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
    const scale=p.scale*(layer.scale||1);
    mesh.scale.setScalar(scale);
    mesh.rotation.z=p.rotation+(layer.rotation||0);
    mesh.position.set(p.offsetX+(layer.offset?.[0]||0),p.offsetY+(layer.offset?.[1]||0),p.cameraDepth+(layer.offset?.[2]||0));
  });
}
function applySatelliteUniforms(){
  const s=satellite.current;
  for(const material of materials){
    const u=material.uniforms;
    u.uCurrent.value.set(s.motion[0],s.motion[1]);
    u.uSatelliteEnergy.value=s.energy;
    u.uSatelliteCloud.value=s.cloud;
    u.uSatelliteCold.value=s.cold;
    u.uSatelliteCooling.value=s.cooling;
    u.uSatelliteTexture.value=s.texture;
    u.uSatelliteVapor.value=s.vapor;
    u.uSatelliteVisible.value=s.visible;
    u.uSatelliteMotion.value.set(s.motion[0],s.motion[1]);
    u.uSatelliteColor.value.set(s.color[0],s.color[1],s.color[2]);
    u.uSatelliteFingerprint.value.set(s.fingerprint[0],s.fingerprint[1],s.fingerprint[2]);
  }
  const base=color(active.background);
  const satelliteTint=new THREE.Color(s.color[0],s.color[1],s.color[2]);
  scene.background=base.lerp(satelliteTint,.025+.025*s.cloud+.018*s.visible);
}
function easeSatellite(deltaMs){
  const seconds=deltaMs*.001;
  const boost=satellite.transitionBoost;
  const response=1-Math.exp(-seconds*(.13+boost*.22));
  const c=satellite.current,t=satellite.target;
  for(const key of ['energy','cloud','cold','cooling','texture','vapor','visible'])c[key]=lerp(c[key],t[key],response);
  for(let i=0;i<2;i++)c.motion[i]=lerp(c.motion[i],t.motion[i],response);
  for(let i=0;i<3;i++){
    c.color[i]=lerp(c.color[i],t.color[i],response);
    c.fingerprint[i]=lerp(c.fingerprint[i],t.fingerprint[i],response);
  }
  satellite.transitionBoost=Math.max(0,boost-seconds*.055);
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
  descriptionEl.textContent=active.description;
  sheetPresetName.textContent=active.name;
  document.querySelectorAll('[data-preset]').forEach(btn=>btn.classList.toggle('is-active',btn.dataset.preset===key));
  buildFins({rebuildGeometry:true});
  updateControls();
  applySatelliteUniforms();
}
function formatObserved(value){
  const date=new Date(String(value).replace(' ','T')+'Z');
  if(!Number.isFinite(date.getTime()))return String(value||'');
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
}
function setMetric(key,value){
  const el=satelliteMetricEls.get(key);if(el)el.textContent=value;
}
function updateSatellitePanel(){
  satellitePanel?.classList.toggle('is-live',satellite.status==='live');
  satellitePanel?.classList.toggle('is-error',satellite.status==='error');
  if(satellite.status==='live'&&satellite.state){
    const m=satellite.state.metrics;
    satelliteStatusEl.textContent='HIMAWARI-9 · LIVE';
    satelliteObservedEl.textContent=`Observed ${formatObserved(satellite.state.observedAt)} Bangkok · 10 min cadence`;
    setMetric('cloud',`${Math.round(m.cloudAmount*100)}%`);
    setMetric('motion',`${m.motionMagnitude.toFixed(1)} px`);
    setMetric('cold',m.coldCloud.toFixed(2));
    setMetric('vapor',m.waterVapor.toFixed(2));
    setMetric('energy',m.energy.toFixed(2));
    setMetric('fingerprint',m.fingerprint.toUpperCase());
  }else if(satellite.status==='error'){
    satelliteStatusEl.textContent='HIMAWARI-9 · SIGNAL RETRYING';
    satelliteObservedEl.textContent=satellite.error||'Satellite imagery temporarily unavailable';
  }else{
    satelliteStatusEl.textContent='HIMAWARI-9 · CONNECTING';
    satelliteObservedEl.textContent='Reading current Bangkok satellite field…';
  }
}
function diagnostics(){
  const info=renderer.info;
  const tris=info.render.triangles;
  const draws=info.render.calls;
  const sat=satellite.status==='live'?'sat live':satellite.status;
  diagnosticsEl.textContent=`${fps||'—'} fps · ${draws} draw${draws===1?'':'s'} · ${tris.toLocaleString()} tris · DPR ${DPR} · ${sat}`;
}
function animate(now){
  const rawDelta=Math.min(50,Math.max(0,now-previousNow));
  previousNow=now;
  const motionFactor=reduceMotion?.35:1;
  activeTime+=rawDelta*.001*motionFactor;
  easeSatellite(rawDelta);
  applySatelliteUniforms();
  for(const material of materials)material.uniforms.uTime.value=activeTime;
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
  if(key==='rayCount')buildFins({rebuildGeometry:true});else applyBaseUniforms();
  applySatelliteUniforms();
}));
addEventListener('resize',resize,{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start()});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',event=>{reduceMotion=event.matches});

updateSatellitePanel();
resize();
applyPreset(DEFAULT_PRESET);
start();
const stopSatellite=startSatelliteStream({
  onState(state){
    const changed=satellite.state?.observedAt!==state.observedAt;
    satellite.status='live';satellite.error=null;satellite.state=state;satellite.target=copyDrivers(state.drivers);
    if(changed)satellite.transitionBoost=1;
    updateSatellitePanel();
  },
  onError(error){
    satellite.error=error?.message||String(error);
    if(!satellite.state)satellite.status='error';
    updateSatellitePanel();
  }
});
addEventListener('pagehide',stopSatellite,{once:true});

window.SindhornBettaLab={
  renderer:'betta-radial-membrane-v2-himawari',
  inputMode:'satellite-only',
  satelliteSource:SATELLITE_SOURCE,
  getDiagnostics(){
    const gl=renderer.getContext();
    const attrs=gl.getContextAttributes?.()||{};
    return{
      preset:activeKey,
      inputMode:'satellite-only',
      satelliteStatus:satellite.status,
      satelliteObservedAt:satellite.state?.observedAt||null,
      satelliteEnergy:satellite.state?.metrics?.energy??null,
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
  getSatelliteState(){return satellite.state?JSON.parse(JSON.stringify(satellite.state)):{status:satellite.status,error:satellite.error}},
  setPreset:applyPreset,
  getPreset:()=>clonePreset(activeKey)
};