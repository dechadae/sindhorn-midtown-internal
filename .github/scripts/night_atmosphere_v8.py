from pathlib import Path

p=Path('site/environment.js')
s=p.read_text()

marker='function readAir() {'
lunar=r'''function lunarPosition(date = new Date()) {
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

'''
assert marker in s
s=s.replace(marker,lunar+marker,1)

assert '  solar: solarPosition()\n};' in s
s=s.replace('  solar: solarPosition()\n};','  solar: solarPosition(),\n  lunar: lunarPosition()\n};',1)

assert '  uSun: { value: new THREE.Vector2(0.5, 0.35) },\n  uSolarAltitude: { value: 45 },' in s
s=s.replace('  uSun: { value: new THREE.Vector2(0.5, 0.35) },\n  uSolarAltitude: { value: 45 },','  uSun: { value: new THREE.Vector2(0.5, 0.35) },\n  uSolarAltitude: { value: 45 },\n  uMoon: { value: new THREE.Vector2(0.5, 0.42) },\n  uMoonAltitude: { value: -20 },\n  uMoonPhase: { value: 0.5 },\n  uMoonIllumination: { value: 1 },',1)

assert '    uniform vec2 uSun;\n    uniform float uSolarAltitude;' in s
s=s.replace('    uniform vec2 uSun;\n    uniform float uSolarAltitude;','    uniform vec2 uSun;\n    uniform float uSolarAltitude;\n    uniform vec2 uMoon;\n    uniform float uMoonAltitude;\n    uniform float uMoonPhase;\n    uniform float uMoonIllumination;',1)

assert '      vec3 nightTop=vec3(.055,.045,.085);\n      vec3 nightHorizon=vec3(.13,.105,.17);' in s
s=s.replace('      vec3 nightTop=vec3(.055,.045,.085);\n      vec3 nightHorizon=vec3(.13,.105,.17);','      vec3 nightTop=vec3(.070,.078,.125);\n      vec3 nightHorizon=vec3(.165,.155,.205);',1)

old='''      float cloudMask=smoothstep(.49-.22*cloudiness,.82-.30*cloudiness,cloudNoise)*cloudiness;
      cloudMask*=smoothstep(.00,.18,uv.y);
      float cloudLight=mix(.86,.63,pollution*.65);
      vec3 cloudColor=mix(vec3(cloudLight),vec3(.38,.37,.40),smoothstep(.65,1.,cloudiness));
      polluted=mix(polluted,cloudColor,cloudMask*.74);'''
new='''      float cloudMask=smoothstep(.49-.22*cloudiness,.82-.30*cloudiness,cloudNoise)*cloudiness;
      float overcast=smoothstep(.70,.97,cloudiness);
      cloudMask=max(cloudMask,overcast*(.48+.42*broad));
      cloudMask*=smoothstep(.00,.18,uv.y);
      float nightness=1.0-daylight;
      float cloudLight=mix(.86,.63,pollution*.65);
      vec3 dayCloud=mix(vec3(cloudLight),vec3(.38,.37,.40),smoothstep(.65,1.,cloudiness));
      vec3 nightCloud=mix(vec3(.27,.29,.36),vec3(.18,.19,.25),pollution*.55);
      vec3 cloudColor=mix(dayCloud,nightCloud,nightness);
      float cloudOpacity=mix(.72,.91,nightness);
      polluted=mix(polluted,cloudColor,cloudMask*cloudOpacity);'''
assert old in s
s=s.replace(old,new,1)

sun_end='''      polluted+=sunWarm*(sunDisc*1.25+sunGlow*.28)*sunVisibility;

      float haze='''
moon=r'''      polluted+=sunWarm*(sunDisc*1.25+sunGlow*.28)*sunVisibility;

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
      float cloudTransmission=mix(1.0,.18,cloudMask);
      float moonPollution=mix(1.0,.58,pollution);
      float moonVisible=moonAbove*moonPollution;
      vec3 moonColor=vec3(.96,.94,.83);
      polluted+=moonColor*moonDisc*moonLit*moonVisible*cloudTransmission*1.35;
      float moonGlow=exp(-moonDist*mix(32.0,14.0,cloudMask+.55*pollution));
      polluted+=vec3(.34,.37,.48)*moonGlow*moonAbove*uMoonIllumination*mix(.12,.44,cloudMask)*moonPollution;

      float haze='''
assert sun_end in s
s=s.replace(sun_end,moon,1)

assert '  state.solar = solarPosition();\n  state.air = readAir();' in s
s=s.replace('  state.solar = solarPosition();\n  state.air = readAir();','  state.solar = solarPosition();\n  state.lunar = lunarPosition();\n  state.air = readAir();',1)

assert '  const speed = clamp(state.weather.windSpeedKmh / 30, 0.02, 1);' in s
s=s.replace('  const speed = clamp(state.weather.windSpeedKmh / 30, 0.02, 1);','  const moonAlt = state.lunar.altitude;\n  const moonAz = state.lunar.azimuth * Math.PI / 180;\n  const moonX = clamp(0.5 - Math.sin(moonAz) * 0.42, 0.06, 0.94);\n  const moonY = clamp(0.82 - clamp(moonAlt / 90, 0, 1) * 0.62, 0.12, 0.86);\n  const speed = clamp(state.weather.windSpeedKmh / 30, 0.02, 1);',1)

assert '  uniforms.uSolarAltitude.value = alt;\n  uniforms.uPollution.value = pollution;' in s
s=s.replace('  uniforms.uSolarAltitude.value = alt;\n  uniforms.uPollution.value = pollution;','  uniforms.uSolarAltitude.value = alt;\n  uniforms.uMoon.value.set(moonX, moonY);\n  uniforms.uMoonAltitude.value = moonAlt;\n  uniforms.uMoonPhase.value = state.lunar.phase;\n  uniforms.uMoonIllumination.value = state.lunar.illumination;\n  uniforms.uPollution.value = pollution;',1)

assert "  document.body.dataset.environmentAir = Number.isFinite(state.air.pm25) ? 'live' : 'loading';" in s
s=s.replace("  document.body.dataset.environmentAir = Number.isFinite(state.air.pm25) ? 'live' : 'loading';","  document.body.dataset.environmentAir = Number.isFinite(state.air.pm25) ? 'live' : 'loading';\n  document.body.dataset.environmentMoonAltitude = moonAlt.toFixed(1);\n  document.body.dataset.environmentMoonIllumination = state.lunar.illumination.toFixed(2);\n  document.body.dataset.environmentCloud = state.weather.known ? state.weather.cloudCover.toFixed(2) : 'unknown';",1)

needle="    `sun: ${state.solar.altitude.toFixed(1)}° alt / ${state.solar.azimuth.toFixed(1)}° az`,"
assert needle in s
s=s.replace(needle,needle+"\n    `moon: ${state.lunar.altitude.toFixed(1)}° alt / ${state.lunar.azimuth.toFixed(1)}° az · ${(state.lunar.illumination*100).toFixed(0)}% lit`,",1)

p.write_text(s)

p=Path('site/sw.js')
s=p.read_text()
assert 'sindhorn-midtown-internal-pwa-v7' in s
p.write_text(s.replace('sindhorn-midtown-internal-pwa-v7','sindhorn-midtown-internal-pwa-v8',1))

Path('site/version.txt').write_text(
  'production-build: main\n'
  'rendering-fix: night-atmosphere-v8-moon-clouds\n'
  'renderer: display-synced-adaptive-resolution\n'
  'pwa-spa: fullscreen-top-header-frosted-save-v8\n'
)
