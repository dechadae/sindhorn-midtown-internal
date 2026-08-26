import * as THREE from './vendor/three.module.js';

const HOTEL={lat:13.74135,lon:100.54274,timezone:'Asia/Bangkok'};
const WEATHER_ENDPOINT='https://api.open-meteo.com/v1/forecast?latitude=13.74135&longitude=100.54274&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,is_day&timezone=Asia%2FBangkok';
const WEATHER_CACHE_KEY='sindhorn-midtown:weather:v2';
const WEATHER_CACHE_MAX_AGE=45*60*1000;
const DPR=2;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const mix=(a,b,t)=>a+(b-a)*t;

const DEFAULT_CONFIG={
  schema:1,
  sky:{dayTop:'#3A79C2',dayHorizon:'#B9D6E9',goldenTop:'#607FC2',goldenHorizon:'#F3A678',twilightTop:'#101C47',twilightHorizon:'#244785',nightTop:'#071027',nightHorizon:'#111B38',sunsetStrength:1,circumsolarStrength:1,dither:1},
  clouds:{contrast:1,opacity:1,broadScale:1,detailScale:1,overcastFloor:.78,edgeLight:.22,nightLift:.18},
  celestial:{sunRadius:.018,sunGlow:1,moonRadius:.0215,moonGlow:1},
  rain:{streakDensity:1,streakBrightness:.42,dropDensity:.65},
  storm:{darkening:.72,flashStrength:.32},fog:{strength:1},
  pm25:{desaturation:.58,horizonExtinction:.35,hazeStrength:1,sunDiffusion:.09,particleStrength:.34},
  tilt:{x:.022,y:.016}
};

let stage,canvas,renderer,scene,camera,geometry,material,uniforms,raf=0,start=0,pageVisible=!document.hidden,initialized=false,config=structuredClone(DEFAULT_CONFIG),debug=null;
let width=1,height=1,snowCanvas=null,snowCtx=null,hailCanvas=null,hailCtx=null,lastFrame=performance.now(),flash=0,nextFlashAt=0;
const state={
  air:{pm:null,aqi:null},
  weather:{known:false,cached:false,cloudCover:0,precipitationMm:0,rainMm:0,showersMm:0,snowfallCm:0,humidity:.68,windSpeedKmh:4,windDirectionDeg:180,windGustKmh:null,visibilityKm:20,temperatureC:null,apparentTemperatureC:null,weatherCode:null,isDay:null,observedAt:null},
  solar:null,lunar:null,visual:null
};

function bangkokParts(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:HOTEL.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(date),out={};
  for(const p of parts)out[p.type]=p.value;
  return out;
}
function julianDay(date){return date.getTime()/86400000+2440587.5}
function solarPosition(date=new Date()){
  const jd=julianDay(date),n=jd-2451545,L=(280.46+.9856474*n)%360,g=((357.528+.9856003*n)%360)*Math.PI/180,lambda=(L+1.915*Math.sin(g)+.02*Math.sin(2*g))*Math.PI/180,epsilon=(23.439-.0000004*n)*Math.PI/180,alpha=Math.atan2(Math.cos(epsilon)*Math.sin(lambda),Math.cos(lambda)),delta=Math.asin(Math.sin(epsilon)*Math.sin(lambda)),parts=bangkokParts(date),localHours=Number(parts.hour)+Number(parts.minute)/60+Number(parts.second)/3600,ut=localHours-7,gst=((6.697375+.0657098242*n+ut)%24+24)%24,lst=((gst+HOTEL.lon/15)%24+24)%24;
  let hourAngle=lst*15*Math.PI/180-alpha;while(hourAngle< -Math.PI)hourAngle+=Math.PI*2;while(hourAngle>Math.PI)hourAngle-=Math.PI*2;
  const lat=HOTEL.lat*Math.PI/180,altitude=Math.asin(Math.sin(lat)*Math.sin(delta)+Math.cos(lat)*Math.cos(delta)*Math.cos(hourAngle)),azimuth=Math.atan2(-Math.sin(hourAngle),Math.tan(delta)*Math.cos(lat)-Math.sin(lat)*Math.cos(hourAngle));
  return{altitude:altitude*180/Math.PI,azimuth:(azimuth*180/Math.PI+360)%360};
}
function lunarPosition(date=new Date()){
  const jd=julianDay(date),d=jd-2451543.5,rad=Math.PI/180,N=((125.1228-.0529538083*d)%360)*rad,i=5.1454*rad,w=((318.0634+.1643573223*d)%360)*rad,a=60.2666,e=.0549,M=((115.3654+13.0649929509*d)%360)*rad,E=M+e*Math.sin(M)*(1+e*Math.cos(M)),xv=a*(Math.cos(E)-e),yv=a*Math.sqrt(1-e*e)*Math.sin(E),v=Math.atan2(yv,xv),r=Math.hypot(xv,yv),xh=r*(Math.cos(N)*Math.cos(v+w)-Math.sin(N)*Math.sin(v+w)*Math.cos(i)),yh=r*(Math.sin(N)*Math.cos(v+w)+Math.cos(N)*Math.sin(v+w)*Math.cos(i)),zh=r*Math.sin(v+w)*Math.sin(i),lon=Math.atan2(yh,xh),lat=Math.atan2(zh,Math.hypot(xh,yh)),ob=(23.4393-3.563e-7*d)*rad,xe=Math.cos(lon)*Math.cos(lat),ye=Math.sin(lon)*Math.cos(lat)*Math.cos(ob)-Math.sin(lat)*Math.sin(ob),ze=Math.sin(lon)*Math.cos(lat)*Math.sin(ob)+Math.sin(lat)*Math.cos(ob),ra=Math.atan2(ye,xe),dec=Math.atan2(ze,Math.hypot(xe,ye)),T=(jd-2451545)/36525,gmst=(280.46061837+360.98564736629*(jd-2451545)+.000387933*T*T-T*T*T/38710000)%360,lst=((gmst+HOTEL.lon)%360+360)%360*rad;
  let hourAngle=lst-ra;while(hourAngle< -Math.PI)hourAngle+=Math.PI*2;while(hourAngle>Math.PI)hourAngle-=Math.PI*2;
  const phi=HOTEL.lat*rad,altitude=Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(hourAngle)),azimuth=Math.atan2(-Math.sin(hourAngle),Math.tan(dec)*Math.cos(phi)-Math.sin(phi)*Math.cos(hourAngle)),phase=(((jd-2451550.1)/29.53058867)%1+1)%1,illumination=.5*(1-Math.cos(phase*Math.PI*2));
  return{altitude:altitude/rad,azimuth:(azimuth/rad+360)%360,phase,illumination};
}
function skyY(altitude){return clamp(.12+clamp((altitude+2)/82,0,1)*.72,.08,.88)}
function pollutionStrength(pm){if(!Number.isFinite(pm))return .18;if(pm<=15)return mix(.02,.10,pm/15);if(pm<=25)return mix(.10,.24,(pm-15)/10);if(pm<=37.5)return mix(.24,.42,(pm-25)/12.5);if(pm<=75)return mix(.42,.72,(pm-37.5)/37.5);return clamp(.72+(pm-75)/150*.28,.72,1)}
function readAir(){const live=window.SindhornLiveData?.getState?.().air;return{pm:Number.isFinite(Number(live?.pm))?Number(live.pm):null,aqi:Number.isFinite(Number(live?.aqi))?Number(live.aqi):null}}

const RAIN_CODES=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);
const DRIZZLE_CODES=new Set([51,53,55,56,57]);
const HEAVY_RAIN_CODES=new Set([65,67,82]);
const SNOW_CODES=new Set([71,73,75,77,85,86]);
const STORM_CODES=new Set([95,96,99]);
const HAIL_CODES=new Set([96,99]);
const FOG_CODES=new Set([45,48]);
function normalizedWeather(w){
  const code=Number(w.weatherCode),rawCloud=clamp(Number(w.cloudCover)||0),mm=Math.max(0,Number(w.precipitationMm)||0),rainMm=Math.max(mm,Number(w.rainMm)||0,Number(w.showersMm)||0),snowCm=Math.max(0,Number(w.snowfallCm)||0),visibility=Number.isFinite(w.visibilityKm)?w.visibilityKm:20,temp=Number.isFinite(w.temperatureC)?w.temperatureC:28,wind=Math.max(0,Number(w.windSpeedKmh)||0);
  let cloud=rawCloud;
  if(code===1)cloud=Math.max(cloud,.18);else if(code===2)cloud=Math.max(cloud,.48);else if(code===3)cloud=Math.max(cloud,.92);
  if(FOG_CODES.has(code))cloud=Math.max(cloud,.78);
  if(RAIN_CODES.has(code)||SNOW_CODES.has(code))cloud=Math.max(cloud,.82);
  if(STORM_CODES.has(code))cloud=Math.max(cloud,.96);
  const rainBase=DRIZZLE_CODES.has(code)?.14:HEAVY_RAIN_CODES.has(code)?.72:RAIN_CODES.has(code)?.40:0;
  const rain=clamp(Math.max(rainBase,rainMm/8));
  const snowBase=code===71?.25:code===73?.52:code===75?.85:code===77?.36:code===85?.52:code===86?.90:0;
  const snow=clamp(Math.max(snowBase,snowCm/1.8));
  const lightning=STORM_CODES.has(code)?(code===95?.58:code===96?.78:.94):0;
  const hail=HAIL_CODES.has(code)?(code===96?.48:.82):0;
  const fogCode=FOG_CODES.has(code)?(code===48?.92:.72):0;
  const fogVisibility=clamp((4-visibility)/3.6);
  const fog=clamp(Math.max(fogCode,fogVisibility)*(FOG_CODES.has(code)?1:.55));
  const stormCode=STORM_CODES.has(code)?(code===95?.62:code===96?.80:.94):0;
  const storm=clamp(Math.max(stormCode,rain*.42+cloud*.22+clamp((wind-35)/100)*.28));
  const heat=clamp((temp-34)/10);
  const type=snow>.08?(snow>.72?'heavy-snow':'snow'):lightning>.1?'thunderstorm':rain>.12?(DRIZZLE_CODES.has(code)?'drizzle':'rain'):FOG_CODES.has(code)?'fog':cloud>.86?'overcast':cloud>.30?'partly-cloudy':'clear';
  return{cloud,rain,snow,hail,lightning,fog,storm,heat,visibility,temp,wind,type};
}
function weatherLabel(code){const c=Number(code);if(c===0)return['Clear','ท้องฟ้าแจ่มใส'];if(c===1)return['Mainly clear','ท้องฟ้าโปร่ง'];if(c===2)return['Partly cloudy','มีเมฆบางส่วน'];if(c===3)return['Overcast','มีเมฆมาก'];if(FOG_CODES.has(c))return['Fog','มีหมอก'];if(DRIZZLE_CODES.has(c))return['Drizzle','ฝนละออง'];if([61,63,65,66,67].includes(c))return['Rain','ฝนตก'];if([71,73,75,77].includes(c))return['Snow','หิมะตก'];if([80,81,82].includes(c))return['Rain showers','ฝนตกเป็นช่วง'];if([85,86].includes(c))return['Snow showers','หิมะตกเป็นช่วง'];if(STORM_CODES.has(c))return['Thunderstorm','พายุฝนฟ้าคะนอง'];return['Current weather','สภาพอากาศขณะนี้']}
function windPoint(deg){const labels=['N','NE','E','SE','S','SW','W','NW'];return labels[Math.round(((((Number(deg)||0)%360)+360)%360)/45)%8]}
function renderWeather(){const weatherNow=document.getElementById('weatherNow');if(!weatherNow||!state.weather.known||!Number.isFinite(state.weather.temperatureC))return;const w=state.weather,[en,th]=weatherLabel(w.weatherCode),feels=Number.isFinite(w.apparentTemperatureC)?Math.round(w.apparentTemperatureC):Math.round(w.temperatureC),set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value};set('weatherTemp',`${Math.round(w.temperatureC)}°`);set('weatherConditionEn',en);set('weatherConditionTh',th);set('weatherMetaEn',`Feels ${feels}° · RH ${Math.round(w.humidity*100)}% · Wind ${windPoint(w.windDirectionDeg)} ${Math.round(w.windSpeedKmh)} km/h`);set('weatherMetaTh',`รู้สึกเหมือน ${feels}° · ความชื้น ${Math.round(w.humidity*100)}% · ลม ${windPoint(w.windDirectionDeg)} ${Math.round(w.windSpeedKmh)} กม./ชม.`);weatherNow.hidden=false}
function cachedWeather(){try{const cached=JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)||'null');if(!cached||!cached.savedAt||Date.now()-cached.savedAt>WEATHER_CACHE_MAX_AGE)return null;return cached.value||null}catch(_){return null}}
function saveWeather(value){try{localStorage.setItem(WEATHER_CACHE_KEY,JSON.stringify({savedAt:Date.now(),value}))}catch(_){}}
async function fetchWeather(){
  const cached=cachedWeather();if(cached&&!state.weather.known){state.weather={...cached,known:true,cached:true};renderWeather();syncState()}
  const response=await fetch(WEATHER_ENDPOINT,{cache:'no-store',credentials:'omit'});if(!response.ok)throw new Error('weather '+response.status);
  const value=await response.json(),current=value.current||{},n=(x,fallback=null)=>Number.isFinite(Number(x))?Number(x):fallback;
  state.weather={known:true,cached:false,cloudCover:clamp(n(current.cloud_cover,0)/100),precipitationMm:Math.max(0,n(current.precipitation,0)),rainMm:Math.max(0,n(current.rain,0)),showersMm:Math.max(0,n(current.showers,0)),snowfallCm:Math.max(0,n(current.snowfall,0)),humidity:clamp(n(current.relative_humidity_2m,68)/100),windSpeedKmh:Math.max(0,n(current.wind_speed_10m,4)),windDirectionDeg:((n(current.wind_direction_10m,180)%360)+360)%360,windGustKmh:n(current.wind_gusts_10m),visibilityKm:Math.max(.1,n(current.visibility,20000)/1000),temperatureC:n(current.temperature_2m),apparentTemperatureC:n(current.apparent_temperature),weatherCode:n(current.weather_code),isDay:n(current.is_day),observedAt:current.time||null};
  saveWeather(state.weather);renderWeather();syncState();requestRender();return state.weather;
}

function mergeConfig(next){if(!next||next.schema!==1)return structuredClone(DEFAULT_CONFIG);return{schema:1,sky:{...DEFAULT_CONFIG.sky,...next.sky},clouds:{...DEFAULT_CONFIG.clouds,...next.clouds},celestial:{...DEFAULT_CONFIG.celestial,...next.celestial},rain:{...DEFAULT_CONFIG.rain,...next.rain},storm:{...DEFAULT_CONFIG.storm,...next.storm},fog:{...DEFAULT_CONFIG.fog,...next.fog},pm25:{...DEFAULT_CONFIG.pm25,...next.pm25},tilt:{...DEFAULT_CONFIG.tilt,...next.tilt}}}
function applyConfig(next){config=mergeConfig(next);if(uniforms){uniforms.uCloudContrast.value=clamp(Number(config.clouds.contrast)||1,.4,2.4);uniforms.uCloudOpacity.value=clamp(Number(config.clouds.opacity)||1,0,1.5);uniforms.uStormScale.value=clamp(Number(config.storm.darkening)||.72,0,1.2);uniforms.uFogScale.value=clamp(Number(config.fog.strength)||1,0,2);uniforms.uPmScale.value=clamp(Number(config.pm25.hazeStrength)||1,0,2);uniforms.uTiltScale.value.set(clamp(Number(config.tilt.x)||.022,0,.06),clamp(Number(config.tilt.y)||.016,0,.06));requestRender()}}

function buildRenderer(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true,precision:'highp'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(DPR);document.body.dataset.environmentQuality=DPR.toFixed(2);
  scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);geometry=new THREE.PlaneGeometry(2,2);
  uniforms={
    uTime:{value:0},uResolution:{value:new THREE.Vector2(1,1)},uSolarAltitude:{value:38},uSun:{value:new THREE.Vector2(.72,.55)},uMoonAltitude:{value:-20},uMoon:{value:new THREE.Vector2(.28,.4)},uMoonIllumination:{value:.5},uMoonPhase:{value:.5},
    uTemperature:{value:30},uHumidity:{value:.72},uVisibility:{value:20},uCloudCover:{value:.2},uStorm:{value:0},uFog:{value:0},uHeat:{value:0},uWind:{value:8},uWindDirection:{value:225},uPm25:{value:12},uDust:{value:0},uSmoke:{value:0},uFlash:{value:0},uTilt:{value:new THREE.Vector2(0,0)},uTiltScale:{value:new THREE.Vector2(.022,.016)},uCloudContrast:{value:1},uCloudOpacity:{value:1},uStormScale:{value:.72},uFogScale:{value:1},uPmScale:{value:1}
  };
  material=new THREE.ShaderMaterial({uniforms,depthWrite:false,depthTest:false,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,fragmentShader:`
precision highp float;
varying vec2 vUv;
uniform float uTime,uSolarAltitude,uMoonAltitude,uMoonIllumination,uMoonPhase,uTemperature,uHumidity,uVisibility,uCloudCover,uStorm,uFog,uHeat,uWind,uWindDirection,uPm25,uDust,uSmoke,uFlash,uCloudContrast,uCloudOpacity,uStormScale,uFogScale,uPmScale;
uniform vec2 uResolution,uSun,uMoon,uTilt,uTiltScale;
float sat(float x){return clamp(x,0.0,1.0);}float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}float fbm(vec2 p){float v=0.0,a=.52;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(17.13,9.37);a*=.5;}return v;}vec3 saturation(vec3 c,float s){float l=dot(c,vec3(.2126,.7152,.0722));return mix(vec3(l),c,s);}vec3 toLinear(vec3 c){return c*c;}vec3 toDisplay(vec3 c){return sqrt(max(c,vec3(0.0)));}
vec3 skyPalette(vec2 uv){float e=uSolarAltitude;vec3 dayTop=vec3(.23,.48,.76),dayHor=vec3(.72,.84,.91),goldTop=vec3(.38,.50,.76),goldHor=vec3(.95,.63,.43),twiTop=vec3(.063,.11,.28),twiHor=vec3(.14,.28,.52),nightTop=vec3(.026,.055,.13),nightHor=vec3(.067,.105,.22);vec3 top,hor;if(e>=8.0){top=dayTop;hor=dayHor;}else if(e>=0.0){float t=smoothstep(0.0,8.0,e);top=mix(goldTop,dayTop,t);hor=mix(goldHor,dayHor,t);}else if(e>=-8.0){float t=smoothstep(-8.0,0.0,e);top=mix(twiTop,goldTop,t);hor=mix(twiHor,goldHor,t);}else{float t=smoothstep(-18.0,-8.0,e);top=mix(nightTop,twiTop,t);hor=mix(nightHor,twiHor,t);}float y=smoothstep(.02,.96,uv.y);vec3 c=toDisplay(mix(toLinear(hor),toLinear(top),y));float hot=smoothstep(36.0,46.0,uTemperature);c=mix(c,c*vec3(1.08,.98,.86)+vec3(.05,.025,0.0),hot*.32);float cold=smoothstep(4.0,-18.0,uTemperature);c=mix(c,c*vec3(.86,.94,1.12),cold*.24);return c;}
void main(){
  vec2 uv=vUv+uTilt*uTiltScale;float horizon=pow(sat(1.0-uv.y),1.45);float shimmer=(noise(vec2(uv.y*110.0+uTime*1.8,uv.x*8.0))-0.5)*.010*uHeat*pow(horizon,1.6);uv.x+=shimmer;vec3 c=skyPalette(uv);float aspect=clamp(uResolution.x/max(uResolution.y,1.0),.4,2.5);float windAngle=radians(uWindDirection);vec2 drift=vec2(sin(windAngle),-cos(windAngle))*uTime*(.006+.00015*uWind);vec2 p=vec2(uv.x*aspect,uv.y);
  float broad=fbm((p+drift*.35)*vec2(1.15,.78)),mid=fbm((p+drift*.65)*vec2(2.15,1.30)+vec2(broad*.55,7.2)),fine=fbm((p+drift)*vec2(4.0,2.35)+vec2(mid*.40,19.0));float field=broad*.54+mid*.31+fine*.15;float threshold=mix(.82,.34,uCloudCover);float cloud=smoothstep(threshold-.12/max(.65,uCloudContrast),threshold+.10/max(.65,uCloudContrast),field);float over=smoothstep(.78,.98,uCloudCover);cloud=max(cloud,over*(.64+.36*smoothstep(.24,.74,field)));float relief=smoothstep(.28,.84,field);float night=1.0-smoothstep(-7.0,8.0,uSolarAltitude);vec3 cloudDay=mix(vec3(.46,.49,.54),vec3(.91,.92,.93),relief);vec3 cloudNight=mix(vec3(.08,.095,.14),vec3(.24,.28,.34),relief);vec3 cc=mix(cloudDay,cloudNight,night);cc=mix(cc,vec3(.08,.09,.12),uStorm*uStormScale);float cloudAlpha=mix(.30,.94,uCloudCover)*uCloudOpacity;c=mix(c,cc,cloud*clamp(cloudAlpha,0.0,1.0));
  vec2 sd=uv-uSun;sd.x*=aspect;float sunDist=length(sd);float sunAbove=smoothstep(-4.0,1.0,uSolarAltitude);float clearSun=sunAbove*(1.0-cloud*.92);float sunHalo=exp(-sunDist*18.0)*clearSun;float sunR=.020;float sunCore=1.0-smoothstep(sunR*.82,sunR*.98,sunDist);float sunRim=smoothstep(sunR*.66,sunR*.88,sunDist)*(1.0-smoothstep(sunR*.92,sunR*1.06,sunDist));float sunCorona=exp(-abs(sunDist-sunR)*115.0);vec3 sunWarm=mix(vec3(1.0,.64,.34),vec3(1.0,.98,.84),smoothstep(5.0,40.0,uSolarAltitude));c+=sunWarm*(sunHalo*.18+sunRim*1.12+sunCorona*.28)*clearSun;c=mix(c,vec3(.035,.038,.040),sunCore*clearSun*.96);
  vec2 md=uv-uMoon;md.x*=aspect;float moonDist=length(md);float moonAbove=smoothstep(-4.0,1.0,uMoonAltitude);float clearMoon=moonAbove*(1.0-cloud*.94);float moonR=.020;float moonCore=1.0-smoothstep(moonR*.80,moonR*.98,moonDist);float moonRim=smoothstep(moonR*.64,moonR*.88,moonDist)*(1.0-smoothstep(moonR*.92,moonR*1.07,moonDist));float moonHalo=exp(-moonDist*20.0);vec3 moonCool=vec3(.82,.90,1.0);c+=moonCool*(moonRim*.92+moonHalo*.11*uMoonIllumination)*clearMoon;c=mix(c,vec3(.018,.024,.035),moonCore*clearMoon*.94);
  float fogVis=1.0-smoothstep(.5,18.0,uVisibility);float fog=max(uFog,fogVis*.55)*uFogScale;vec3 fogColor=mix(vec3(.70,.74,.76),vec3(.18,.20,.25),night);c=mix(c,fogColor,sat(fog*(.16+.72*horizon)));
  float pm=sat(uPm25/220.0)*uPmScale,dust=sat(uDust),smoke=sat(uSmoke);c=saturation(c,1.0-pm*.58-smoke*.34);c=mix(c,vec3(.61,.56,.50),pm*(.05+.35*horizon));c=mix(c,vec3(.62,.49,.34),dust*(.08+.46*horizon));c=mix(c,vec3(.38,.40,.42),smoke*(.06+.42*horizon));float humidityHaze=pow(horizon,1.6)*uHumidity*.12;c=mix(c,vec3(.66,.67,.66),humidityHaze);
  float stars=step(.997,hash(floor(uv*uResolution/3.0)))*(1.0-smoothstep(-14.0,-6.0,uSolarAltitude));c+=vec3(.65,.72,.88)*stars*.18*(1.0-cloud);c+=vec3(.78,.86,1.0)*uFlash*(.25+.55*(1.0-uv.y));float vig=smoothstep(1.08,.28,length((uv-vec2(.5,.52))*vec2(aspect,1.0)));c*=mix(.90,1.0,vig);c+=(hash(gl_FragCoord.xy+vec2(uTime*31.0,uTime*17.0))-.5)/255.0;gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
}`});
  scene.add(new THREE.Mesh(geometry,material));applyConfig(config);
}

const snowParticles=Array.from({length:260},()=>({x:Math.random(),y:Math.random(),r:1+Math.random()*3.5,s:.10+Math.random()*.42,d:(Math.random()-.5)*.16,p:Math.random()*Math.PI*2}));
const hailParticles=Array.from({length:180},()=>({x:Math.random(),y:Math.random(),r:.8+Math.random()*2.1,s:.48+Math.random()*1.10,d:(Math.random()-.5)*.10}));
function createOverlayCanvas(id,z){const c=document.createElement('canvas');c.id=id;c.setAttribute('aria-hidden','true');Object.assign(c.style,{position:'absolute',inset:'0',zIndex:String(z),pointerEvents:'none',width:'100%',height:'100%'});stage.appendChild(c);return c}
function initPrecipOverlays(){snowCanvas=createOverlayCanvas('environmentSnowCanvas',4);snowCtx=snowCanvas.getContext('2d',{alpha:true,desynchronized:true});hailCanvas=createOverlayCanvas('environmentHailCanvas',5);hailCtx=hailCanvas.getContext('2d',{alpha:true,desynchronized:true});resize()}
function resizeOverlay(c,ctx){if(!c||!ctx)return;c.width=Math.round(width*DPR);c.height=Math.round(height*DPR);ctx.setTransform(DPR,0,0,DPR,0,0)}
function resize(){const rect=stage.getBoundingClientRect();width=Math.max(1,Math.round(rect.width||innerWidth||1));height=Math.max(1,Math.round(rect.height||innerHeight||1));renderer.setSize(width,height,false);uniforms.uResolution.value.set(width*DPR,height*DPR);resizeOverlay(snowCanvas,snowCtx);resizeOverlay(hailCanvas,hailCtx)}
function drawSnow(dt,time){if(!snowCtx)return;snowCtx.clearRect(0,0,width,height);const intensity=state.visual?.snow||0;if(intensity<.005)return;const active=Math.round(22+intensity*(snowParticles.length-22)),wind=(Math.sin(state.weather.windDirectionDeg*Math.PI/180)*state.weather.windSpeedKmh/220)*.65;snowCtx.lineCap='round';for(let i=0;i<active;i++){const p=snowParticles[i];p.y+=p.s*dt*(.55+intensity*.85);p.x+=(p.d+wind*.16+Math.sin(time*.8+p.p)*.006)*dt;if(p.y>1.03){p.y=-.04;p.x=Math.random()}if(p.x>1.03)p.x-=1.06;if(p.x<-.03)p.x+=1.06;const x=p.x*width,y=p.y*height,r=p.r*(.72+intensity*.55);snowCtx.fillStyle=`rgba(245,248,250,${(.22+.52*intensity).toFixed(3)})`;snowCtx.beginPath();snowCtx.arc(x,y,r,0,Math.PI*2);snowCtx.fill();if(i%7===0&&intensity>.55){snowCtx.strokeStyle=`rgba(255,255,255,${(.12+.18*intensity).toFixed(3)})`;snowCtx.lineWidth=.6;snowCtx.beginPath();snowCtx.moveTo(x-r*1.7,y);snowCtx.lineTo(x+r*1.7,y);snowCtx.moveTo(x,y-r*1.7);snowCtx.lineTo(x,y+r*1.7);snowCtx.stroke()}}}
function drawHail(dt){if(!hailCtx)return;hailCtx.clearRect(0,0,width,height);const intensity=state.visual?.hail||0;if(intensity<.005)return;const active=Math.round(10+intensity*(hailParticles.length-10)),wind=(Math.sin(state.weather.windDirectionDeg*Math.PI/180)*state.weather.windSpeedKmh/220)*.85;for(let i=0;i<active;i++){const p=hailParticles[i];p.y+=p.s*dt*(.75+intensity*.9);p.x+=(p.d+wind*.32)*dt;if(p.y>1.02){p.y=-.03;p.x=Math.random()}if(p.x>1.03)p.x-=1.06;if(p.x<-.03)p.x+=1.06;const x=p.x*width,y=p.y*height,r=p.r*(.8+intensity*.6);hailCtx.fillStyle=`rgba(240,247,250,${(.18+.58*intensity).toFixed(3)})`;hailCtx.beginPath();hailCtx.arc(x,y,r,0,Math.PI*2);hailCtx.fill();hailCtx.strokeStyle=`rgba(160,184,201,${(.12+.28*intensity).toFixed(3)})`;hailCtx.lineWidth=.55;hailCtx.stroke()}}
function updateLightning(now){const intensity=state.visual?.lightning||0;if(intensity<.01){flash*=.78;uniforms.uFlash.value=flash;nextFlashAt=0;return}if(!nextFlashAt)nextFlashAt=now+900+Math.random()*3200*(1.05-intensity*.75);if(now>=nextFlashAt){flash=.30+intensity*.48;nextFlashAt=now+650+Math.random()*Math.max(360,4600*(1.05-intensity))}flash*=.86;uniforms.uFlash.value=flash}

function syncState(){
  if(!uniforms)return;
  state.solar=solarPosition();state.lunar=lunarPosition();state.air=readAir();state.visual=normalizedWeather(state.weather);
  const sunAz=state.solar.azimuth*Math.PI/180,moonAz=state.lunar.azimuth*Math.PI/180;
  uniforms.uSun.value.set(clamp(.5-Math.sin(sunAz)*.42,.06,.94),skyY(state.solar.altitude));uniforms.uSolarAltitude.value=state.solar.altitude;
  uniforms.uMoon.value.set(clamp(.5-Math.sin(moonAz)*.42,.06,.94),skyY(state.lunar.altitude));uniforms.uMoonAltitude.value=state.lunar.altitude;uniforms.uMoonIllumination.value=state.lunar.illumination;uniforms.uMoonPhase.value=state.lunar.phase;
  uniforms.uTemperature.value=Number.isFinite(state.weather.temperatureC)?state.weather.temperatureC:30;uniforms.uHumidity.value=state.weather.humidity;uniforms.uVisibility.value=state.visual.visibility;uniforms.uCloudCover.value=state.visual.cloud;uniforms.uStorm.value=state.visual.storm;uniforms.uFog.value=state.visual.fog;uniforms.uHeat.value=state.visual.heat;uniforms.uWind.value=state.weather.windSpeedKmh;uniforms.uWindDirection.value=state.weather.windDirectionDeg;uniforms.uPm25.value=Number.isFinite(state.air.pm)?state.air.pm:12;uniforms.uDust.value=0;uniforms.uSmoke.value=0;
  document.body.dataset.environmentWeather=state.weather.known?(state.weather.cached?'cached':'live'):'unavailable';document.body.dataset.environmentWeatherType=state.visual.type;document.body.dataset.environmentCloud=state.weather.known?state.weather.cloudCover.toFixed(2):'unknown';document.body.dataset.environmentCloudEffective=state.weather.known?state.visual.cloud.toFixed(2):'unknown';document.body.dataset.environmentAir=Number.isFinite(state.air.pm)?'live':'loading';updateDebug();
}
function updateDebug(){if(!new URLSearchParams(location.search).has('debug'))return;if(!debug){debug=document.createElement('div');debug.className='environment-debug';document.body.appendChild(debug)}const v=state.visual,w=state.weather;debug.textContent=['ATMOSPHERE TESTER CORE · LIVE',`sun ${state.solar?.altitude?.toFixed?.(1)??'—'}° / moon ${state.lunar?.altitude?.toFixed?.(1)??'—'}°`,`PM2.5 ${state.air.pm??'—'} / AQI ${state.air.aqi??'—'}`,`weather ${w.known?(w.cached?'CACHED':'LIVE'):'pending'} · ${v?.type??'—'}`,v?`cloud ${Math.round(v.cloud*100)}% · rain ${Math.round(v.rain*100)}% · snow ${Math.round(v.snow*100)}% · storm ${Math.round(v.storm*100)}%`:'visual pending',`visibility ${w.visibilityKm?.toFixed?.(1)??'—'} km · wind ${Math.round(w.windSpeedKmh||0)} km/h`,`renderer DPR ${DPR.toFixed(2)} · tester core promoted`].join('\n')}
function setupTilt(){const target=new THREE.Vector2(),current=uniforms.uTilt.value,apply=event=>{if(!Number.isFinite(event.gamma)&&!Number.isFinite(event.beta))return;target.set(clamp((Number(event.gamma)||0)/28,-1,1),clamp(((Number(event.beta)||45)-45)/38,-1,1));current.lerp(target,.18);document.body.dataset.environmentTilt=`${current.x.toFixed(2)},${current.y.toFixed(2)}`},attach=()=>{window.addEventListener('deviceorientation',apply,{passive:true});document.body.dataset.environmentTiltMode='device'};if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){const request=()=>DeviceOrientationEvent.requestPermission().then(result=>{if(result==='granted')attach();else document.body.dataset.environmentTiltMode='pointer'}).catch(()=>document.body.dataset.environmentTiltMode='pointer');window.addEventListener('pointerdown',request,{once:true,capture:true,passive:true})}else if('DeviceOrientationEvent'in window)attach();else document.body.dataset.environmentTiltMode='pointer';window.addEventListener('pointermove',event=>{if(event.pointerType==='mouse'||document.body.dataset.environmentTiltMode==='pointer'){target.set(clamp(event.clientX/Math.max(innerWidth,1)*2-1,-1,1),-clamp(event.clientY/Math.max(innerHeight,1)*2-1,-1,1));current.lerp(target,.10)}},{passive:true})}
function render(now){raf=0;if(!pageVisible)return;const dt=Math.min(.04,Math.max(0,(now-lastFrame)/1000));lastFrame=now;uniforms.uTime.value=(now-start)/1000;updateLightning(now);drawSnow(dt,uniforms.uTime.value);drawHail(dt);renderer.render(scene,camera);raf=requestAnimationFrame(render)}
function requestRender(){if(!raf&&pageVisible){lastFrame=performance.now();raf=requestAnimationFrame(render)}}
function renderExport(w,h){return new Promise((resolve,reject)=>{try{const exportRenderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true,precision:'highp'});exportRenderer.outputColorSpace=THREE.SRGBColorSpace;exportRenderer.setPixelRatio(1);exportRenderer.setSize(Math.max(1,Math.round(w)),Math.max(1,Math.round(h)),false);const exportMaterial=material.clone();exportMaterial.uniforms=THREE.UniformsUtils.clone(uniforms);exportMaterial.uniforms.uResolution.value.set(w,h);const exportScene=new THREE.Scene();exportScene.add(new THREE.Mesh(geometry.clone(),exportMaterial));exportRenderer.render(exportScene,camera);const data=exportRenderer.domElement.toDataURL('image/png',1);exportScene.children[0].geometry.dispose();exportMaterial.dispose();exportRenderer.dispose();resolve(data)}catch(error){reject(error)}})}

export async function initEnvironment(){
  if(initialized)return;initialized=true;stage=document.getElementById('environmentStage');canvas=document.getElementById('environmentCanvas');if(!stage||!canvas||!window.WebGLRenderingContext){document.body.dataset.environmentWeather='unavailable';return}
  config=mergeConfig(window.SindhornAppPack?.getEnvironmentConfig?.()||DEFAULT_CONFIG);buildRenderer();initPrecipOverlays();start=performance.now();stage.hidden=false;resize();syncState();document.body.classList.add('environment-ready');setupTilt();
  new ResizeObserver(()=>{resize();requestRender()}).observe(stage);
  document.addEventListener('visibilitychange',()=>{pageVisible=!document.hidden;if(pageVisible)requestRender();else if(raf){cancelAnimationFrame(raf);raf=0}});
  document.addEventListener('sindhorn:air-updated',()=>{syncState();requestRender()});document.addEventListener('sindhorn:route-mounted',renderWeather);document.addEventListener('sindhorn:environment-config',event=>applyConfig(event.detail));
  window.SindhornEnvironment={refreshWeather:()=>fetchWeather().catch(()=>state.weather),renderExport,getState:()=>({weather:{...state.weather,visual:{...state.visual}},air:{...state.air},solar:{...state.solar},lunar:{...state.lunar},quality:DPR,config:structuredClone(config),renderer:'atmosphere-tester-core'}),applyConfig};
  requestRender();fetchWeather().catch(()=>{}).finally(()=>{syncState();renderWeather();requestRender()});setInterval(()=>fetchWeather().catch(()=>{}),10*60*1000);setInterval(()=>{syncState();requestRender()},60*1000);
}
