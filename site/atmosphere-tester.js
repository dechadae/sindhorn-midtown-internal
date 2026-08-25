import * as THREE from './vendor/three.module.js';

const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const mix=(a,b,t)=>a+(b-a)*t;
const defaults={
  solarAltitude:38,temperature:31,humidity:72,visibility:24,cloudCover:18,stormDarkness:0,fog:0,heatHaze:8,
  rain:0,snow:0,hail:0,lightning:0,windSpeed:8,windDirection:225,pm25:12,dust:0,smoke:0
};

const presets={
  'Clear tropical day':{solarAltitude:58,temperature:33,humidity:62,visibility:35,cloudCover:5,stormDarkness:0,fog:0,heatHaze:15,rain:0,snow:0,hail:0,lightning:0,windSpeed:7,windDirection:210,pm25:10,dust:0,smoke:0},
  'Partly cloudy':{solarAltitude:42,temperature:31,humidity:72,visibility:28,cloudCover:48,stormDarkness:0,fog:0,heatHaze:5,rain:0,snow:0,hail:0,lightning:0,windSpeed:12,windDirection:220,pm25:15,dust:0,smoke:0},
  'Overcast humid':{solarAltitude:34,temperature:29,humidity:86,visibility:18,cloudCover:96,stormDarkness:20,fog:4,heatHaze:0,rain:0,snow:0,hail:0,lightning:0,windSpeed:14,windDirection:205,pm25:18,dust:0,smoke:0},
  'Dense fog':{solarAltitude:14,temperature:18,humidity:100,visibility:.5,cloudCover:72,stormDarkness:4,fog:98,heatHaze:0,rain:0,snow:0,hail:0,lightning:0,windSpeed:2,windDirection:90,pm25:8,dust:0,smoke:0},
  'Fog + drizzle':{solarAltitude:18,temperature:17,humidity:100,visibility:1.2,cloudCover:92,stormDarkness:12,fog:82,heatHaze:0,rain:20,snow:0,hail:0,lightning:0,windSpeed:7,windDirection:130,pm25:10,dust:0,smoke:0},
  'Drizzle':{solarAltitude:26,temperature:26,humidity:94,visibility:12,cloudCover:94,stormDarkness:16,fog:8,heatHaze:0,rain:18,snow:0,hail:0,lightning:0,windSpeed:10,windDirection:210,pm25:12,dust:0,smoke:0},
  'Steady rain':{solarAltitude:25,temperature:27,humidity:96,visibility:8,cloudCover:100,stormDarkness:38,fog:10,heatHaze:0,rain:55,snow:0,hail:0,lightning:0,windSpeed:24,windDirection:220,pm25:8,dust:0,smoke:0},
  'Monsoon rain':{solarAltitude:24,temperature:28,humidity:99,visibility:4,cloudCover:100,stormDarkness:56,fog:18,heatHaze:0,rain:92,snow:0,hail:0,lightning:18,windSpeed:48,windDirection:225,pm25:6,dust:0,smoke:0},
  'Thunderstorm':{solarAltitude:20,temperature:29,humidity:96,visibility:5,cloudCover:100,stormDarkness:78,fog:8,heatHaze:0,rain:82,snow:0,hail:8,lightning:82,windSpeed:58,windDirection:230,pm25:7,dust:0,smoke:0},
  'Tropical storm':{solarAltitude:16,temperature:29,humidity:100,visibility:2.5,cloudCover:100,stormDarkness:88,fog:22,heatHaze:0,rain:96,snow:0,hail:4,lightning:58,windSpeed:105,windDirection:215,pm25:4,dust:0,smoke:0},
  'Typhoon / cyclone':{solarAltitude:12,temperature:28,humidity:100,visibility:1.2,cloudCover:100,stormDarkness:100,fog:32,heatHaze:0,rain:100,snow:0,hail:10,lightning:72,windSpeed:175,windDirection:205,pm25:3,dust:0,smoke:0},
  'Heat wave':{solarAltitude:66,temperature:44,humidity:32,visibility:32,cloudCover:3,stormDarkness:0,fog:0,heatHaze:100,rain:0,snow:0,hail:0,lightning:0,windSpeed:9,windDirection:165,pm25:28,dust:12,smoke:0},
  'Hazy heat wave':{solarAltitude:58,temperature:42,humidity:38,visibility:5,cloudCover:8,stormDarkness:0,fog:0,heatHaze:92,rain:0,snow:0,hail:0,lightning:0,windSpeed:5,windDirection:180,pm25:125,dust:35,smoke:12},
  'Snow':{solarAltitude:18,temperature:-4,humidity:88,visibility:12,cloudCover:96,stormDarkness:22,fog:8,heatHaze:0,rain:0,snow:48,hail:0,lightning:0,windSpeed:16,windDirection:310,pm25:4,dust:0,smoke:0},
  'Heavy snow':{solarAltitude:10,temperature:-7,humidity:94,visibility:3,cloudCover:100,stormDarkness:44,fog:18,heatHaze:0,rain:0,snow:90,hail:0,lightning:0,windSpeed:32,windDirection:320,pm25:3,dust:0,smoke:0},
  'Blizzard':{solarAltitude:4,temperature:-12,humidity:96,visibility:.8,cloudCover:100,stormDarkness:62,fog:28,heatHaze:0,rain:0,snow:100,hail:8,lightning:0,windSpeed:105,windDirection:325,pm25:2,dust:0,smoke:0},
  'Sleet · rain + snow':{solarAltitude:12,temperature:1,humidity:98,visibility:5,cloudCover:100,stormDarkness:40,fog:14,heatHaze:0,rain:48,snow:52,hail:6,lightning:0,windSpeed:30,windDirection:300,pm25:4,dust:0,smoke:0},
  'Freezing rain':{solarAltitude:8,temperature:-1,humidity:100,visibility:4,cloudCover:100,stormDarkness:46,fog:18,heatHaze:0,rain:66,snow:6,hail:18,lightning:0,windSpeed:24,windDirection:285,pm25:3,dust:0,smoke:0},
  'Thundersnow':{solarAltitude:3,temperature:-6,humidity:96,visibility:2,cloudCover:100,stormDarkness:76,fog:18,heatHaze:0,rain:0,snow:96,hail:10,lightning:68,windSpeed:65,windDirection:315,pm25:2,dust:0,smoke:0},
  'Hail storm':{solarAltitude:22,temperature:9,humidity:92,visibility:4,cloudCover:100,stormDarkness:72,fog:4,heatHaze:0,rain:58,snow:0,hail:88,lightning:72,windSpeed:70,windDirection:270,pm25:5,dust:0,smoke:0},
  'Dust storm':{solarAltitude:30,temperature:37,humidity:18,visibility:.8,cloudCover:16,stormDarkness:28,fog:0,heatHaze:34,rain:0,snow:0,hail:0,lightning:5,windSpeed:92,windDirection:250,pm25:180,dust:100,smoke:0},
  'Smoke haze':{solarAltitude:24,temperature:32,humidity:46,visibility:2.2,cloudCover:12,stormDarkness:8,fog:0,heatHaze:16,rain:0,snow:0,hail:0,lightning:0,windSpeed:4,windDirection:170,pm25:260,dust:8,smoke:92},
  'Cold clear night':{solarAltitude:-15,temperature:-8,humidity:54,visibility:40,cloudCover:2,stormDarkness:0,fog:0,heatHaze:0,rain:0,snow:0,hail:0,lightning:0,windSpeed:4,windDirection:350,pm25:5,dust:0,smoke:0},
  'Night thunderstorm':{solarAltitude:-12,temperature:25,humidity:98,visibility:4,cloudCover:100,stormDarkness:90,fog:12,heatHaze:0,rain:86,snow:0,hail:6,lightning:94,windSpeed:62,windDirection:220,pm25:5,dust:0,smoke:0}
};

const state={...defaults};
window.__atmosphereTesterState=window.__atmosphereTesterState||{weather:{known:true,weatherCode:0,precipitationMm:0}};
window.__sindhornRainPaneEnabled=true;
window.SindhornEnvironment=window.SindhornEnvironment||{getState:()=>window.__atmosphereTesterState};

const stage=document.getElementById('environmentStage');
const canvas=document.getElementById('testerAtmosphereCanvas');
const panel=document.getElementById('controlsPanel');
const badge=document.getElementById('conditionBadge');
const readout=document.getElementById('stateReadout');
const presetSelect=document.getElementById('presetSelect');
const paneToggle=document.getElementById('paneDrops');
const DPR=Math.min(2,Math.max(1,window.devicePixelRatio||1));

let renderer,scene,camera,geometry,material,uniforms,startTime=performance.now(),raf=0,lastFrame=performance.now();
let width=1,height=1,flash=0,nextFlashAt=0;
let snowCanvas,snowCtx,hailCanvas,hailCtx;

function initRenderer(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',precision:'highp'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setPixelRatio(DPR);
  scene=new THREE.Scene();
  camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  geometry=new THREE.PlaneGeometry(2,2);
  uniforms={
    uTime:{value:0},uResolution:{value:new THREE.Vector2(1,1)},uSolarAltitude:{value:state.solarAltitude},uTemperature:{value:state.temperature},
    uHumidity:{value:state.humidity/100},uVisibility:{value:state.visibility},uCloudCover:{value:state.cloudCover/100},uStorm:{value:state.stormDarkness/100},
    uFog:{value:state.fog/100},uHeat:{value:state.heatHaze/100},uWind:{value:state.windSpeed},uWindDirection:{value:state.windDirection},
    uPm25:{value:state.pm25},uDust:{value:state.dust/100},uSmoke:{value:state.smoke/100},uFlash:{value:0}
  };
  material=new THREE.ShaderMaterial({uniforms,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,fragmentShader:`precision highp float;
varying vec2 vUv;uniform float uTime,uSolarAltitude,uTemperature,uHumidity,uVisibility,uCloudCover,uStorm,uFog,uHeat,uWind,uWindDirection,uPm25,uDust,uSmoke,uFlash;uniform vec2 uResolution;
float sat(float x){return clamp(x,0.0,1.0);}float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}float fbm(vec2 p){float v=0.0,a=.52;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(17.13,9.37);a*=.5;}return v;}vec3 saturation(vec3 c,float s){float l=dot(c,vec3(.2126,.7152,.0722));return mix(vec3(l),c,s);}vec3 toLinear(vec3 c){return c*c;}vec3 toDisplay(vec3 c){return sqrt(max(c,vec3(0.0)));}
vec3 skyPalette(vec2 uv){float e=uSolarAltitude;vec3 dayTop=vec3(.23,.48,.76),dayHor=vec3(.72,.84,.91),goldTop=vec3(.38,.50,.76),goldHor=vec3(.95,.63,.43),twiTop=vec3(.063,.11,.28),twiHor=vec3(.14,.28,.52),nightTop=vec3(.026,.055,.13),nightHor=vec3(.067,.105,.22);vec3 top,hor;if(e>=8.0){top=dayTop;hor=dayHor;}else if(e>=0.0){float t=smoothstep(0.0,8.0,e);top=mix(goldTop,dayTop,t);hor=mix(goldHor,dayHor,t);}else if(e>=-8.0){float t=smoothstep(-8.0,0.0,e);top=mix(twiTop,goldTop,t);hor=mix(twiHor,goldHor,t);}else{float t=smoothstep(-18.0,-8.0,e);top=mix(nightTop,twiTop,t);hor=mix(nightHor,twiHor,t);}float y=smoothstep(.02,.96,uv.y);vec3 c=toDisplay(mix(toLinear(hor),toLinear(top),y));float hot=smoothstep(36.0,46.0,uTemperature);c=mix(c,c*vec3(1.08,.98,.86)+vec3(.05,.025,0.0),hot*.32);float cold=smoothstep(4.0,-18.0,uTemperature);c=mix(c,c*vec3(.86,.94,1.12),cold*.24);return c;}
void main(){vec2 uv=vUv;float horizon=pow(sat(1.0-uv.y),1.45);float shimmer=(noise(vec2(uv.y*110.0+uTime*1.8,uv.x*8.0))-0.5)*.010*uHeat*pow(horizon,1.6);uv.x+=shimmer;vec3 c=skyPalette(uv);float aspect=clamp(uResolution.x/max(uResolution.y,1.0),.4,2.5);float windAngle=radians(uWindDirection);vec2 drift=vec2(sin(windAngle),-cos(windAngle))*uTime*(.006+.00015*uWind);vec2 p=vec2(uv.x*aspect,uv.y);float broad=fbm((p+drift*.35)*vec2(1.15,.78)),mid=fbm((p+drift*.65)*vec2(2.15,1.30)+vec2(broad*.55,7.2)),fine=fbm((p+drift)*vec2(4.0,2.35)+vec2(mid*.40,19.0));float field=broad*.54+mid*.31+fine*.15;float threshold=mix(.82,.34,uCloudCover);float cloud=smoothstep(threshold-.12,threshold+.10,field);float over=smoothstep(.78,.98,uCloudCover);cloud=max(cloud,over*(.64+.36*smoothstep(.24,.74,field)));float relief=smoothstep(.28,.84,field);float night=1.0-smoothstep(-7.0,8.0,uSolarAltitude);vec3 cloudDay=mix(vec3(.46,.49,.54),vec3(.91,.92,.93),relief);vec3 cloudNight=mix(vec3(.08,.095,.14),vec3(.24,.28,.34),relief);vec3 cc=mix(cloudDay,cloudNight,night);cc=mix(cc,vec3(.08,.09,.12),uStorm*.78);float cloudAlpha=mix(.30,.94,uCloudCover);c=mix(c,cc,cloud*cloudAlpha);float sunY=clamp(.13+clamp((uSolarAltitude+2.0)/82.0,0.0,1.0)*.72,.08,.88);vec2 sd=uv-vec2(.72,sunY);sd.x*=aspect;float sunDist=length(sd);float sunAbove=smoothstep(-4.0,1.0,uSolarAltitude);float sunGlow=exp(-sunDist*23.0)*sunAbove*(1.0-cloud*.82);c+=mix(vec3(1.0,.58,.30),vec3(1.0,.96,.82),smoothstep(5.0,40.0,uSolarAltitude))*sunGlow*.20;float fogVis=1.0-smoothstep(.5,18.0,uVisibility);float fog=max(uFog,fogVis);vec3 fogColor=mix(vec3(.70,.74,.76),vec3(.18,.20,.25),night);c=mix(c,fogColor,sat(fog*(.16+.72*horizon)));float pm=sat(uPm25/220.0),dust=sat(uDust),smoke=sat(uSmoke);c=saturation(c,1.0-pm*.58-smoke*.34);c=mix(c,vec3(.61,.56,.50),pm*(.05+.35*horizon));c=mix(c,vec3(.62,.49,.34),dust*(.08+.46*horizon));c=mix(c,vec3(.38,.40,.42),smoke*(.06+.42*horizon));float humidityHaze=pow(horizon,1.6)*uHumidity*.12;c=mix(c,vec3(.66,.67,.66),humidityHaze);float stars=step(.997,hash(floor(uv*uResolution/3.0)))*(1.0-smoothstep(-14.0,-6.0,uSolarAltitude));c+=vec3(.65,.72,.88)*stars*.18*(1.0-cloud);c+=vec3(.78,.86,1.0)*uFlash*(.25+.55*(1.0-uv.y));float vig=smoothstep(1.08,.28,length((uv-vec2(.5,.52))*vec2(aspect,1.0)));c*=mix(.90,1.0,vig);c+=(hash(gl_FragCoord.xy+vec2(uTime*31.0,uTime*17.0))-.5)/255.0;gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);}`});
  scene.add(new THREE.Mesh(geometry,material));
  resize();
}

function createOverlayCanvas(id,z){
  const c=document.createElement('canvas');c.id=id;c.setAttribute('aria-hidden','true');Object.assign(c.style,{position:'absolute',inset:'0',zIndex:String(z),pointerEvents:'none',width:'100%',height:'100%'});stage.appendChild(c);return c;
}

const snowParticles=Array.from({length:260},(_,i)=>({x:Math.random(),y:Math.random(),r:1+Math.random()*3.5,s:.10+Math.random()*.42,d:(Math.random()-.5)*.16,p:Math.random()*Math.PI*2}));
const hailParticles=Array.from({length:180},(_,i)=>({x:Math.random(),y:Math.random(),r:.8+Math.random()*2.1,s:.48+Math.random()*1.10,d:(Math.random()-.5)*.10}));

function initPrecipOverlays(){
  snowCanvas=createOverlayCanvas('testerSnowCanvas',4);snowCtx=snowCanvas.getContext('2d',{alpha:true,desynchronized:true});
  hailCanvas=createOverlayCanvas('testerHailCanvas',5);hailCtx=hailCanvas.getContext('2d',{alpha:true,desynchronized:true});
  resize();
}

function resizeCanvas(c,ctx){if(!c||!ctx)return;c.width=Math.round(width*DPR);c.height=Math.round(height*DPR);ctx.setTransform(DPR,0,0,DPR,0,0)}
function resize(){const rect=stage.getBoundingClientRect();width=Math.max(1,Math.round(rect.width));height=Math.max(1,Math.round(rect.height));if(renderer){renderer.setSize(width,height,false);uniforms.uResolution.value.set(width*DPR,height*DPR)}resizeCanvas(snowCanvas,snowCtx);resizeCanvas(hailCanvas,hailCtx)}

function syncUniforms(){
  if(!uniforms)return;
  uniforms.uSolarAltitude.value=state.solarAltitude;uniforms.uTemperature.value=state.temperature;uniforms.uHumidity.value=state.humidity/100;uniforms.uVisibility.value=state.visibility;uniforms.uCloudCover.value=state.cloudCover/100;uniforms.uStorm.value=state.stormDarkness/100;uniforms.uFog.value=state.fog/100;uniforms.uHeat.value=state.heatHaze/100;uniforms.uWind.value=state.windSpeed;uniforms.uWindDirection.value=state.windDirection;uniforms.uPm25.value=state.pm25;uniforms.uDust.value=state.dust/100;uniforms.uSmoke.value=state.smoke/100;
}

function syncProductionRain(){
  const r=state.rain/100;let code=0;if(r>.02){if(state.lightning>25)code=95;else if(r>.78)code=65;else if(r>.52)code=63;else if(r>.24)code=61;else code=51;}
  window.__atmosphereTesterState.weather={known:true,weatherCode:code,precipitationMm:r*12,cloudCover:state.cloudCover/100,windSpeedKmh:state.windSpeed,windDirectionDeg:state.windDirection,humidity:state.humidity/100,visibilityKm:state.visibility,temperatureC:state.temperature};
  window.__sindhornRainPaneEnabled=paneToggle?.checked!==false;
}

function drawSnow(dt,time){
  if(!snowCtx)return;snowCtx.clearRect(0,0,width,height);const intensity=state.snow/100;if(intensity<.005)return;const active=Math.round(22+intensity*(snowParticles.length-22)),wind=(Math.sin(state.windDirection*Math.PI/180)*state.windSpeed/220)*.65;snowCtx.lineCap='round';
  for(let i=0;i<active;i++){const p=snowParticles[i];p.y+=p.s*dt*(.55+intensity*.85);p.x+=(p.d+wind*.16+Math.sin(time*.8+p.p)*.006)*dt;if(p.y>1.03){p.y=-.04;p.x=Math.random()}if(p.x>1.03)p.x-=1.06;if(p.x<-.03)p.x+=1.06;const x=p.x*width,y=p.y*height,r=p.r*(.72+intensity*.55);snowCtx.fillStyle=`rgba(245,248,250,${(.22+.52*intensity).toFixed(3)})`;snowCtx.beginPath();snowCtx.arc(x,y,r,0,Math.PI*2);snowCtx.fill();if(i%7===0&&intensity>.55){snowCtx.strokeStyle=`rgba(255,255,255,${(.12+.18*intensity).toFixed(3)})`;snowCtx.lineWidth=.6;snowCtx.beginPath();snowCtx.moveTo(x-r*1.7,y);snowCtx.lineTo(x+r*1.7,y);snowCtx.moveTo(x,y-r*1.7);snowCtx.lineTo(x,y+r*1.7);snowCtx.stroke()}}
}

function drawHail(dt){
  if(!hailCtx)return;hailCtx.clearRect(0,0,width,height);const intensity=state.hail/100;if(intensity<.005)return;const active=Math.round(10+intensity*(hailParticles.length-10)),wind=(Math.sin(state.windDirection*Math.PI/180)*state.windSpeed/220)*.85;
  for(let i=0;i<active;i++){const p=hailParticles[i];p.y+=p.s*dt*(.75+intensity*.9);p.x+=(p.d+wind*.32)*dt;if(p.y>1.02){p.y=-.03;p.x=Math.random()}if(p.x>1.03)p.x-=1.06;if(p.x<-.03)p.x+=1.06;const x=p.x*width,y=p.y*height,r=p.r*(.8+intensity*.6);hailCtx.fillStyle=`rgba(240,247,250,${(.18+.58*intensity).toFixed(3)})`;hailCtx.beginPath();hailCtx.arc(x,y,r,0,Math.PI*2);hailCtx.fill();hailCtx.strokeStyle=`rgba(160,184,201,${(.12+.28*intensity).toFixed(3)})`;hailCtx.lineWidth=.55;hailCtx.stroke()}
}

function updateLightning(now){const intensity=state.lightning/100;if(intensity<.01){flash*=.78;uniforms.uFlash.value=flash;nextFlashAt=0;return}if(!nextFlashAt)nextFlashAt=now+900+Math.random()*3200*(1.05-intensity*.75);if(now>=nextFlashAt){flash=.48+intensity*.72;nextFlashAt=now+550+Math.random()*Math.max(280,4200*(1.05-intensity));}flash*=.86;uniforms.uFlash.value=flash}

function frame(now){raf=requestAnimationFrame(frame);const dt=Math.min(.04,Math.max(0,(now-lastFrame)/1000));lastFrame=now;uniforms.uTime.value=(now-startTime)/1000;updateLightning(now);drawSnow(dt,now/1000);drawHail(dt);renderer.render(scene,camera)}

function compass(deg){const names=['N','NE','E','SE','S','SW','W','NW'];return names[Math.round((((deg%360)+360)%360)/45)%8]}
function formatValue(key,v){if(key==='solarAltitude'||key==='windDirection')return key==='windDirection'?`${Math.round(v)}° ${compass(v)}`:`${Math.round(v)}°`;if(key==='temperature')return`${Math.round(v)}°C`;if(key==='visibility')return`${Number(v).toFixed(v<10?1:0)} km`;if(key==='windSpeed')return`${Math.round(v)} km/h`;if(key==='pm25')return`${Math.round(v)} µg/m³`;return`${Math.round(v)}%`}

function conditionName(){
  const r=state.rain,s=state.snow,h=state.hail,l=state.lightning,w=state.windSpeed,t=state.temperature,d=state.dust,sm=state.smoke,f=state.fog;
  if(r>25&&s>25&&l>20)return'THUNDERSLEET';if(s>55&&l>25)return'THUNDERSNOW';if(s>60&&w>70)return'BLIZZARD';if(r>25&&s>20)return'SLEET / MIXED PRECIP';if(r>75&&w>90&&t>18)return'TROPICAL STORM';if(r>55&&l>35)return'THUNDERSTORM';if(h>45&&l>20)return'HAIL STORM';if(r>35)return'RAIN';if(r>5)return'DRIZZLE';if(s>50)return'HEAVY SNOW';if(s>5)return'SNOW';if(d>55)return'DUST STORM';if(sm>55)return'SMOKE HAZE';if(t>=39)return'HEAT WAVE';if(f>55||state.visibility<1.2)return'DENSE FOG';if(state.cloudCover>85)return'OVERCAST';if(state.cloudCover>30)return'PARTLY CLOUDY';return state.solarAltitude<-8?'CLEAR NIGHT':'CLEAR';
}

function updateReadout(){
  badge.textContent=conditionName();
  readout.textContent=[
    `condition  ${conditionName()}`,
    `temp       ${state.temperature}°C · RH ${state.humidity}%`,
    `wind       ${state.windSpeed} km/h ${compass(state.windDirection)}`,
    `visibility ${state.visibility} km · cloud ${state.cloudCover}%`,
    `rain ${state.rain}% · snow ${state.snow}% · hail ${state.hail}% · lightning ${state.lightning}%`,
    `PM2.5 ${state.pm25} · dust ${state.dust}% · smoke ${state.smoke}%`
  ].join('\n');
}

const hashKeys={sa:'solarAltitude',t:'temperature',rh:'humidity',v:'visibility',c:'cloudCover',st:'stormDarkness',f:'fog',hh:'heatHaze',r:'rain',sn:'snow',ha:'hail',li:'lightning',ws:'windSpeed',wd:'windDirection',pm:'pm25',d:'dust',sm:'smoke'};
function saveHash(){const p=new URLSearchParams();for(const [short,key] of Object.entries(hashKeys)){if(Number(state[key])!==Number(defaults[key]))p.set(short,String(state[key]))}if(!paneToggle.checked)p.set('pane','0');history.replaceState(null,'',`${location.pathname}${location.search}${p.toString()?'#'+p.toString():''}`)}
function loadHash(){const p=new URLSearchParams(location.hash.slice(1));for(const [short,key] of Object.entries(hashKeys)){if(p.has(short)){const n=Number(p.get(short));if(Number.isFinite(n))state[key]=n}}if(p.get('pane')==='0')paneToggle.checked=false}

function syncControls(){for(const input of document.querySelectorAll('[data-key]')){const key=input.dataset.key;input.value=state[key];const out=input.parentElement.querySelector('output');if(out)out.textContent=formatValue(key,state[key])}syncUniforms();syncProductionRain();updateReadout();saveHash()}
function applyState(next){Object.assign(state,defaults,next||{});syncControls()}

function initControls(){
  for(const name of Object.keys(presets)){const option=document.createElement('option');option.value=name;option.textContent=name;presetSelect.appendChild(option)}
  presetSelect.value='Clear tropical day';
  for(const input of document.querySelectorAll('[data-key]'))input.addEventListener('input',()=>{const key=input.dataset.key;state[key]=Number(input.value);const out=input.parentElement.querySelector('output');if(out)out.textContent=formatValue(key,state[key]);syncUniforms();syncProductionRain();updateReadout();saveHash()},{passive:true});
  paneToggle.addEventListener('change',()=>{window.__sindhornRainPaneEnabled=paneToggle.checked;saveHash()});
  document.getElementById('applyPreset').addEventListener('click',()=>applyState(presets[presetSelect.value]));
  document.getElementById('randomPreset').addEventListener('click',()=>{const names=Object.keys(presets),name=names[Math.floor(Math.random()*names.length)];presetSelect.value=name;applyState(presets[name])});
  document.getElementById('resetPreset').addEventListener('click',()=>applyState(defaults));
  document.getElementById('copyState').addEventListener('click',async event=>{saveHash();try{await navigator.clipboard.writeText(location.href);const old=event.currentTarget.textContent;event.currentTarget.textContent='COPIED';setTimeout(()=>event.currentTarget.textContent=old,1000)}catch(_){}});
  document.getElementById('fullscreenToggle').addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch(_){}});
  document.getElementById('hideControls').addEventListener('click',()=>{panel.classList.add('hidden');document.getElementById('showControls').classList.add('visible')});
  document.getElementById('showControls').addEventListener('click',()=>{panel.classList.remove('hidden');document.getElementById('showControls').classList.remove('visible')});
}

loadHash();
initRenderer();
initPrecipOverlays();
initControls();
syncControls();
window.addEventListener('resize',resize,{passive:true});
new ResizeObserver(resize).observe(stage);
raf=requestAnimationFrame(frame);
