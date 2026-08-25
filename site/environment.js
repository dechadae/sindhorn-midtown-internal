import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

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

// NOAA-style solar position approximation; enough for visual placement, not legal/astronomical use.
function solarPosition(date = new Date()) {
  const rad = Math.PI / 180;
  const ms = date.getTime();
  const jd = ms / 86400000 + 2440587.5;
  const t = (jd - 2451545.0) / 36525;
  const L0 = (280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360;
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const C = Math.sin(M * rad) * (1.914602 - t * (0.004817 + 0.000014 * t))
    + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * t)
    + Math.sin(3 * M * rad) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * t;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * rad);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * rad);
  const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad));
  const y = Math.tan((eps * rad) / 2) ** 2;
  const eqTime = 4 / rad * (
    y * Math.sin(2 * L0 * rad)
    - 2 * e * Math.sin(M * rad)
    + 4 * e * y * Math.sin(M * rad) * Math.cos(2 * L0 * rad)
    - 0.5 * y * y * Math.sin(4 * L0 * rad)
    - 1.25 * e * e * Math.sin(2 * M * rad)
  );
  const p = bangkokParts(date);
  const localMinutes = Number(p.hour) * 60 + Number(p.minute) + Number(p.second) / 60;
  const timezoneMinutes = 7 * 60;
  let trueSolarMinutes = (localMinutes + eqTime + 4 * HOTEL.lon - timezoneMinutes) % 1440;
  if (trueSolarMinutes < 0) trueSolarMinutes += 1440;
  let hourAngle = trueSolarMinutes / 4 - 180;
  if (hourAngle < -180) hourAngle += 360;
  const lat = HOTEL.lat * rad;
  const ha = hourAngle * rad;
  const cosZenith = clamp(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha), -1, 1);
  const zenith = Math.acos(cosZenith);
  const altitude = 90 - zenith / rad;
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat));
  const azimuth = (az / rad + 180 + 360) % 360;
  return { altitude, azimuth, localMinutes };
}

function readAir() {
  const pm = Number(pmEl.textContent.trim());
  const aqi = Number(aqiEl.textContent.trim());
  return {
    pm25: Number.isFinite(pm) ? pm : null,
    aqi: Number.isFinite(aqi) ? aqi : null
  };
}

function pollutionStrength(pm25) {
  if (!Number.isFinite(pm25)) return 0.18;
  return clamp(
    0.08 * smoothstep(8, 18, pm25)
    + 0.32 * smoothstep(18, 37.5, pm25)
    + 0.35 * smoothstep(37.5, 75, pm25)
    + 0.25 * smoothstep(75, 150, pm25)
  );
}


function weatherLabel(code) {
  const c = Number(code);
  if (c === 0) return ['Clear sky','ท้องฟ้าแจ่มใส'];
  if (c === 1) return ['Mainly clear','ท้องฟ้าส่วนใหญ่แจ่มใส'];
  if (c === 2) return ['Partly cloudy','มีเมฆบางส่วน'];
  if (c === 3) return ['Overcast','มีเมฆมาก'];
  if (c === 45 || c === 48) return ['Foggy','มีหมอก'];
  if ([51,53,55,56,57].includes(c)) return ['Drizzle','ฝนปรอย'];
  if ([61,63,65,66,67].includes(c)) return ['Rain','ฝนตก'];
  if ([71,73,75,77].includes(c)) return ['Snow','หิมะ'];
  if ([80,81,82].includes(c)) return ['Rain showers','ฝนตกเป็นช่วง'];
  if ([85,86].includes(c)) return ['Snow showers','หิมะตกเป็นช่วง'];
  if ([95,96,99].includes(c)) return ['Thunderstorm','พายุฝนฟ้าคะนอง'];
  return ['Current weather','สภาพอากาศขณะนี้'];
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
  solar: solarPosition()
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

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const geometry = new THREE.PlaneGeometry(2, 2);

const uniforms = {
  uTime: { value: 0 },
  uResolution: { value: new THREE.Vector2(1, 1) },
  uSun: { value: new THREE.Vector2(0.5, 0.35) },
  uSolarAltitude: { value: 45 },
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
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec2 uSun;
    uniform float uSolarAltitude;
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
    float fbm(vec2 p){float v=0.,a=.52;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+17.13;a*=.5;}return v;}
    vec3 sat(vec3 c,float s){float l=dot(c,vec3(.2126,.7152,.0722));return mix(vec3(l),c,s);}

    void main(){
      vec2 uv=vUv;
      float daylight=smoothstep(-7.0,8.0,uSolarAltitude);
      float twilight=1.0-smoothstep(-5.0,5.0,abs(uSolarAltitude));
      float horizon=pow(1.0-uv.y,1.35);

      vec3 nightTop=vec3(.055,.045,.085);
      vec3 nightHorizon=vec3(.13,.105,.17);
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
      vec2 wind=uWind*uTime*.035;
      float cloudNoise=fbm(uv*vec2(3.2,2.1)+wind+vec2(0.,uTime*.002));
      float cloudMask=smoothstep(.52-.26*cloudiness,.82-.34*cloudiness,cloudNoise)*cloudiness;
      float cloudLight=mix(.86,.63,pollution*.65);
      vec3 cloudColor=mix(vec3(cloudLight),vec3(.38,.37,.40),smoothstep(.65,1.,cloudiness));
      polluted=mix(polluted,cloudColor,cloudMask*.74);

      float sunRadius=mix(.018,.032,pollution)+cloudiness*.008;
      float sunDist=distance(uv,uSun);
      float sunDisc=1.0-smoothstep(sunRadius,sunRadius+.006,sunDist);
      float sunGlow=exp(-sunDist*mix(38.0,13.0,pollution));
      float sunAbove=smoothstep(-4.0,1.5,uSolarAltitude);
      float sunVisibility=sunAbove*(1.0-cloudMask*.75)*mix(1.0,.42,pollution);
      vec3 sunWarm=mix(vec3(1.0,.66,.35),vec3(1.0,.95,.78),smoothstep(6.0,42.0,uSolarAltitude));
      polluted+=sunWarm*(sunDisc*1.25+sunGlow*.28)*sunVisibility;

      float haze=pow(horizon,2.15)*pollution*(.22+.38*uHumidity);
      polluted=mix(polluted,vec3(.64,.59,.54),haze);

      float rainAmount=clamp(uRain/6.0,0.,1.)*uWeatherKnown;
      if(rainAmount>0.001){
        vec2 ruv=uv*vec2(58.0,22.0);
        ruv.x+=uTime*1.7+ruv.y*.42;
        float streak=step(.965,hash(floor(ruv)))*smoothstep(.88,.1,fract(ruv.y));
        polluted+=vec3(.72,.79,.84)*streak*rainAmount*.45;
        polluted=mix(polluted,vec3(.25,.27,.31),rainAmount*.14);
      }

      float vignette=smoothstep(1.08,.28,distance(uv,vec2(.5,.48)));
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
  state.air = readAir();
  const pollution = pollutionStrength(state.air.pm25);
  const alt = state.solar.altitude;
  const az = state.solar.azimuth * Math.PI / 180;
  const sunX = clamp(0.5 - Math.sin(az) * 0.42, 0.06, 0.94);
  const sunY = clamp(0.82 - clamp(alt / 90, 0, 1) * 0.62, 0.12, 0.86);
  const speed = clamp(state.weather.windSpeedKmh / 30, 0.02, 1);
  const dir = state.weather.windDirectionDeg * Math.PI / 180;

  uniforms.uSun.value.set(sunX, sunY);
  uniforms.uSolarAltitude.value = alt;
  uniforms.uPollution.value = pollution;
  uniforms.uCloud.value = state.weather.cloudCover;
  uniforms.uRain.value = state.weather.precipitationMm;
  uniforms.uHumidity.value = state.weather.humidity;
  uniforms.uVisibilityKm.value = Number.isFinite(state.weather.visibilityKm) ? state.weather.visibilityKm : 20;
  uniforms.uWind.value.set(Math.sin(dir) * speed, -Math.cos(dir) * speed);
  uniforms.uWeatherKnown.value = state.weather.known ? 1 : 0;
  document.body.dataset.environmentWeather = state.weather.known ? 'live' : 'unavailable';
  document.body.dataset.environmentAir = Number.isFinite(state.air.pm25) ? 'live' : 'loading';
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
    `pm2.5: ${state.air.pm25 ?? '—'} / AQI: ${state.air.aqi ?? '—'}`,
    `pollution shader: ${(uniforms.uPollution.value * 100).toFixed(0)}%`,
    `weather: ${w.known ? (w.cached ? 'CACHED' : 'LIVE') : 'provider pending'}`,
    w.known ? `temp ${Math.round(w.temperatureC)}° · cloud ${Math.round(w.cloudCover * 100)}% · rain ${w.precipitationMm.toFixed(1)} mm · RH ${Math.round(w.humidity * 100)}% · vis ${w.visibilityKm.toFixed(1)} km` : 'cloud/rain deliberately not inferred',
    `renderer: ${reducedMotion ? 'static/reduced motion' : '30 fps adaptive'}`
  ].join('\n');
}

let visible = true;
let pageVisible = !document.hidden;
let raf = 0;
let lastFrame = 0;
const start = performance.now();

function render(now) {
  raf = 0;
  if (!visible || !pageVisible) return;
  if (!reducedMotion && now - lastFrame < 32) {
    raf = requestAnimationFrame(render);
    return;
  }
  lastFrame = now;
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
