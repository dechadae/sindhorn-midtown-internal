from pathlib import Path
import re

index = Path('site/index.html')
s = index.read_text()
if 'id="weatherNow"' not in s:
    needle = '    <p class="intro-copy">PM2.5 + Thai AQI near Sindhorn Midtown. <span lang="th">ค่าฝุ่นล่าสุดใกล้<span class="hotel-name">สินธร&nbsp;มิดทาวน์</span></span></p>\n'
    block = needle + '''    <div class="weather-now" id="weatherNow" hidden aria-live="polite">
      <div class="weather-primary">
        <span class="weather-temp" id="weatherTemp">—°</span>
        <span class="weather-condition"><strong id="weatherConditionEn">Current weather</strong><span lang="th" id="weatherConditionTh">สภาพอากาศขณะนี้</span></span>
      </div>
      <p class="weather-meta"><span id="weatherMetaEn">Loading weather</span><span lang="th" id="weatherMetaTh">กำลังโหลดข้อมูลอากาศ</span></p>
      <a class="weather-credit" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Weather data by Open-Meteo.com</a>
    </div>
'''
    if needle not in s:
        raise SystemExit('intro insertion point missing')
    s = s.replace(needle, block, 1)
    index.write_text(s)

css = Path('site/environment.css')
c = css.read_text()
if 'Current weather readout v1' not in c:
    c += '''
/* Current weather readout v1 — information, not another panel. */
body.environment-ready .weather-now{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-areas:"primary primary" "meta credit";align-items:end;column-gap:22px;row-gap:6px;max-width:660px;margin:23px 0 2px;color:var(--blossom-soft)}
body.environment-ready .weather-now[hidden]{display:none!important}
.weather-primary{grid-area:primary;display:flex;align-items:center;gap:15px}
.weather-temp{font-size:clamp(2.2rem,5vw,3.3rem);font-weight:200;line-height:.9;letter-spacing:-.035em;font-variant-numeric:tabular-nums}
.weather-condition{display:flex;flex-direction:column;gap:1px;line-height:1.25}
.weather-condition strong{font-size:.82rem;font-weight:600;letter-spacing:.105em;text-transform:uppercase}
.weather-condition span{font-size:.96rem;font-weight:300}
.weather-meta{grid-area:meta;margin:0;color:rgba(250,247,245,.75);font-size:.73rem;line-height:1.45}
.weather-meta span{display:block}
.weather-meta span[lang="th"]{margin-top:1px;font-size:1.04em}
.weather-credit{grid-area:credit;justify-self:end;align-self:end;color:rgba(250,247,245,.55)!important;font-size:.59rem;font-weight:400!important;letter-spacing:.02em;text-decoration:none;white-space:nowrap}
.weather-credit:hover{text-decoration:underline}
@media (max-width:699px){
  body.environment-ready .weather-now{grid-template-columns:1fr;grid-template-areas:"primary" "meta" "credit";gap:5px;margin:14px 0 5px}
  .weather-primary{gap:11px}.weather-temp{font-size:2.15rem}.weather-condition strong{font-size:.72rem}.weather-condition span{font-size:.88rem}
  .weather-meta{font-size:.70rem}.weather-credit{justify-self:start;font-size:.56rem;margin-top:1px}
}
'''
    css.write_text(c)

js = Path('site/environment.js')
j = js.read_text()
j = j.replace(
    "const WEATHER_ENDPOINT = '/api/weather';",
    "const WEATHER_ENDPOINT = 'https://api.open-meteo.com/v1/forecast?latitude=13.74135&longitude=100.54274&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,is_day&timezone=Asia%2FBangkok';\nconst WEATHER_CACHE_KEY = 'sindhorn-midtown:weather:v1';\nconst WEATHER_CACHE_MAX_AGE = 45 * 60 * 1000;"
)

if "const weatherNow = document.getElementById('weatherNow');" not in j:
    j = j.replace(
        "const aqiEl = document.getElementById('aqiValue');",
        "const aqiEl = document.getElementById('aqiValue');\nconst weatherNow = document.getElementById('weatherNow');\nconst weatherTemp = document.getElementById('weatherTemp');\nconst weatherConditionEn = document.getElementById('weatherConditionEn');\nconst weatherConditionTh = document.getElementById('weatherConditionTh');\nconst weatherMetaEn = document.getElementById('weatherMetaEn');\nconst weatherMetaTh = document.getElementById('weatherMetaTh');"
    )

helpers = '''
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
'''
if 'function weatherLabel(code)' not in j:
    j = j.replace('const state = {', helpers + '\nconst state = {', 1)

j = re.sub(
    r'  weather: \{\n    known: false,[\s\S]*?    observedAt: null\n  \},',
    '''  weather: {
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
  },''',
    j,
    count=1
)

fetch_fn = '''async function fetchWeather() {
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
}'''
j, count = re.subn(
    r'async function fetchWeather\(\) \{[\s\S]*?\n\}\n\nconst renderer',
    fetch_fn + '\n\nconst renderer',
    j,
    count=1
)
if count != 1:
    raise SystemExit('fetchWeather replacement failed')

if 'uVisibilityKm:' not in j:
    j = j.replace("  uHumidity: { value: 0.68 },", "  uHumidity: { value: 0.68 },\n  uVisibilityKm: { value: 20 },")
    j = j.replace("    uniform float uHumidity;", "    uniform float uHumidity;\n    uniform float uVisibilityKm;")
    j = j.replace(
        "      float cloudiness=uCloud*uWeatherKnown;",
        "      float weatherFog=uWeatherKnown*(1.0-smoothstep(2.0,18.0,uVisibilityKm));\n      polluted=mix(polluted,vec3(.63,.63,.64),weatherFog*pow(horizon,.8)*.58);\n\n      float cloudiness=uCloud*uWeatherKnown;"
    )
    j = j.replace(
        "  uniforms.uHumidity.value = state.weather.humidity;",
        "  uniforms.uHumidity.value = state.weather.humidity;\n  uniforms.uVisibilityKm.value = Number.isFinite(state.weather.visibilityKm) ? state.weather.visibilityKm : 20;"
    )

j = j.replace(
    "    `weather: ${w.known ? 'LIVE' : 'provider pending'}`,",
    "    `weather: ${w.known ? (w.cached ? 'CACHED' : 'LIVE') : 'provider pending'}`,"
)
j = j.replace(
    "    w.known ? `cloud ${Math.round(w.cloudCover * 100)}% · rain ${w.precipitationMm.toFixed(1)} mm · RH ${Math.round(w.humidity * 100)}%` : 'cloud/rain deliberately not inferred',",
    "    w.known ? `temp ${Math.round(w.temperatureC)}° · cloud ${Math.round(w.cloudCover * 100)}% · rain ${w.precipitationMm.toFixed(1)} mm · RH ${Math.round(w.humidity * 100)}% · vis ${w.visibilityKm.toFixed(1)} km` : 'cloud/rain deliberately not inferred',"
)
js.write_text(j)
