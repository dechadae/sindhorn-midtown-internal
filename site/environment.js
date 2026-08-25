import * as THREE from './vendor/three.module.js';

const HOTEL = { lat: 13.74135, lon: 100.54274, timezone: 'Asia/Bangkok' };
const WEATHER_ENDPOINT = 'https://api.open-meteo.com/v1/forecast?latitude=13.74135&longitude=100.54274&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,is_day&timezone=Asia%2FBangkok';
const WEATHER_CACHE_KEY = 'sindhorn-midtown:weather:v1';
const WEATHER_CACHE_MAX_AGE = 45 * 60 * 1000;
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
const stage = document.getElementById('environmentStage');
const canvas = document.getElementById('environmentCanvas');
const pmEl = document.getElementById('pmValue');
const aqiEl = document.getElementById('aqiValue');
const weatherNow = document.getElementById('weatherNow');
const weatherTemp = document.getElementById('weatherTemp');
const weatherConditionEn = document.getElementById('weatherConditionEn');
const weatherConditionTh = document.getElementById('weatherConditionTh');
const weatherMetaEn = document.getElementById('weatherMetaEn');
const weatherMetaTh = document.getElementById('weatherMetaTh');

if (!stage || !canvas || !pmEl || !aqiEl || !window.WebGLRenderingContext) {
  throw new Error('Realtime environment unavailable');
}

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function bangkokParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: HOTEL.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(date);
  const out = {};
  for (const p of parts) out[p.type] = p.value;
  return out;
}

function julianDay(date) { return date.getTime() / 86400000 + 2440587.5; }
function solarPosition(date = new Date()) {
  const jd = julianDay(date);
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * Math.PI / 180;
  const epsilon = (23.439 - 0.0000004 * n) * Math.PI / 180;
  const alpha = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
  const delta = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
  const parts = bangkokParts(date);
  const localHours = Number(parts.hour) + Number(parts.minute) / 60 + Number(parts.second) / 3600;
  const offsetHours = 7;
  const ut = localHours - offsetHours;
  const gst = ((6.697375 + 0.0657098242 * n + ut) % 24 + 24) % 24;
  const lst = ((gst + HOTEL.lon / 15) % 24 + 24) % 24;
  let hourAngle = lst * 15 * Math.PI / 180 - alpha;
  while (hourAngle < -Math.PI) hourAngle += Math.PI * 2;
  while (hourAngle > Math.PI) hourAngle -= Math.PI * 2;
  const lat = HOTEL.lat * Math.PI / 180;
  const altitude = Math.asin(Math.sin(lat) * Math.sin(delta) + Math.cos(lat) * Math.cos(delta) * Math.cos(hourAngle));
  const azimuth = Math.atan2(-Math.sin(hourAngle), Math.tan(delta) * Math.cos(lat) - Math.sin(lat) * Math.cos(hourAngle));
  return { altitude: altitude * 180 / Math.PI, azimuth: (azimuth * 180 / Math.PI + 360) % 360 };
}

function lunarPosition(date = new Date()) {
  // Compact low-cost lunar ephemeris for realtime visual placement.
  const jd = julianDay(date);
  const d = jd - 2451543.5;
  const rad = Math.PI / 180;
  const N = ((125.1228 - 0.0529538083 * d) % 360) * rad;
  const i = 5.1454 * rad;
  const w = ((318.0634 + 0.1643573223 * d) % 360) * rad;
  const a = 60.2666;
  const e = 0.0549;
  const M = ((115.3654 + 13.0649929509 * d) % 360) * rad;
  const E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.hypot(xv, yv);
  const xh = r * (Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(i));
  const yh = r * (Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(i));
  const zh = r * Math.sin(v + w) * Math.sin(i);
  const lon = Math.atan2(yh, xh);
  const lat = Math.atan2(zh, Math.hypot(xh, yh));
  const ob = (23.4393 - 3.563e-7 * d) * rad;
  const xe = Math.cos(lon) * Math.cos(lat);
  const ye = Math.sin(lon) * Math.cos(lat) * Math.cos(ob) - Math.sin(lat) * Math.sin(ob);
  const ze = Math.sin(lon) * Math.cos(lat) * Math.sin(ob) + Math.sin(lat) * Math.cos(ob);
  const ra = Math.atan2(ye, xe);
  const dec = Math.atan2(ze, Math.hypot(xe, ye));
  const T = (jd - 2451545.0) / 36525;
  const gmst = (280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000) % 360;
  const lst = ((gmst + HOTEL.lon) % 360 + 360) % 360 * rad;
  let hourAngle = lst - ra;
  while (hourAngle < -Math.PI) hourAngle += Math.PI * 2;
  while (hourAngle > Math.PI) hourAngle -= Math.PI * 2;
  const phi = HOTEL.lat * rad;
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle));
  const azimuth = Math.atan2(-Math.sin(hourAngle), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(hourAngle));
  const phase = (((jd - 2451550.1) / 29.53058867) % 1 + 1) % 1;
  const illumination = 0.5 * (1 - Math.cos(phase * Math.PI * 2));
  return { altitude: altitude / rad, azimuth: (azimuth / rad + 360) % 360, phase, illumination };
}

function readAir() {
  const pm25 = Number.parseFloat(pmEl.textContent || '');
  const aqi = Number.parseFloat(aqiEl.textContent || '');
  return { pm25: Number.isFinite(pm25) ? pm25 : null, aqi: Number.isFinite(aqi) ? aqi : null };
}

function pollutionStrength(pm) {
  if (!Number.isFinite(pm)) return 0.18;
  if (pm <= 15) return mix(0.04, 0.13, pm / 15);
  if (pm <= 25) return mix(0.13, 0.25, (pm - 15) / 10);
  if (pm <= 37.5) return mix(0.25, 0.42, (pm - 25) / 12.5);
  if (pm <= 75) return mix(0.42, 0.72, (pm - 37.5) / 37.5);
  return clamp(0.72 + (pm - 75) / 150 * 0.28, 0.72, 1);
}

function weatherLabel(code) {
  const c = Number(code);
  if (c === 0) return ['Clear', 'ท้องฟ้าแจ่มใส'];
  if (c === 1) return ['Mainly clear', 'ท้องฟ้าโปร่ง'];
  if (c === 2) return ['Partly cloudy', 'มีเมฆบางส่วน'];
  if (c === 3) return ['Overcast', 'มีเมฆมาก'];
  if ([45,48].includes(c)) return ['Fog', 'มีหมอก'];
  if ([51,53,55,56,57].includes(c)) return ['Drizzle', 'ฝนละออง'];
  if ([61,63,65,66,67].includes(c)) return ['Rain', 'ฝนตก'];
  if ([71,73,75,77].includes(c)) return ['Snow', 'หิมะ'];
  if ([80,81,82].includes(c)) return ['Rain showers', 'ฝนตกเป็นช่วง'];
  if ([85,86].includes(c)) return ['Snow showers', 'หิมะตกเป็นช่วง'];
  if ([95,96,99].includes(c)) return ['Thunderstorm', 'พายุฝนฟ้าคะนอง'];
  return ['Current weather', 'สภาพอากาศขณะนี้'];
}

function windPoint(deg) {
  const labels = ['N','NE','E','SE','S','SW','W','NW'];
  return labels[Math.round(((((Number(deg) || 0) % 360) + 360) % 360) / 45) % 8];
}

function renderWeather() {
  if (!weatherNow || !state.weather.known || !Number.isFinite(state.weather.temperatureC)) return;
  const w = state.weather;
  const [en, th] = weatherLabel(w.weatherCode);
  weatherTemp.textContent = `${Math.round(w.temperatureC)}°`;
  weatherConditionEn.textContent = en;
  weatherConditionTh.textContent = th;
  const feels = Number.isFinite(w.apparentTemperatureC) ? Math.round(w.apparentTemperatureC) : Math.round(w.temperatureC);
  const rh = Math.round(w.humidity * 100);
  const wind = Math.round(w.windSpeedKmh);
  const dir = windPoint(w.windDirectionDeg);
  weatherMetaEn.textContent = `Feels ${feels}° · RH ${rh}% · Wind ${dir} ${wind} km/h`;
  weatherMetaTh.textContent = `รู้สึกเหมือน ${feels}° · ความชื้น ${rh}% · ลม ${dir} ${wind} กม./ชม.`;
  weatherNow.hidden = false;
}

function cachedWeather() {
  try {
    const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || 'null');
    if (!cached || !cached.savedAt || Date.now() - cached.savedAt > WEATHER_CACHE_MAX_AGE) return null;
    return cached.value || null;
  } catch (_) { return null; }
}

function saveWeather(value) {
  try { localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({savedAt: Date.now(), value})); } catch (_) {}
}

const state = {
  air: readAir(),
  weather: {
    known: false,
    cloudCover: 0,
    precipitationMm: 0,
    humidity: 0.68,
    windSpeedKmh: 4,
    windDirectionDeg: 180,
    windGustKmh: null,
    visibilityKm: 20,
    temperatureC: null,
    apparentTemperatureC: null,
    weatherCode: null,
    isDay: null,
    observedAt: null
  },
  solar: solarPosition(),
  lunar: lunarPosition()
};

async function fetchWeather() {
  const cached = cachedWeather();
  if (cached && !state.weather.known) {
    state.weather = { ...cached, known: true, cached: true };
    renderWeather();
    syncState();
  }
  try {
    const response = await fetch(WEATHER_ENDPOINT, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('weather ' + response.status);
    const value = await response.json();
    const current = value.current || {};
    const n = (x, fallback = null) => Number.isFinite(Number(x)) ? Number(x) : fallback;
    const weather = {
      known: true,
      cached: false,
      cloudCover: clamp(n(current.cloud_cover, 0) / 100),
      precipitationMm: Math.max(0, n(current.precipitation, 0)),
      humidity: clamp(n(current.relative_humidity_2m, 68) / 100),
      windSpeedKmh: Math.max(0, n(current.wind_speed_10m, 4)),
      windDirectionDeg: ((n(current.wind_direction_10m, 180) % 360) + 360) % 360,
      windGustKmh: n(current.wind_gusts_10m),
      visibilityKm: Math.max(0.1, n(current.visibility, 20000) / 1000),
      temperatureC: n(current.temperature_2m),
      apparentTemperatureC: n(current.apparent_temperature),
      weatherCode: n(current.weather_code),
      isDay: n(current.is_day),
      observedAt: current.time || null
    };
    state.weather = weather;
    saveWeather(weather);
    renderWeather();
  } catch (_) {
    if (!state.weather.known) state.weather.known = false;
  }
}

const lowPowerDevice=((navigator.deviceMemory||8)<=4)||((navigator.hardwareConcurrency||8)<=4);
const maxPixelRatio=lowPowerDevice ? 0.72 : 1.0;
let activePixelRatio=Math.min(window.devicePixelRatio || 1,maxPixelRatio);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(activePixelRatio);
document.body.dataset.environmentQuality=activePixelRatio.toFixed(2);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const geometry = new THREE.PlaneGeometry(2, 2);

const uniforms = {
  uTime: { value: 0 },
  uResolution: { value: new THREE.Vector2(1, 1) },
  uSun: { value: new THREE.Vector2(0.5, 0.35) },
  uSolarAltitude: { value: 45 },
  uMoon: { value: new THREE.Vector2(0.5, 0.42) },
  uMoonAltitude: { value: -20 },
  uMoonPhase: { value: 0.5 },
  uMoonIllumination: { value: 1 },
  uPollution: { value: 0.2 },
  uCloud: { value: 0 },
  uRain: { value: 0 },
  uHumidity: { value: 0.68 },
  uVisibilityKm: { value: 20 },
  uWind: { value: new THREE.Vector2(0.02, 0) },
  uWeatherKnown: { value: 0 }
};

const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: `
    varying vec2 vUv;
    void main(){vUv=uv;gl_Position=vec4(position,1.0);}
  `,
  fragmentShader: `
    precision mediump float;
    varying vec2 vUv;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec2 uSun;
    uniform float uSolarAltitude;
    uniform vec2 uMoon;
    uniform float uMoonAltitude;
    uniform float uMoonPhase;
    uniform float uMoonIllumination;
    uniform float uPollution;
    uniform float uCloud;
    uniform float uRain;
    uniform float uHumidity;
    uniform float uVisibilityKm;
    uniform vec2 uWind;
    uniform float uWeatherKnown;

    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
    }
    float fbm(vec2 p){float v=0.,a=.54;for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.03+17.13;a*=.5;}return v;}
    vec3 sat(vec3 c,float s){float l=dot(c,vec3(.2126,.7152,.0722));return mix(vec3(l),c,s);}

    void main(){
      vec2 uv=vUv;
      float aspect=clamp(uResolution.x/max(uResolution.y,1.0),.50,2.20);
      vec2 fieldUv=vec2(uv.x*aspect,uv.y);
      float daylight=smoothstep(-7.0,8.0,uSolarAltitude);
      float twilight=1.0-smoothstep(-5.0,5.0,abs(uSolarAltitude));
      float horizon=pow(1.0-uv.y,1.35);

      vec3 nightTop=vec3(.070,.078,.125);
      vec3 nightHorizon=vec3(.165,.155,.205);
      vec3 dayTop=vec3(.27,.47,.69);
      vec3 dayHorizon=vec3(.72,.76,.77);
      vec3 cleanSky=mix(mix(nightHorizon,dayHorizon,daylight),mix(nightTop,dayTop,daylight),smoothstep(.05,.92,uv.y));

      float pollution=clamp(uPollution,0.,1.);
      vec3 dirtyGrey=vec3(.52,.49,.46);
      vec3 polluted=sat(cleanSky,1.0-pollution*.72);
      polluted=mix(polluted,dirtyGrey,pollution*(.28+.52*horizon));

      float unknownVeil=(1.0-uWeatherKnown)*.06;
      polluted=mix(polluted,vec3(.40,.39,.42),unknownVeil*horizon);

      float weatherFog=uWeatherKnown*(1.0-smoothstep(2.0,18.0,uVisibilityKm));
      polluted=mix(polluted,vec3(.63,.63,.64),weatherFog*pow(horizon,.8)*.58);

      float cloudiness=uCloud*uWeatherKnown;
      vec2 wind=uWind*uTime*.028;
      vec2 cloudUv=fieldUv*vec2(1.55,1.02)+wind*.65;
      float broad=fbm(cloudUv+vec2(0.,uTime*.0012));
      float detail=fbm(cloudUv*1.73+vec2(broad*.45,-broad*.28)+wind*.35+vec2(9.7,3.4));
      float cloudNoise=mix(broad,detail,.38);
      float cloudMask=smoothstep(.49-.22*cloudiness,.82-.30*cloudiness,cloudNoise)*cloudiness;
      float overcast=smoothstep(.70,.97,cloudiness);
      cloudMask=max(cloudMask,overcast*(.48+.42*broad));
      cloudMask*=smoothstep(.00,.18,uv.y);
      float nightness=1.0-daylight;
      float cloudLight=mix(.86,.63,pollution*.65);
      float cloudRelief=smoothstep(.16,.88,mix(broad,detail,.58));
      vec3 dayCloud=mix(vec3(.43,.44,.47),vec3(cloudLight),cloudRelief);
      vec3 nightCloud=mix(vec3(.14,.16,.22),vec3(.33,.35,.42),cloudRelief);
      nightCloud=mix(nightCloud,vec3(.25,.24,.30),pollution*.30);
      vec3 cloudColor=mix(dayCloud,nightCloud,nightness);
      float cloudOpacity=mix(.72,.93,nightness);
      polluted=mix(polluted,cloudColor,cloudMask*cloudOpacity);
      float urbanGlow=nightness*pow(horizon,1.55)*(.025+.10*pollution)*(.30+.70*cloudiness);
      polluted+=vec3(.12,.075,.14)*urbanGlow;

      float sunRadius=mix(.018,.032,pollution)+cloudiness*.008;
      // Measure the sun in aspect-correct screen space so it stays circular
      // on phones, desktop windows, and ultrawide viewports. Radius is expressed
      // relative to viewport height; horizontal UV distance is corrected by W/H.
      vec2 sunDelta=uv-uSun;
      sunDelta.x*=uResolution.x/max(uResolution.y,1.0);
      float sunDist=length(sunDelta);
      float sunDisc=1.0-smoothstep(sunRadius,sunRadius+.006,sunDist);
      float sunGlow=exp(-sunDist*mix(38.0,13.0,pollution));
      float sunAbove=smoothstep(-4.0,1.5,uSolarAltitude);
      float sunVisibility=sunAbove*(1.0-cloudMask*.75)*mix(1.0,.42,pollution);
      vec3 sunWarm=mix(vec3(1.0,.66,.35),vec3(1.0,.95,.78),smoothstep(6.0,42.0,uSolarAltitude));
      polluted+=sunWarm*(sunDisc*1.25+sunGlow*.28)*sunVisibility;

      // Moon uses realtime lunar position and phase. Weather and PM2.5 attenuate it.
      vec2 moonDelta=uv-uMoon;
      moonDelta.x*=uResolution.x/max(uResolution.y,1.0);
      float moonDist=length(moonDelta);
      float moonRadius=.026;
      vec2 moonP=moonDelta/max(moonRadius,.001);
      float moonR2=dot(moonP,moonP);
      float moonDisc=1.0-smoothstep(.94,1.02,sqrt(moonR2));
      float moonZ=sqrt(max(0.0,1.0-moonR2));
      float phaseAngle=uMoonPhase*6.28318530718;
      vec3 moonNormal=normalize(vec3(moonP.x,moonP.y,moonZ));
      vec3 moonLightDir=normalize(vec3(sin(phaseAngle),0.0,-cos(phaseAngle)));
      float moonLit=smoothstep(-.035,.065,dot(moonNormal,moonLightDir));
      float moonAbove=smoothstep(-3.0,2.0,uMoonAltitude);
      float denseCloud=smoothstep(.48,.92,cloudMask);
      float moonDiscTransmission=mix(1.0,.025,denseCloud);
      float moonPollution=mix(1.0,.58,pollution);
      float moonVisible=moonAbove*moonPollution;
      vec3 moonColor=vec3(.96,.94,.83);
      polluted+=moonColor*moonDisc*moonLit*moonVisible*moonDiscTransmission*1.28;
      float moonGlow=exp(-moonDist*mix(32.0,12.0,denseCloud+.50*pollution));
      polluted+=vec3(.34,.37,.48)*moonGlow*moonAbove*uMoonIllumination*mix(.08,.31,denseCloud)*moonPollution;

      float haze=pow(horizon,2.15)*pollution*(.22+.38*uHumidity);
      polluted=mix(polluted,vec3(.64,.59,.54),haze);

      float rainAmount=clamp(uRain/6.0,0.,1.)*uWeatherKnown;
      if(rainAmount>0.001){
        vec2 ruv=fieldUv*vec2(44.0,22.0);
        ruv.x+=uTime*1.7+ruv.y*.42;
        float streak=step(.965,hash(floor(ruv)))*smoothstep(.88,.1,fract(ruv.y));
        polluted+=vec3(.72,.79,.84)*streak*rainAmount*.45;
        polluted=mix(polluted,vec3(.25,.27,.31),rainAmount*.14);
      }

      vec2 vignetteDelta=uv-vec2(.5,.48);
      vignetteDelta.x*=aspect;
      float vignette=smoothstep(1.08,.28,length(vignetteDelta));
      polluted*=mix(.86,1.0,vignette);
      gl_FragColor=vec4(polluted,1.0);
    }
  `,
  depthWrite: false,
  depthTest: false
});
scene.add(new THREE.Mesh(geometry, material));

function resize() {
  const rect = stage.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  renderer.setSize(width, height, false);
  uniforms.uResolution.value.set(width, height);
}

function syncState() {
  state.solar = solarPosition();
  state.lunar = lunarPosition();
  state.air = readAir();
  const pollution = pollutionStrength(state.air.pm25);
  const alt = state.solar.altitude;
  const az = state.solar.azimuth * Math.PI / 180;
  const skyY = altitude => clamp(0.12 + clamp((altitude + 2) / 82, 0, 1) * 0.72, 0.08, 0.88);
  const sunX = clamp(0.5 - Math.sin(az) * 0.42, 0.06, 0.94);
  const sunY = skyY(alt);
  const moonAlt = state.lunar.altitude;
  const moonAz = state.lunar.azimuth * Math.PI / 180;
  const moonX = clamp(0.5 - Math.sin(moonAz) * 0.42, 0.06, 0.94);
  const moonY = skyY(moonAlt);
  const speed = clamp(state.weather.windSpeedKmh / 30, 0.02, 1);
  const dir = state.weather.windDirectionDeg * Math.PI / 180;

  uniforms.uSun.value.set(sunX, sunY);
  uniforms.uSolarAltitude.value = alt;
  uniforms.uMoon.value.set(moonX, moonY);
  uniforms.uMoonAltitude.value = moonAlt;
  uniforms.uMoonPhase.value = state.lunar.phase;
  uniforms.uMoonIllumination.value = state.lunar.illumination;
  uniforms.uPollution.value = pollution;
  uniforms.uCloud.value = state.weather.cloudCover;
  uniforms.uRain.value = state.weather.precipitationMm;
  uniforms.uHumidity.value = state.weather.humidity;
  uniforms.uVisibilityKm.value = Number.isFinite(state.weather.visibilityKm) ? state.weather.visibilityKm : 20;
  uniforms.uWind.value.set(Math.sin(dir) * speed, -Math.cos(dir) * speed);
  uniforms.uWeatherKnown.value = state.weather.known ? 1 : 0;
  document.body.dataset.environmentWeather = state.weather.known ? 'live' : 'unavailable';
  document.body.dataset.environmentAir = Number.isFinite(state.air.pm25) ? 'live' : 'loading';
  document.body.dataset.environmentMoonAltitude = moonAlt.toFixed(1);
  document.body.dataset.environmentMoonIllumination = state.lunar.illumination.toFixed(2);
  document.body.dataset.environmentCloud = state.weather.known ? state.weather.cloudCover.toFixed(2) : 'unknown';
  document.body.dataset.environmentSunY = sunY.toFixed(3);
  document.body.dataset.environmentMoonY = moonY.toFixed(3);
  updateDebug();
}

let debug;
function updateDebug() {
  if (!new URLSearchParams(location.search).has('debug')) return;
  if (!debug) {
    debug = document.createElement('div');
    debug.className = 'environment-debug';
    document.body.appendChild(debug);
  }
  const w = state.weather;
  debug.textContent = [
    'ENVIRONMENT PREVIEW v1',
    `sun: ${state.solar.altitude.toFixed(1)}° alt / ${state.solar.azimuth.toFixed(1)}° az`,
    `moon: ${state.lunar.altitude.toFixed(1)}° alt / ${state.lunar.azimuth.toFixed(1)}° az · ${(state.lunar.illumination*100).toFixed(0)}% lit`,
    `pm2.5: ${state.air.pm25 ?? '—'} / AQI: ${state.air.aqi ?? '—'}`,
    `pollution shader: ${(uniforms.uPollution.value * 100).toFixed(0)}%`,
    `weather: ${w.known ? (w.cached ? 'CACHED' : 'LIVE') : 'provider pending'}`,
    w.known ? `temp ${Math.round(w.temperatureC)}° · cloud ${Math.round(w.cloudCover * 100)}% · rain ${w.precipitationMm.toFixed(1)} mm · RH ${Math.round(w.humidity * 100)}% · vis ${w.visibilityKm.toFixed(1)} km` : 'cloud/rain deliberately not inferred',
    `renderer: ${reducedMotion ? 'static/reduced motion' : 'display-synced adaptive'} · scale ${activePixelRatio.toFixed(2)}`
  ].join('\n');
}

let visible = true;
let pageVisible = !document.hidden;
let raf = 0;
let lastFrame = 0;
let perfSamples = [];
let lastQualityChange = 0;
const start = performance.now();

function adaptQuality(delta,now) {
  if (reducedMotion || !Number.isFinite(delta) || delta <= 0 || now-lastQualityChange < 1500) return;
  perfSamples.push(delta);
  if (perfSamples.length < 36) return;
  const avg=perfSamples.reduce((a,b)=>a+b,0)/perfSamples.length;
  perfSamples=[];
  if (avg > 24 && activePixelRatio > 0.50) {
    activePixelRatio=Math.max(0.50,activePixelRatio*0.82);
    renderer.setPixelRatio(activePixelRatio);
    document.body.dataset.environmentQuality=activePixelRatio.toFixed(2);
    lastQualityChange=now;
    resize();
  }
}

function render(now) {
  raf = 0;
  if (!visible || !pageVisible) return;
  const delta=lastFrame ? now-lastFrame : 16.7;
  lastFrame = now;
  adaptQuality(delta,now);
  uniforms.uTime.value = reducedMotion ? 0 : (now - start) / 1000;
  renderer.render(scene, camera);
  if (!reducedMotion) raf = requestAnimationFrame(render);
}

function requestRender() {
  if (reducedMotion) {
    uniforms.uTime.value = 0;
    renderer.render(scene, camera);
  } else if (!raf && visible && pageVisible) {
    raf = requestAnimationFrame(render);
  }
}

const io = new IntersectionObserver(entries => {
  visible = entries[0]?.isIntersecting ?? true;
  if (visible) requestRender();
  else if (raf) { cancelAnimationFrame(raf); raf = 0; }
}, { threshold: 0.01 });
io.observe(stage);

document.addEventListener('visibilitychange', () => {
  pageVisible = !document.hidden;
  if (pageVisible) requestRender();
  else if (raf) { cancelAnimationFrame(raf); raf = 0; }
});

const airObserver = new MutationObserver(() => {
  syncState();
  requestRender();
});
airObserver.observe(pmEl, { childList: true, characterData: true, subtree: true });
airObserver.observe(aqiEl, { childList: true, characterData: true, subtree: true });

new ResizeObserver(() => { resize(); requestRender(); }).observe(stage);

stage.hidden = false;
resize();
syncState();
document.body.classList.add('environment-ready');
requestRender();

fetchWeather().finally(() => { syncState(); requestRender(); });
setInterval(() => {
  fetchWeather().finally(() => { syncState(); requestRender(); });
}, 10 * 60 * 1000);
setInterval(() => { syncState(); requestRender(); }, 60 * 1000);
