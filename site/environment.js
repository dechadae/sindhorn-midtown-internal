import * as THREE from './vendor/three.module.js';

const HOTEL={lat:13.74135,lon:100.54274,timezone:'Asia/Bangkok'};
const WEATHER_ENDPOINT='https://api.open-meteo.com/v1/forecast?latitude=13.74135&longitude=100.54274&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,is_day&timezone=Asia%2FBangkok';
const WEATHER_CACHE_KEY='sindhorn-midtown:weather:v1';
const WEATHER_CACHE_MAX_AGE=45*60*1000;
const stage=document.getElementById('environmentStage');
const canvas=document.getElementById('environmentCanvas');
const pmEl=document.getElementById('pmValue');
const aqiEl=document.getElementById('aqiValue');
const weatherNow=document.getElementById('weatherNow');
const weatherTemp=document.getElementById('weatherTemp');
const weatherConditionEn=document.getElementById('weatherConditionEn');
const weatherConditionTh=document.getElementById('weatherConditionTh');
const weatherMetaEn=document.getElementById('weatherMetaEn');
const weatherMetaTh=document.getElementById('weatherMetaTh');
if(!stage||!canvas||!pmEl||!aqiEl||!window.WebGLRenderingContext)throw new Error('Realtime environment unavailable');

const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const mix=(a,b,t)=>a+(b-a)*t;

function bangkokParts(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:HOTEL.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(date);
  const out={};for(const p of parts)out[p.type]=p.value;return out;
}
function julianDay(date){return date.getTime()/86400000+2440587.5}
function solarPosition(date=new Date()){
  const jd=julianDay(date),n=jd-2451545.0;
  const L=(280.46+0.9856474*n)%360;
  const g=((357.528+0.9856003*n)%360)*Math.PI/180;
  const lambda=(L+1.915*Math.sin(g)+0.02*Math.sin(2*g))*Math.PI/180;
  const epsilon=(23.439-0.0000004*n)*Math.PI/180;
  const alpha=Math.atan2(Math.cos(epsilon)*Math.sin(lambda),Math.cos(lambda));
  const delta=Math.asin(Math.sin(epsilon)*Math.sin(lambda));
  const parts=bangkokParts(date);
  const localHours=Number(parts.hour)+Number(parts.minute)/60+Number(parts.second)/3600;
  const ut=localHours-7;
  const gst=((6.697375+0.0657098242*n+ut)%24+24)%24;
  const lst=((gst+HOTEL.lon/15)%24+24)%24;
  let hourAngle=lst*15*Math.PI/180-alpha;
  while(hourAngle< -Math.PI)hourAngle+=Math.PI*2;
  while(hourAngle> Math.PI)hourAngle-=Math.PI*2;
  const lat=HOTEL.lat*Math.PI/180;
  const altitude=Math.asin(Math.sin(lat)*Math.sin(delta)+Math.cos(lat)*Math.cos(delta)*Math.cos(hourAngle));
  const azimuth=Math.atan2(-Math.sin(hourAngle),Math.tan(delta)*Math.cos(lat)-Math.sin(lat)*Math.cos(hourAngle));
  return{altitude:altitude*180/Math.PI,azimuth:(azimuth*180/Math.PI+360)%360};
}
function lunarPosition(date=new Date()){
  const jd=julianDay(date),d=jd-2451543.5,rad=Math.PI/180;
  const N=((125.1228-0.0529538083*d)%360)*rad,i=5.1454*rad,w=((318.0634+0.1643573223*d)%360)*rad,a=60.2666,e=0.0549,M=((115.3654+13.0649929509*d)%360)*rad;
  const E=M+e*Math.sin(M)*(1+e*Math.cos(M)),xv=a*(Math.cos(E)-e),yv=a*Math.sqrt(1-e*e)*Math.sin(E),v=Math.atan2(yv,xv),r=Math.hypot(xv,yv);
  const xh=r*(Math.cos(N)*Math.cos(v+w)-Math.sin(N)*Math.sin(v+w)*Math.cos(i));
  const yh=r*(Math.sin(N)*Math.cos(v+w)+Math.cos(N)*Math.sin(v+w)*Math.cos(i));
  const zh=r*Math.sin(v+w)*Math.sin(i),lon=Math.atan2(yh,xh),lat=Math.atan2(zh,Math.hypot(xh,yh)),ob=(23.4393-3.563e-7*d)*rad;
  const xe=Math.cos(lon)*Math.cos(lat),ye=Math.sin(lon)*Math.cos(lat)*Math.cos(ob)-Math.sin(lat)*Math.sin(ob),ze=Math.sin(lon)*Math.cos(lat)*Math.sin(ob)+Math.sin(lat)*Math.cos(ob);
  const ra=Math.atan2(ye,xe),dec=Math.atan2(ze,Math.hypot(xe,ye)),T=(jd-2451545.0)/36525,gmst=(280.46061837+360.98564736629*(jd-2451545.0)+0.000387933*T*T-T*T*T/38710000)%360,lst=((gmst+HOTEL.lon)%360+360)%360*rad;
  let hourAngle=lst-ra;while(hourAngle< -Math.PI)hourAngle+=Math.PI*2;while(hourAngle>Math.PI)hourAngle-=Math.PI*2;
  const phi=HOTEL.lat*rad,altitude=Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(hourAngle)),azimuth=Math.atan2(-Math.sin(hourAngle),Math.tan(dec)*Math.cos(phi)-Math.sin(phi)*Math.cos(hourAngle));
  const phase=(((jd-2451550.1)/29.53058867)%1+1)%1,illumination=0.5*(1-Math.cos(phase*Math.PI*2));
  return{altitude:altitude/rad,azimuth:(azimuth/rad+360)%360,phase,illumination};
}
function readAir(){const pm25=Number.parseFloat(pmEl.textContent||''),aqi=Number.parseFloat(aqiEl.textContent||'');return{pm25:Number.isFinite(pm25)?pm25:null,aqi:Number.isFinite(aqi)?aqi:null}}
function pollutionStrength(pm){if(!Number.isFinite(pm))return .18;if(pm<=15)return mix(.02,.10,pm/15);if(pm<=25)return mix(.10,.24,(pm-15)/10);if(pm<=37.5)return mix(.24,.42,(pm-25)/12.5);if(pm<=75)return mix(.42,.72,(pm-37.5)/37.5);return clamp(.72+(pm-75)/150*.28,.72,1)}
function weatherLabel(code){const c=Number(code);if(c===0)return['Clear','ท้องฟ้าแจ่มใส'];if(c===1)return['Mainly clear','ท้องฟ้าโปร่ง'];if(c===2)return['Partly cloudy','มีเมฆบางส่วน'];if(c===3)return['Overcast','มีเมฆมาก'];if([45,48].includes(c))return['Fog','มีหมอก'];if([51,53,55,56,57].includes(c))return['Drizzle','ฝนละออง'];if([61,63,65,66,67].includes(c))return['Rain','ฝนตก'];if([80,81,82].includes(c))return['Rain showers','ฝนตกเป็นช่วง'];if([95,96,99].includes(c))return['Thunderstorm','พายุฝนฟ้าคะนอง'];return['Current weather','สภาพอากาศขณะนี้']}
function weatherVisual(weather){
  const c=Number(weather.weatherCode),raw=clamp(weather.cloudCover||0);let cloud=raw,type=0,name='clear';
  if(c===1){cloud=Math.max(cloud,.18);type=.5;name='mainly-clear'}
  if(c===2){cloud=Math.max(cloud,.48);type=1;name='partly-cloudy'}
  if(c===3){cloud=Math.max(cloud,.92);type=2;name='overcast'}
  if([45,48].includes(c)){cloud=Math.max(cloud,.78);type=3;name='fog'}
  if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(c)){cloud=Math.max(cloud,.82);type=4;name='rain'}
  if([95,96,99].includes(c)){cloud=Math.max(cloud,.94);type=5;name='thunderstorm'}
  if((weather.precipitationMm||0)>.2){cloud=Math.max(cloud,.80);type=Math.max(type,4);if(name==='clear')name='rain'}
  return{cloud:clamp(cloud),type,name};
}
function windPoint(deg){const labels=['N','NE','E','SE','S','SW','W','NW'];return labels[Math.round(((((Number(deg)||0)%360)+360)%360)/45)%8]}
function renderWeather(){if(!weatherNow||!state.weather.known||!Number.isFinite(state.weather.temperatureC))return;const w=state.weather,[en,th]=weatherLabel(w.weatherCode);weatherTemp.textContent=`${Math.round(w.temperatureC)}°`;weatherConditionEn.textContent=en;weatherConditionTh.textContent=th;const feels=Number.isFinite(w.apparentTemperatureC)?Math.round(w.apparentTemperatureC):Math.round(w.temperatureC),rh=Math.round(w.humidity*100),wind=Math.round(w.windSpeedKmh),dir=windPoint(w.windDirectionDeg);weatherMetaEn.textContent=`Feels ${feels}° · RH ${rh}% · Wind ${dir} ${wind} km/h`;weatherMetaTh.textContent=`รู้สึกเหมือน ${feels}° · ความชื้น ${rh}% · ลม ${dir} ${wind} กม./ชม.`;weatherNow.hidden=false}
function cachedWeather(){try{const cached=JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)||'null');if(!cached||!cached.savedAt||Date.now()-cached.savedAt>WEATHER_CACHE_MAX_AGE)return null;return cached.value||null}catch(_){return null}}
function saveWeather(value){try{localStorage.setItem(WEATHER_CACHE_KEY,JSON.stringify({savedAt:Date.now(),value}))}catch(_){}}

const state={air:readAir(),weather:{known:false,cloudCover:0,precipitationMm:0,humidity:.68,windSpeedKmh:4,windDirectionDeg:180,windGustKmh:null,visibilityKm:20,temperatureC:null,apparentTemperatureC:null,weatherCode:null,isDay:null,observedAt:null},solar:solarPosition(),lunar:lunarPosition()};
async function fetchWeather(){
  const cached=cachedWeather();if(cached&&!state.weather.known){state.weather={...cached,known:true,cached:true};renderWeather();syncState()}
  try{const response=await fetch(WEATHER_ENDPOINT,{cache:'no-store',credentials:'omit'});if(!response.ok)throw new Error('weather '+response.status);const value=await response.json(),current=value.current||{},n=(x,fallback=null)=>Number.isFinite(Number(x))?Number(x):fallback;const weather={known:true,cached:false,cloudCover:clamp(n(current.cloud_cover,0)/100),precipitationMm:Math.max(0,n(current.precipitation,0)),humidity:clamp(n(current.relative_humidity_2m,68)/100),windSpeedKmh:Math.max(0,n(current.wind_speed_10m,4)),windDirectionDeg:((n(current.wind_direction_10m,180)%360)+360)%360,windGustKmh:n(current.wind_gusts_10m),visibilityKm:Math.max(.1,n(current.visibility,20000)/1000),temperatureC:n(current.temperature_2m),apparentTemperatureC:n(current.apparent_temperature),weatherCode:n(current.weather_code),isDay:n(current.is_day),observedAt:current.time||null};state.weather=weather;saveWeather(weather);renderWeather()}catch(_){if(!state.weather.known)state.weather.known=false}
}

const activePixelRatio=2;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true,precision:'highp'});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setPixelRatio(activePixelRatio);
document.body.dataset.environmentQuality=activePixelRatio.toFixed(2);
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),geometry=new THREE.PlaneGeometry(2,2);
const uniforms={uTime:{value:0},uResolution:{value:new THREE.Vector2(1,1)},uSun:{value:new THREE.Vector2(.5,.35)},uSolarAltitude:{value:45},uMoon:{value:new THREE.Vector2(.5,.42)},uMoonAltitude:{value:-20},uMoonPhase:{value:.5},uMoonIllumination:{value:1},uPollution:{value:.2},uCloud:{value:0},uWeatherType:{value:0},uRain:{value:0},uHumidity:{value:.68},uVisibilityKm:{value:20},uWind:{value:new THREE.Vector2(.02,0)},uTilt:{value:new THREE.Vector2(0,0)},uWeatherKnown:{value:0}};
const material=new THREE.ShaderMaterial({uniforms,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,fragmentShader:`
precision highp float;
varying vec2 vUv;
uniform float uTime;uniform vec2 uResolution;uniform vec2 uSun;uniform float uSolarAltitude;uniform vec2 uMoon;uniform float uMoonAltitude;uniform float uMoonPhase;uniform float uMoonIllumination;uniform float uPollution;uniform float uCloud;uniform float uWeatherType;uniform float uRain;uniform float uHumidity;uniform float uVisibilityKm;uniform vec2 uWind;uniform vec2 uTilt;uniform float uWeatherKnown;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.0,a=.52;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(17.13,9.37);a*=.5;}return v;}
vec3 sat(vec3 c,float s){float l=dot(c,vec3(.2126,.7152,.0722));return mix(vec3(l),c,s);}
float aaDisc(float d,float r){float aa=2.25/max(1.0,min(uResolution.x,uResolution.y));return 1.0-smoothstep(r-aa,r+aa,d);}
void main(){
  vec2 uv=vUv;
  float aspect=clamp(uResolution.x/max(uResolution.y,1.0),.35,2.5);
  vec2 tilt=uTilt*vec2(.022,.016);
  vec2 skyUv=uv+tilt;
  vec2 fieldUv=vec2(skyUv.x*aspect,skyUv.y);
  float daylight=smoothstep(-7.0,8.0,uSolarAltitude);
  float nightness=1.0-daylight;
  float horizon=pow(clamp(1.0-skyUv.y,0.0,1.0),1.25);
  float lowSun=1.0-smoothstep(7.0,34.0,max(uSolarAltitude,0.0));
  vec3 nightTop=vec3(.025,.032,.065),nightHorizon=vec3(.105,.092,.145);
  vec3 dayTop=vec3(.24,.48,.76),dayHorizon=vec3(.74,.79,.82);
  vec3 sky=mix(mix(nightHorizon,dayHorizon,daylight),mix(nightTop,dayTop,daylight),smoothstep(.04,.94,skyUv.y));
  sky=mix(sky,vec3(.72,.36,.25),lowSun*daylight*horizon*.17);

  vec2 sunDelta=skyUv-uSun;sunDelta.x*=aspect;float sunDist=length(sunDelta),sunRadius=.018;
  float sunDisc=aaDisc(sunDist,sunRadius),sunGlow=exp(-sunDist*28.0),sunAbove=smoothstep(-4.0,1.5,uSolarAltitude);
  vec3 sunWarm=mix(vec3(1.0,.58,.30),vec3(1.0,.95,.79),smoothstep(6.0,42.0,uSolarAltitude));
  sky+=sunWarm*(sunDisc*1.22+sunGlow*.19)*sunAbove;

  vec2 moonDelta=skyUv-uMoon;moonDelta.x*=aspect;float moonDist=length(moonDelta),moonRadius=.0215;
  vec2 mp=moonDelta/max(moonRadius,.001);float moonDisc=aaDisc(moonDist,moonRadius),moonZ=sqrt(max(0.0,1.0-dot(mp,mp)));
  float phaseAngle=uMoonPhase*6.28318530718;vec3 mn=normalize(vec3(mp.x,mp.y,moonZ)),ml=normalize(vec3(sin(phaseAngle),0.0,-cos(phaseAngle)));
  float moonLit=smoothstep(-.045,.055,dot(mn,ml)),moonAbove=smoothstep(-3.0,2.0,uMoonAltitude),moonGlow=exp(-moonDist*24.0);
  sky+=vec3(.97,.955,.88)*moonDisc*moonLit*moonAbove*1.08;
  sky+=vec3(.24,.28,.42)*moonGlow*moonAbove*uMoonIllumination*.11;

  float cloudiness=clamp(uCloud*uWeatherKnown,0.0,1.0);
  vec2 drift=uWind*uTime*.012;
  vec2 q=fieldUv+drift+tilt*1.8;
  float broad=fbm(q*vec2(1.35,.92)+vec2(0.0,uTime*.0015));
  float warp=fbm(q*vec2(2.15,1.42)+vec2(broad*.72,-broad*.36)+vec2(11.4,4.7));
  float detail=fbm(q*vec2(3.45,2.05)-drift*.7+vec2(warp*.48,7.2));
  float cloudField=broad*.50+warp*.34+detail*.16;
  float threshold=mix(.76,.38,cloudiness);
  float cloudMask=smoothstep(threshold-.13,threshold+.11,cloudField);
  float overcast=smoothstep(.72,.94,cloudiness);
  cloudMask=max(cloudMask,overcast*(.72+.23*broad));
  float fogWeather=smoothstep(2.5,3.2,uWeatherType);
  cloudMask=max(cloudMask,fogWeather*(.48+.40*warp));
  float relief=smoothstep(.30,.82,cloudField);
  vec3 dayCloud=mix(vec3(.48,.50,.54),vec3(.88,.89,.90),relief);
  vec3 nightCloud=mix(vec3(.105,.12,.17),vec3(.29,.31,.37),relief);
  float moonSilver=moonAbove*exp(-moonDist*9.0)*nightness;
  nightCloud+=vec3(.10,.12,.18)*moonSilver;
  float storm=smoothstep(4.5,5.0,uWeatherType);
  vec3 cloudColor=mix(dayCloud,nightCloud,nightness);
  cloudColor=mix(cloudColor,vec3(.12,.13,.17),storm*.72);
  float cloudOpacity=mix(.42,.94,cloudiness);
  cloudOpacity=max(cloudOpacity,overcast*.90);
  sky=mix(sky,cloudColor,cloudMask*cloudOpacity);

  float visFog=uWeatherKnown*(1.0-smoothstep(2.0,18.0,uVisibilityKm));
  vec3 fogColor=mix(vec3(.63,.66,.69),vec3(.20,.21,.27),nightness);
  sky=mix(sky,fogColor,visFog*(.18+.58*horizon));

  float rainAmount=clamp(uRain/5.0,0.0,1.0)*uWeatherKnown;
  rainAmount=max(rainAmount,smoothstep(3.8,4.2,uWeatherType)*.12);
  if(rainAmount>.001){vec2 ruv=fieldUv*vec2(58.0,30.0);ruv.x+=uTime*2.0+ruv.y*.48;float streak=step(.972,hash(floor(ruv)))*smoothstep(.96,.06,fract(ruv.y));sky+=vec3(.72,.79,.86)*streak*rainAmount*.42;sky=mix(sky,vec3(.16,.18,.23),rainAmount*.13);}

  float pollution=clamp(uPollution,0.0,1.0);
  sky=sat(sky,1.0-pollution*.58);
  vec3 dirty=vec3(.50,.47,.44);
  sky=mix(sky,dirty,pollution*(.07+.35*horizon));
  float haze=pow(horizon,1.75)*pollution*(.18+.36*uHumidity);
  sky=mix(sky,vec3(.60,.56,.52),haze);
  float sunHaze=exp(-sunDist*10.0)*sunAbove*pollution;
  sky+=vec3(.60,.49,.38)*sunHaze*.09;

  vec2 puv=(fieldUv+drift*.22+vec2(uTime*.0015,-uTime*.0008))*vec2(74.0,58.0);
  vec2 cell=floor(puv),fp=fract(puv)-.5;float seed=hash(cell),radius=mix(.035,.15,hash(cell+19.7));float particle=1.0-smoothstep(radius,radius+.04,length(fp));
  float particleDensity=smoothstep(.10,.82,pollution);float keep=step(mix(.997,.935,particleDensity),seed);float pmDust=particle*keep*particleDensity;
  sky=mix(sky,vec3(.77,.72,.66),pmDust*.34);

  vec2 vig=skyUv-vec2(.5,.50);vig.x*=aspect;float vignette=smoothstep(1.10,.26,length(vig));sky*=mix(.90,1.0,vignette);
  gl_FragColor=vec4(sky,1.0);
}`,depthWrite:false,depthTest:false});
scene.add(new THREE.Mesh(geometry,material));

function resize(){const rect=stage.getBoundingClientRect(),width=Math.max(1,Math.round(rect.width)),height=Math.max(1,Math.round(rect.height));renderer.setSize(width,height,false);uniforms.uResolution.value.set(width*activePixelRatio,height*activePixelRatio)}
function skyY(altitude){return clamp(.12+clamp((altitude+2)/82,0,1)*.72,.08,.88)}
function syncState(){
  state.solar=solarPosition();state.lunar=lunarPosition();state.air=readAir();
  const pollution=pollutionStrength(state.air.pm25),alt=state.solar.altitude,az=state.solar.azimuth*Math.PI/180,sunX=clamp(.5-Math.sin(az)*.42,.06,.94),sunY=skyY(alt),moonAlt=state.lunar.altitude,moonAz=state.lunar.azimuth*Math.PI/180,moonX=clamp(.5-Math.sin(moonAz)*.42,.06,.94),moonY=skyY(moonAlt),speed=clamp(state.weather.windSpeedKmh/30,.02,1),dir=state.weather.windDirectionDeg*Math.PI/180,visual=weatherVisual(state.weather);
  uniforms.uSun.value.set(sunX,sunY);uniforms.uSolarAltitude.value=alt;uniforms.uMoon.value.set(moonX,moonY);uniforms.uMoonAltitude.value=moonAlt;uniforms.uMoonPhase.value=state.lunar.phase;uniforms.uMoonIllumination.value=state.lunar.illumination;uniforms.uPollution.value=pollution;uniforms.uCloud.value=visual.cloud;uniforms.uWeatherType.value=visual.type;uniforms.uRain.value=state.weather.precipitationMm;uniforms.uHumidity.value=state.weather.humidity;uniforms.uVisibilityKm.value=Number.isFinite(state.weather.visibilityKm)?state.weather.visibilityKm:20;uniforms.uWind.value.set(Math.sin(dir)*speed,-Math.cos(dir)*speed);uniforms.uWeatherKnown.value=state.weather.known?1:0;
  document.body.dataset.environmentWeather=state.weather.known?'live':'unavailable';document.body.dataset.environmentWeatherType=visual.name;document.body.dataset.environmentCloud=state.weather.known?state.weather.cloudCover.toFixed(2):'unknown';document.body.dataset.environmentCloudEffective=state.weather.known?visual.cloud.toFixed(2):'unknown';document.body.dataset.environmentAir=Number.isFinite(state.air.pm25)?'live':'loading';document.body.dataset.environmentMoonAltitude=moonAlt.toFixed(1);document.body.dataset.environmentMoonIllumination=state.lunar.illumination.toFixed(2);updateDebug();
}

let debug;
function updateDebug(){if(!new URLSearchParams(location.search).has('debug'))return;if(!debug){debug=document.createElement('div');debug.className='environment-debug';document.body.appendChild(debug)}const w=state.weather,v=weatherVisual(w);debug.textContent=['ENVIRONMENT v13 · WEATHER FIRST',`sun ${state.solar.altitude.toFixed(1)}° / moon ${state.lunar.altitude.toFixed(1)}° · ${(state.lunar.illumination*100).toFixed(0)}% lit`,`PM2.5 ${state.air.pm25??'—'} / AQI ${state.air.aqi??'—'} · pollution ${(uniforms.uPollution.value*100).toFixed(0)}%`,`weather ${w.known?(w.cached?'CACHED':'LIVE'):'pending'} · ${v.name}`,w.known?`raw cloud ${Math.round(w.cloudCover*100)}% · render cloud ${Math.round(v.cloud*100)}% · rain ${w.precipitationMm.toFixed(1)}mm · vis ${w.visibilityKm.toFixed(1)}km`:'weather not inferred',`renderer DPR ${activePixelRatio.toFixed(2)} · full quality / full motion`,`tilt ${uniforms.uTilt.value.x.toFixed(2)}, ${uniforms.uTilt.value.y.toFixed(2)}`].join('\n')}

let raf=0,pageVisible=!document.hidden;const start=performance.now();
function render(now){raf=0;if(!pageVisible)return;uniforms.uTime.value=(now-start)/1000;renderer.render(scene,camera);raf=requestAnimationFrame(render)}
function requestRender(){if(!raf&&pageVisible)raf=requestAnimationFrame(render)}
document.addEventListener('visibilitychange',()=>{pageVisible=!document.hidden;if(pageVisible)requestRender();else if(raf){cancelAnimationFrame(raf);raf=0}});
const airObserver=new MutationObserver(()=>{syncState();requestRender()});airObserver.observe(pmEl,{childList:true,characterData:true,subtree:true});airObserver.observe(aqiEl,{childList:true,characterData:true,subtree:true});new ResizeObserver(()=>{resize();requestRender()}).observe(stage);

const tiltTarget=new THREE.Vector2(),tiltCurrent=uniforms.uTilt.value;
function applyOrientation(event){if(!Number.isFinite(event.gamma)&&!Number.isFinite(event.beta))return;const x=clamp((Number(event.gamma)||0)/28,-1,1),y=clamp(((Number(event.beta)||45)-45)/38,-1,1);tiltTarget.set(x,y);tiltCurrent.lerp(tiltTarget,.18);document.body.dataset.environmentTilt=`${tiltCurrent.x.toFixed(2)},${tiltCurrent.y.toFixed(2)}`;requestRender()}
function attachOrientation(){window.addEventListener('deviceorientation',applyOrientation,{passive:true});document.body.dataset.environmentTiltMode='device'}
if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
  const requestTilt=()=>{DeviceOrientationEvent.requestPermission().then(result=>{if(result==='granted')attachOrientation();else document.body.dataset.environmentTiltMode='pointer'}).catch(()=>{document.body.dataset.environmentTiltMode='pointer'})};
  window.addEventListener('pointerdown',requestTilt,{once:true,capture:true,passive:true});
}else if('DeviceOrientationEvent'in window)attachOrientation();
else document.body.dataset.environmentTiltMode='pointer';
window.addEventListener('pointermove',event=>{if(event.pointerType==='mouse'||document.body.dataset.environmentTiltMode==='pointer'){const x=clamp(event.clientX/Math.max(innerWidth,1)*2-1,-1,1),y=clamp(event.clientY/Math.max(innerHeight,1)*2-1,-1,1);tiltTarget.set(x,-y);tiltCurrent.lerp(tiltTarget,.10);document.body.dataset.environmentTilt=`${tiltCurrent.x.toFixed(2)},${tiltCurrent.y.toFixed(2)}`}}, {passive:true});

function renderExport(width,height){
  return new Promise((resolve,reject)=>{try{const exportRenderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true,precision:'highp'});exportRenderer.outputColorSpace=THREE.SRGBColorSpace;exportRenderer.setPixelRatio(1);exportRenderer.setSize(Math.max(1,Math.round(width)),Math.max(1,Math.round(height)),false);const exportMaterial=material.clone();exportMaterial.uniforms=THREE.UniformsUtils.clone(uniforms);exportMaterial.uniforms.uResolution.value.set(width,height);exportMaterial.uniforms.uTime.value=uniforms.uTime.value;const exportScene=new THREE.Scene(),exportMesh=new THREE.Mesh(geometry.clone(),exportMaterial);exportScene.add(exportMesh);exportRenderer.render(exportScene,camera);const data=exportRenderer.domElement.toDataURL('image/png',1);exportMesh.geometry.dispose();exportMaterial.dispose();exportRenderer.dispose();resolve(data)}catch(error){reject(error)}})
}
window.SindhornEnvironment={renderExport,getState:()=>({weather:{...state.weather,visual:weatherVisual(state.weather)},air:{...state.air},solar:{...state.solar},lunar:{...state.lunar},quality:activePixelRatio})};

stage.hidden=false;resize();syncState();document.body.classList.add('environment-ready');requestRender();fetchWeather().finally(()=>{syncState();requestRender()});setInterval(()=>fetchWeather().finally(()=>{syncState();requestRender()}),10*60*1000);setInterval(()=>{syncState();requestRender()},60*1000);
