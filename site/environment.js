import * as THREE from './vendor/three.module.js';
import {seasonalSkyForState} from './seasonal-sky.js';
import {ATMOSPHERE_VERTEX_SHADER,ATMOSPHERE_FRAGMENT_SHADER,createAtmosphereNoiseTexture} from './atmosphere-shader.js';

const HOTEL={lat:13.74135,lon:100.54274,timezone:'Asia/Bangkok'};
const WEATHER_ENDPOINT='https://api.open-meteo.com/v1/forecast?latitude=13.74135&longitude=100.54274&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,is_day&timezone=Asia%2FBangkok';
const WEATHER_CACHE_KEY='sindhorn-midtown:weather:v2';
const WEATHER_CACHE_MAX_AGE=45*60*1000;
const DPR=2;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,Number(v)||0));

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

let stage,canvas,renderer,scene,camera,geometry,material,uniforms,noiseTexture,raf=0,start=0,pageVisible=!document.hidden,initialized=false,config=structuredClone(DEFAULT_CONFIG),debug=null;
let width=1,height=1,snowCanvas=null,snowCtx=null,hailCanvas=null,hailCtx=null,snowWasActive=false,hailWasActive=false,lastFrame=performance.now(),flash=0,nextFlashAt=0;
const state={
  air:{pm:null,aqi:null},
  weather:{known:false,cached:false,cloudCover:0,precipitationMm:0,rainMm:0,showersMm:0,snowfallCm:0,humidity:.68,windSpeedKmh:4,windDirectionDeg:180,windGustKmh:null,visibilityKm:20,temperatureC:null,apparentTemperatureC:null,weatherCode:null,isDay:null,observedAt:null},
  solar:null,lunar:null,visual:null,seasonal:null
};

function observerLocation(){
  const local=window.SindhornLocation?.getState?.(),latitude=Number(local?.latitude),longitude=Number(local?.longitude);
  return Number.isFinite(latitude)&&Number.isFinite(longitude)?{latitude,longitude,timezone:local?.timezone||HOTEL.timezone,source:local?.source||'device'}:{latitude:HOTEL.lat,longitude:HOTEL.lon,timezone:HOTEL.timezone,source:'hotel'};
}
function julianDay(date){return date.getTime()/86400000+2440587.5}
function solarPosition(date=new Date()){
  const loc=observerLocation(),jd=julianDay(date),n=jd-2451545,L=(280.46+.9856474*n)%360,g=((357.528+.9856003*n)%360)*Math.PI/180,lambda=(L+1.915*Math.sin(g)+.02*Math.sin(2*g))*Math.PI/180,epsilon=(23.439-.0000004*n)*Math.PI/180,alpha=Math.atan2(Math.cos(epsilon)*Math.sin(lambda),Math.cos(lambda)),delta=Math.asin(Math.sin(epsilon)*Math.sin(lambda)),ut=date.getUTCHours()+date.getUTCMinutes()/60+date.getUTCSeconds()/3600,gst=((6.697375+.0657098242*n+ut)%24+24)%24,lst=((gst+loc.longitude/15)%24+24)%24;
  let hourAngle=lst*15*Math.PI/180-alpha;while(hourAngle< -Math.PI)hourAngle+=Math.PI*2;while(hourAngle>Math.PI)hourAngle-=Math.PI*2;
  const lat=loc.latitude*Math.PI/180,altitude=Math.asin(Math.sin(lat)*Math.sin(delta)+Math.cos(lat)*Math.cos(delta)*Math.cos(hourAngle)),azimuth=Math.atan2(-Math.sin(hourAngle),Math.tan(delta)*Math.cos(lat)-Math.sin(lat)*Math.cos(hourAngle));
  return{altitude:altitude*180/Math.PI,azimuth:(azimuth*180/Math.PI+360)%360};
}
function lunarPosition(date=new Date()){
  const loc=observerLocation(),jd=julianDay(date),d=jd-2451543.5,rad=Math.PI/180,N=((125.1228-.0529538083*d)%360)*rad,i=5.1454*rad,w=((318.0634+.1643573223*d)%360)*rad,a=60.2666,e=.0549,M=((115.3654+13.0649929509*d)%360)*rad,E=M+e*Math.sin(M)*(1+e*Math.cos(M)),xv=a*(Math.cos(E)-e),yv=a*Math.sqrt(1-e*e)*Math.sin(E),v=Math.atan2(yv,xv),r=Math.hypot(xv,yv),xh=r*(Math.cos(N)*Math.cos(v+w)-Math.sin(N)*Math.sin(v+w)*Math.cos(i)),yh=r*(Math.sin(N)*Math.cos(v+w)+Math.cos(N)*Math.sin(v+w)*Math.cos(i)),zh=r*Math.sin(v+w)*Math.sin(i),lon=Math.atan2(yh,xh),lat=Math.atan2(zh,Math.hypot(xh,yh)),ob=(23.4393-3.563e-7*d)*rad,xe=Math.cos(lon)*Math.cos(lat),ye=Math.sin(lon)*Math.cos(lat)*Math.cos(ob)-Math.sin(lat)*Math.sin(ob),ze=Math.sin(lon)*Math.cos(lat)*Math.sin(ob)+Math.sin(lat)*Math.cos(ob),ra=Math.atan2(ye,xe),dec=Math.atan2(ze,Math.hypot(xe,ye)),T=(jd-2451545)/36525,gmst=(280.46061837+360.98564736629*(jd-2451545)+.000387933*T*T-T*T*T/38710000)%360,lst=((gmst+loc.longitude)%360+360)%360*rad;
  let hourAngle=lst-ra;while(hourAngle< -Math.PI)hourAngle+=Math.PI*2;while(hourAngle>Math.PI)hourAngle-=Math.PI*2;
  const phi=loc.latitude*rad,altitude=Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(hourAngle)),azimuth=Math.atan2(-Math.sin(hourAngle),Math.tan(dec)*Math.cos(phi)-Math.sin(phi)*Math.cos(hourAngle)),phase=(((jd-2451550.1)/29.53058867)%1+1)%1,illumination=.5*(1-Math.cos(phase*Math.PI*2));
  return{altitude:altitude/rad,azimuth:(azimuth/rad+360)%360,phase,illumination};
}
function skyY(altitude){return clamp(.12+clamp((altitude+2)/82,0,1)*.72,.08,.88)}
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
  if(FOG_CODES.has(code))cloud=Math.max(cloud,.78);if(RAIN_CODES.has(code)||SNOW_CODES.has(code))cloud=Math.max(cloud,.82);if(STORM_CODES.has(code))cloud=Math.max(cloud,.96);
  const rainBase=DRIZZLE_CODES.has(code)?.14:HEAVY_RAIN_CODES.has(code)?.72:RAIN_CODES.has(code)?.40:0,rain=clamp(Math.max(rainBase,rainMm/8));
  const snowBase=code===71?.25:code===73?.52:code===75?.85:code===77?.36:code===85?.52:code===86?.90:0,snow=clamp(Math.max(snowBase,snowCm/1.8));
  const lightning=STORM_CODES.has(code)?(code===95?.58:code===96?.78:.94):0,hail=HAIL_CODES.has(code)?(code===96?.48:.82):0;
  const fogCode=FOG_CODES.has(code)?(code===48?.92:.72):0,fogVisibility=clamp((4-visibility)/3.6),fog=clamp(Math.max(fogCode,fogVisibility)*(FOG_CODES.has(code)?1:.55));
  const stormCode=STORM_CODES.has(code)?(code===95?.62:code===96?.80:.94):0,storm=clamp(Math.max(stormCode,rain*.42+cloud*.22+clamp((wind-35)/100)*.28)),heat=clamp((temp-34)/10);
  const type=snow>.08?(snow>.72?'heavy-snow':'snow'):lightning>.1?'thunderstorm':rain>.12?(DRIZZLE_CODES.has(code)?'drizzle':'rain'):FOG_CODES.has(code)?'fog':cloud>.86?'overcast':cloud>.30?'partly-cloudy':'clear';
  return{cloud,rain,snow,hail,lightning,fog,storm,heat,visibility,temp,wind,type};
}
function weatherLabel(code){const c=Number(code);if(c===0)return'Clear';if(c===1)return'Mainly clear';if(c===2)return'Partly cloudy';if(c===3)return'Overcast';if(FOG_CODES.has(c))return'Fog';if(DRIZZLE_CODES.has(c))return'Drizzle';if([61,63,65,66,67].includes(c))return'Rain';if([71,73,75,77].includes(c))return'Snow';if([80,81,82].includes(c))return'Rain showers';if([85,86].includes(c))return'Snow showers';if(STORM_CODES.has(c))return'Thunderstorm';return'Current weather'}
function windPoint(deg){const labels=['N','NE','E','SE','S','SW','W','NW'];return labels[Math.round(((((Number(deg)||0)%360)+360)%360)/45)%8]}
function renderWeather(){
  const weatherNow=document.getElementById('weatherNow');if(!weatherNow||!state.weather.known||!Number.isFinite(state.weather.temperatureC))return;
  const w=state.weather,[en,th]=weatherLabel(w.weatherCode),feels=Number.isFinite(w.apparentTemperatureC)?Math.round(w.apparentTemperatureC):Math.round(w.temperatureC),set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value};
  set('weatherTemp',`${Math.round(w.temperatureC)}°`);set('weatherConditionEn',en);set('weatherMetaEn',`Feels ${feels}° · RH ${Math.round(w.humidity*100)}% · Wind ${windPoint(w.windDirectionDeg)} ${Math.round(w.windSpeedKmh)} km/h`);weatherNow.hidden=false;
}
function cachedWeather(){try{const cached=JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)||'null');if(!cached||!cached.savedAt||Date.now()-cached.savedAt>WEATHER_CACHE_MAX_AGE)return null;return cached.value||null}catch(_){return null}}
function saveWeather(value){try{localStorage.setItem(WEATHER_CACHE_KEY,JSON.stringify({savedAt:Date.now(),value}))}catch(_){}}
async function fetchWeather(){
  const cached=cachedWeather();if(cached&&!state.weather.known){state.weather={...cached,known:true,cached:true};renderWeather();syncState()}
  const response=await fetch(WEATHER_ENDPOINT,{cache:'no-store',credentials:'omit'});if(!response.ok)throw new Error('weather '+response.status);
  const value=await response.json(),current=value.current||{},n=(x,fallback=null)=>Number.isFinite(Number(x))?Number(x):fallback;if(value.timezone)window.SindhornLocation?.setTimezone?.(value.timezone);
  state.weather={known:true,cached:false,cloudCover:clamp(n(current.cloud_cover,0)/100),precipitationMm:Math.max(0,n(current.precipitation,0)),rainMm:Math.max(0,n(current.rain,0)),showersMm:Math.max(0,n(current.showers,0)),snowfallCm:Math.max(0,n(current.snowfall,0)),humidity:clamp(n(current.relative_humidity_2m,68)/100),windSpeedKmh:Math.max(0,n(current.wind_speed_10m,4)),windDirectionDeg:((n(current.wind_direction_10m,180)%360)+360)%360,windGustKmh:n(current.wind_gusts_10m),visibilityKm:Math.max(.1,n(current.visibility,20000)/1000),temperatureC:n(current.temperature_2m),apparentTemperatureC:n(current.apparent_temperature),weatherCode:n(current.weather_code),isDay:n(current.is_day),observedAt:current.time||null};
  saveWeather(state.weather);renderWeather();syncState();document.dispatchEvent(new CustomEvent('sindhorn:weather-updated',{detail:{weatherCode:state.weather.weatherCode,precipitationMm:state.weather.precipitationMm}}));requestRender();return state.weather;
}

function mergeConfig(next){if(!next||next.schema!==1)return structuredClone(DEFAULT_CONFIG);return{schema:1,sky:{...DEFAULT_CONFIG.sky,...next.sky},clouds:{...DEFAULT_CONFIG.clouds,...next.clouds},celestial:{...DEFAULT_CONFIG.celestial,...next.celestial},rain:{...DEFAULT_CONFIG.rain,...next.rain},storm:{...DEFAULT_CONFIG.storm,...next.storm},fog:{...DEFAULT_CONFIG.fog,...next.fog},pm25:{...DEFAULT_CONFIG.pm25,...next.pm25},tilt:{...DEFAULT_CONFIG.tilt,...next.tilt}}}
function applyConfig(next){
  config=mergeConfig(next);if(!uniforms)return;
  uniforms.uCloudContrast.value=clamp(Number(config.clouds.contrast)||1,.4,2.4);uniforms.uStormScale.value=clamp(Number(config.storm.darkening)||.72,0,1.2);uniforms.uFogScale.value=clamp(Number(config.fog.strength)||1,0,2);uniforms.uPmScale.value=clamp(Number(config.pm25.hazeStrength)||1,0,2);uniforms.uSunRadius.value=clamp(Number(config.celestial.sunRadius)||.018,.008,.035);uniforms.uSunGlow.value=clamp(Number(config.celestial.sunGlow)||1,0,2);uniforms.uMoonRadius.value=clamp(Number(config.celestial.moonRadius)||.0215,.008,.035);uniforms.uMoonGlow.value=clamp(Number(config.celestial.moonGlow)||1,0,2);uniforms.uTiltScale.value.set(clamp(Number(config.tilt.x)||.022,0,.06),clamp(Number(config.tilt.y)||.016,0,.06));requestRender();
}
function vec3(value){return new THREE.Vector3(Number(value?.[0])||0,Number(value?.[1])||0,Number(value?.[2])||0)}
function buildUniforms(){return{
  uNoise:{value:null},uTime:{value:0},uResolution:{value:new THREE.Vector2(1,1)},uSolarAltitude:{value:38},uSolarAzimuth:{value:180},uSun:{value:new THREE.Vector2(.72,.55)},uMoonAltitude:{value:-20},uMoon:{value:new THREE.Vector2(.28,.4)},uMoonIllumination:{value:.5},uMoonPhase:{value:.5},uCelestialEnabled:{value:1},
  uTemperature:{value:30},uHumidity:{value:.72},uVisibility:{value:20},uStorm:{value:0},uFog:{value:0},uHeat:{value:0},uWind:{value:8},uWindDirection:{value:225},uPm25:{value:12},uDust:{value:0},uSmoke:{value:0},uFlash:{value:0},uTilt:{value:new THREE.Vector2(0,0)},uTiltScale:{value:new THREE.Vector2(.022,.016)},
  uSeasonalStrength:{value:1},uHaze:{value:.18},uWarmLight:{value:.8},uSunRadius:{value:.018},uSunGlow:{value:1},uMoonRadius:{value:.0215},uMoonGlow:{value:1},
  uHighCoverage:{value:.05},uHighOpacity:{value:.30},uHighScale:{value:1.05},uHighStretch:{value:4.3},uHighSpeed:{value:.42},uMidCoverage:{value:.10},uMidOpacity:{value:.72},uMidScale:{value:1},uMidDetail:{value:1},uMidSoftness:{value:.10},uMidEdgeLight:{value:.6},uLowCoverage:{value:0},uLowOpacity:{value:.82},uLowScale:{value:.8},uLowBuild:{value:1},uConnected:{value:0},uBaseDarkness:{value:.2},uLightLeaks:{value:.55},uCloudContrast:{value:1},
  uStormScale:{value:.72},uFogScale:{value:1},uPmScale:{value:1},uSkyTop:{value:vec3([.23,.48,.76])},uSkyHorizon:{value:vec3([.72,.84,.91])},uCloudAmbient:{value:vec3([.75,.77,.80])},uCloudWarm:{value:vec3([.90,.67,.60])},uCloudBase:{value:vec3([.48,.52,.58])}
}}
function buildRenderer(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance',precision:'highp'});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(DPR);document.body.dataset.environmentQuality=DPR.toFixed(2);
  scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);geometry=new THREE.PlaneGeometry(2,2);uniforms=buildUniforms();noiseTexture=createAtmosphereNoiseTexture(THREE);uniforms.uNoise.value=noiseTexture;material=new THREE.ShaderMaterial({uniforms,depthWrite:false,depthTest:false,vertexShader:ATMOSPHERE_VERTEX_SHADER,fragmentShader:ATMOSPHERE_FRAGMENT_SHADER});scene.add(new THREE.Mesh(geometry,material));applyConfig(config);
}

const snowParticles=Array.from({length:260},()=>({x:Math.random(),y:Math.random(),r:1+Math.random()*3.5,s:.10+Math.random()*.42,d:(Math.random()-.5)*.16,p:Math.random()*Math.PI*2}));
const hailParticles=Array.from({length:180},()=>({x:Math.random(),y:Math.random(),r:.8+Math.random()*2.1,s:.48+Math.random()*1.10,d:(Math.random()-.5)*.10}));
function createOverlayCanvas(id,z){const c=document.createElement('canvas');c.id=id;c.setAttribute('aria-hidden','true');Object.assign(c.style,{position:'absolute',inset:'0',zIndex:String(z),pointerEvents:'none',width:'100%',height:'100%',display:'none'});stage.appendChild(c);return c}
function resizeOverlay(c,ctx){if(!c||!ctx)return;c.width=Math.round(width*DPR);c.height=Math.round(height*DPR);ctx.setTransform(DPR,0,0,DPR,0,0)}
function ensureSnowCanvas(){if(snowCanvas)return;snowCanvas=createOverlayCanvas('environmentSnowCanvas',4);snowCtx=snowCanvas.getContext('2d',{alpha:true,desynchronized:true});resizeOverlay(snowCanvas,snowCtx)}
function ensureHailCanvas(){if(hailCanvas)return;hailCanvas=createOverlayCanvas('environmentHailCanvas',5);hailCtx=hailCanvas.getContext('2d',{alpha:true,desynchronized:true});resizeOverlay(hailCanvas,hailCtx)}
function resize(){const rect=stage.getBoundingClientRect();width=Math.max(1,Math.round(rect.width||innerWidth||1));height=Math.max(1,Math.round(rect.height||innerHeight||1));renderer.setSize(width,height,false);uniforms.uResolution.value.set(width*DPR,height*DPR);resizeOverlay(snowCanvas,snowCtx);resizeOverlay(hailCanvas,hailCtx)}
function drawSnow(dt,time){const intensity=state.visual?.snow||0;if(intensity<.005){if(snowWasActive&&snowCtx){snowCtx.clearRect(0,0,width,height);snowCanvas.style.display='none';snowWasActive=false}return}ensureSnowCanvas();snowWasActive=true;snowCanvas.style.display='block';snowCtx.clearRect(0,0,width,height);const active=Math.round(22+intensity*(snowParticles.length-22)),wind=(Math.sin(state.weather.windDirectionDeg*Math.PI/180)*state.weather.windSpeedKmh/220)*.65;snowCtx.lineCap='round';for(let i=0;i<active;i++){const p=snowParticles[i];p.y+=p.s*dt*(.55+intensity*.85);p.x+=(p.d+wind*.16+Math.sin(time*.8+p.p)*.006)*dt;if(p.y>1.03){p.y=-.04;p.x=Math.random()}if(p.x>1.03)p.x-=1.06;if(p.x<-.03)p.x+=1.06;const x=p.x*width,y=p.y*height,r=p.r*(.72+intensity*.55);snowCtx.fillStyle=`rgba(245,248,250,${(.22+.52*intensity).toFixed(3)})`;snowCtx.beginPath();snowCtx.arc(x,y,r,0,Math.PI*2);snowCtx.fill();if(i%7===0&&intensity>.55){snowCtx.strokeStyle=`rgba(255,255,255,${(.12+.18*intensity).toFixed(3)})`;snowCtx.lineWidth=.6;snowCtx.beginPath();snowCtx.moveTo(x-r*1.7,y);snowCtx.lineTo(x+r*1.7,y);snowCtx.moveTo(x,y-r*1.7);snowCtx.lineTo(x,y+r*1.7);snowCtx.stroke()}}}
function drawHail(dt){const intensity=state.visual?.hail||0;if(intensity<.005){if(hailWasActive&&hailCtx){hailCtx.clearRect(0,0,width,height);hailCanvas.style.display='none';hailWasActive=false}return}ensureHailCanvas();hailWasActive=true;hailCanvas.style.display='block';hailCtx.clearRect(0,0,width,height);const active=Math.round(10+intensity*(hailParticles.length-10)),wind=(Math.sin(state.weather.windDirectionDeg*Math.PI/180)*state.weather.windSpeedKmh/220)*.85;for(let i=0;i<active;i++){const p=hailParticles[i];p.y+=p.s*dt*(.75+intensity*.9);p.x+=(p.d+wind*.32)*dt;if(p.y>1.02){p.y=-.03;p.x=Math.random()}if(p.x>1.03)p.x-=1.06;if(p.x<-.03)p.x+=1.06;const x=p.x*width,y=p.y*height,r=p.r*(.8+intensity*.6);hailCtx.fillStyle=`rgba(240,247,250,${(.18+.58*intensity).toFixed(3)})`;hailCtx.beginPath();hailCtx.arc(x,y,r,0,Math.PI*2);hailCtx.fill();hailCtx.strokeStyle=`rgba(160,184,201,${(.12+.28*intensity).toFixed(3)})`;hailCtx.lineWidth=.55;hailCtx.stroke()}}
function updateLightning(now){const intensity=state.visual?.lightning||0;if(intensity<.01){flash*=.78;uniforms.uFlash.value=flash;nextFlashAt=0;return}if(!nextFlashAt)nextFlashAt=now+900+Math.random()*3200*(1.05-intensity*.75);if(now>=nextFlashAt){flash=.30+intensity*.48;nextFlashAt=now+650+Math.random()*Math.max(360,4600*(1.05-intensity))}flash*=.86;uniforms.uFlash.value=flash}

function setVector3(target,value){target.set(Number(value?.[0])||0,Number(value?.[1])||0,Number(value?.[2])||0)}
function syncState(nowDate=new Date()){
  if(!uniforms)return;
  state.solar=solarPosition(nowDate);state.lunar=lunarPosition(nowDate);state.air=readAir();state.visual=normalizedWeather(state.weather);
  state.seasonal=seasonalSkyForState({date:nowDate,solarAltitude:state.solar.altitude,solarAzimuth:state.solar.azimuth,weather:{weatherCode:state.weather.weatherCode,cloudCover:state.visual.cloud,humidity:state.weather.humidity,rain:state.weather.rainMm,showers:state.weather.showersMm,precipitation:state.weather.precipitationMm,storm:state.visual.storm}});
  const sunAz=state.solar.azimuth*Math.PI/180,moonAz=state.lunar.azimuth*Math.PI/180,m=state.seasonal.morphology,p=state.seasonal.profile;
  uniforms.uSun.value.set(clamp(.5-Math.sin(sunAz)*.42,.06,.94),skyY(state.solar.altitude));uniforms.uSolarAltitude.value=state.solar.altitude;uniforms.uSolarAzimuth.value=state.solar.azimuth;uniforms.uMoon.value.set(clamp(.5-Math.sin(moonAz)*.42,.06,.94),skyY(state.lunar.altitude));uniforms.uMoonAltitude.value=state.lunar.altitude;uniforms.uMoonIllumination.value=state.lunar.illumination;uniforms.uMoonPhase.value=state.lunar.phase;
  uniforms.uTemperature.value=Number.isFinite(state.weather.temperatureC)?state.weather.temperatureC:30;uniforms.uHumidity.value=state.weather.humidity;uniforms.uVisibility.value=state.visual.visibility;uniforms.uStorm.value=state.visual.storm;uniforms.uFog.value=state.visual.fog;uniforms.uHeat.value=state.visual.heat;uniforms.uWind.value=state.weather.windSpeedKmh;uniforms.uWindDirection.value=state.weather.windDirectionDeg;uniforms.uPm25.value=Number.isFinite(state.air.pm)?state.air.pm:12;uniforms.uDust.value=0;uniforms.uSmoke.value=0;uniforms.uSeasonalStrength.value=1;uniforms.uHaze.value=state.seasonal.hazePrior;uniforms.uWarmLight.value=.58+state.seasonal.warmPotential*.58;
  const opacity=clamp(.74+(Number(config.clouds.opacity)||.52)*.26,.74,1.05),broad=clamp(.78+(Number(config.clouds.broadScale)||.62)*.34,.82,1.30),detail=clamp(.72+(Number(config.clouds.detailScale)||1.5)*.28,.82,1.55);
  uniforms.uHighCoverage.value=m.high;uniforms.uHighOpacity.value=clamp((.27+m.high*.27)*opacity,.20,.62);uniforms.uHighScale.value=broad*(.98+p.cirrus*.12);uniforms.uHighStretch.value=4.15+p.cirrus*.75;uniforms.uHighSpeed.value=.38;
  uniforms.uMidCoverage.value=m.mid;uniforms.uMidOpacity.value=clamp((.62+m.mid*.35)*opacity,.56,1);uniforms.uMidScale.value=broad;uniforms.uMidDetail.value=detail;uniforms.uMidSoftness.value=clamp(.13-m.edge*.055,.055,.13);uniforms.uMidEdgeLight.value=clamp(.24+m.edge*.72+(Number(config.clouds.edgeLight)||.48)*.18,.25,1);
  uniforms.uLowCoverage.value=m.low;uniforms.uLowOpacity.value=clamp((.72+m.low*.28)*opacity,.68,1);uniforms.uLowScale.value=broad*.79;uniforms.uLowBuild.value=1+m.convective*.78;uniforms.uConnected.value=m.connected;uniforms.uBaseDarkness.value=m.darkness;uniforms.uLightLeaks.value=clamp((m.family==='thunderstorm'?.24:m.family==='rain'||m.family==='drizzle'?.38:m.family==='showers'?.72:.54)+state.seasonal.warmPotential*.34,.22,1.08);
  setVector3(uniforms.uSkyTop.value,state.seasonal.top);setVector3(uniforms.uSkyHorizon.value,state.seasonal.horizon);setVector3(uniforms.uCloudAmbient.value,state.seasonal.cloudAmbient);setVector3(uniforms.uCloudWarm.value,state.seasonal.cloudWarm);setVector3(uniforms.uCloudBase.value,state.seasonal.cloudBase);
  document.body.dataset.environmentWeather=state.weather.known?(state.weather.cached?'cached':'live'):'unavailable';document.body.dataset.environmentWeatherType=state.visual.type;document.body.dataset.environmentCloud=state.weather.known?state.weather.cloudCover.toFixed(2):'unknown';document.body.dataset.environmentCloudEffective=state.weather.known?state.visual.cloud.toFixed(2):'unknown';document.body.dataset.environmentAir=Number.isFinite(state.air.pm)?'live':'loading';document.body.dataset.environmentSeason=`${state.seasonal.profile.anchorA}->${state.seasonal.profile.anchorB}`;document.body.dataset.cloudFamily=m.family;updateDebug();
}
function updateDebug(){if(!new URLSearchParams(location.search).has('debug'))return;if(!debug){debug=document.createElement('div');debug.className='environment-debug';document.body.appendChild(debug)}const v=state.visual,w=state.weather,loc=observerLocation(),m=state.seasonal?.morphology;debug.textContent=['BANGKOK SEASONAL CLOUDS · LIVE',`location ${loc.latitude.toFixed(3)}, ${loc.longitude.toFixed(3)} · ${loc.source}`,`sun ${state.solar?.altitude?.toFixed?.(1)??'—'}° / ${state.solar?.azimuth?.toFixed?.(0)??'—'}° az · moon ${state.lunar?.altitude?.toFixed?.(1)??'—'}°`,`season ${state.seasonal?.profile?.anchorA??'—'} → ${state.seasonal?.profile?.anchorB??'—'}`,`PM2.5 ${state.air.pm??'—'} / AQI ${state.air.aqi??'—'}`,`weather ${w.known?(w.cached?'CACHED':'LIVE'):'pending'} · ${v?.type??'—'}`,m?`cloud high ${Math.round(m.high*100)}% · mid ${Math.round(m.mid*100)}% · low ${Math.round(m.low*100)}%`:'cloud morphology pending',v?`rain ${Math.round(v.rain*100)}% · storm ${Math.round(v.storm*100)}% · visibility ${w.visibilityKm?.toFixed?.(1)??'—'} km`:'visual pending',`renderer DPR ${DPR.toFixed(2)} · phase 8.2`].join('\n')}
function setupTilt(){const target=new THREE.Vector2(),current=uniforms.uTilt.value,apply=event=>{if(!Number.isFinite(event.gamma)&&!Number.isFinite(event.beta))return;target.set(clamp((Number(event.gamma)||0)/28,-1,1),clamp(((Number(event.beta)||45)-45)/38,-1,1));current.lerp(target,.18);document.body.dataset.environmentTilt=`${current.x.toFixed(2)},${current.y.toFixed(2)}`},attach=()=>{window.addEventListener('deviceorientation',apply,{passive:true});document.body.dataset.environmentTiltMode='device'};if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){const request=()=>DeviceOrientationEvent.requestPermission().then(result=>{if(result==='granted')attach();else document.body.dataset.environmentTiltMode='pointer'}).catch(()=>document.body.dataset.environmentTiltMode='pointer');window.addEventListener('pointerdown',request,{once:true,capture:true,passive:true})}else if('DeviceOrientationEvent'in window)attach();else document.body.dataset.environmentTiltMode='pointer';window.addEventListener('pointermove',event=>{if(event.pointerType==='mouse'||document.body.dataset.environmentTiltMode==='pointer'){target.set(clamp(event.clientX/Math.max(innerWidth,1)*2-1,-1,1),-clamp(event.clientY/Math.max(innerHeight,1)*2-1,-1,1));current.lerp(target,.10)}},{passive:true})}
function render(now){raf=0;if(!pageVisible)return;const dt=Math.min(.04,Math.max(0,(now-lastFrame)/1000));lastFrame=now;uniforms.uTime.value=(now-start)/1000;updateLightning(now);drawSnow(dt,uniforms.uTime.value);drawHail(dt);renderer.render(scene,camera);raf=requestAnimationFrame(render)}
function requestRender(){if(!raf&&pageVisible){lastFrame=performance.now();raf=requestAnimationFrame(render)}}
function renderExport(w,h){return new Promise((resolve,reject)=>{try{const exportRenderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true,precision:'highp'});exportRenderer.outputColorSpace=THREE.SRGBColorSpace;exportRenderer.setPixelRatio(1);exportRenderer.setSize(Math.max(1,Math.round(w)),Math.max(1,Math.round(h)),false);const exportMaterial=material.clone();exportMaterial.uniforms=THREE.UniformsUtils.clone(uniforms);exportMaterial.uniforms.uResolution.value.set(w,h);const exportScene=new THREE.Scene(),mesh=new THREE.Mesh(geometry.clone(),exportMaterial);exportScene.add(mesh);exportRenderer.render(exportScene,camera);const data=exportRenderer.domElement.toDataURL('image/png',1);mesh.geometry.dispose();exportMaterial.dispose();exportRenderer.dispose();resolve(data)}catch(error){reject(error)}})}

export async function initEnvironment(){
  if(initialized)return;initialized=true;stage=document.getElementById('environmentStage');canvas=document.getElementById('environmentCanvas');if(!stage||!canvas||!window.WebGLRenderingContext){document.body.dataset.environmentWeather='unavailable';return}
  config=mergeConfig(window.SindhornAppPack?.getEnvironmentConfig?.()||DEFAULT_CONFIG);buildRenderer();start=performance.now();stage.hidden=false;resize();syncState();document.body.classList.add('environment-ready');setupTilt();
  new ResizeObserver(()=>{resize();requestRender()}).observe(stage);document.addEventListener('visibilitychange',()=>{pageVisible=!document.hidden;if(pageVisible)requestRender();else if(raf){cancelAnimationFrame(raf);raf=0}});document.addEventListener('sindhorn:air-updated',()=>{syncState();requestRender()});document.addEventListener('sindhorn:route-mounted',renderWeather);document.addEventListener('sindhorn:environment-config',event=>applyConfig(event.detail));document.addEventListener('sindhorn:location-updated',()=>{syncState();fetchWeather().catch(()=>{}).finally(()=>{syncState();renderWeather();requestRender()})});
  window.SindhornEnvironment={refreshWeather:()=>fetchWeather().catch(()=>state.weather),renderExport,getState:()=>({weather:{...state.weather,visual:{...state.visual}},air:{...state.air},solar:{...state.solar},lunar:{...state.lunar},location:observerLocation(),quality:DPR,config:structuredClone(config),seasonal:structuredClone(state.seasonal),renderer:'bangkok-seasonal-clouds-v2'}),applyConfig};
  requestRender();fetchWeather().catch(()=>{}).finally(()=>{syncState();renderWeather();requestRender()});setInterval(()=>fetchWeather().catch(()=>{}),10*60*1000);setInterval(()=>{syncState();requestRender()},60*1000);
}
