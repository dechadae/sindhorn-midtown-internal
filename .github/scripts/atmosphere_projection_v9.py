from pathlib import Path
p=Path('site/environment.js')
s=p.read_text()

old='''      float cloudMask=smoothstep(.49-.22*cloudiness,.82-.30*cloudiness,cloudNoise)*cloudiness;
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
new='''      float cloudMask=smoothstep(.49-.22*cloudiness,.82-.30*cloudiness,cloudNoise)*cloudiness;
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
      polluted+=vec3(.12,.075,.14)*urbanGlow;'''
assert old in s
s=s.replace(old,new,1)

old='''      float cloudTransmission=mix(1.0,.18,cloudMask);
      float moonPollution=mix(1.0,.58,pollution);
      float moonVisible=moonAbove*moonPollution;
      vec3 moonColor=vec3(.96,.94,.83);
      polluted+=moonColor*moonDisc*moonLit*moonVisible*cloudTransmission*1.35;
      float moonGlow=exp(-moonDist*mix(32.0,14.0,cloudMask+.55*pollution));
      polluted+=vec3(.34,.37,.48)*moonGlow*moonAbove*uMoonIllumination*mix(.12,.44,cloudMask)*moonPollution;'''
new='''      float denseCloud=smoothstep(.48,.92,cloudMask);
      float moonDiscTransmission=mix(1.0,.025,denseCloud);
      float moonPollution=mix(1.0,.58,pollution);
      float moonVisible=moonAbove*moonPollution;
      vec3 moonColor=vec3(.96,.94,.83);
      polluted+=moonColor*moonDisc*moonLit*moonVisible*moonDiscTransmission*1.28;
      float moonGlow=exp(-moonDist*mix(32.0,12.0,denseCloud+.50*pollution));
      polluted+=vec3(.34,.37,.48)*moonGlow*moonAbove*uMoonIllumination*mix(.08,.31,denseCloud)*moonPollution;'''
assert old in s
s=s.replace(old,new,1)

old='''  const sunX = clamp(0.5 - Math.sin(az) * 0.42, 0.06, 0.94);
  const sunY = clamp(0.82 - clamp(alt / 90, 0, 1) * 0.62, 0.12, 0.86);
  const moonAlt = state.lunar.altitude;
  const moonAz = state.lunar.azimuth * Math.PI / 180;
  const moonX = clamp(0.5 - Math.sin(moonAz) * 0.42, 0.06, 0.94);
  const moonY = clamp(0.82 - clamp(moonAlt / 90, 0, 1) * 0.62, 0.12, 0.86);'''
new='''  const skyY = altitude => clamp(0.12 + clamp((altitude + 2) / 82, 0, 1) * 0.72, 0.08, 0.88);
  const sunX = clamp(0.5 - Math.sin(az) * 0.42, 0.06, 0.94);
  const sunY = skyY(alt);
  const moonAlt = state.lunar.altitude;
  const moonAz = state.lunar.azimuth * Math.PI / 180;
  const moonX = clamp(0.5 - Math.sin(moonAz) * 0.42, 0.06, 0.94);
  const moonY = skyY(moonAlt);'''
assert old in s
s=s.replace(old,new,1)

old="""  document.body.dataset.environmentCloud = state.weather.known ? state.weather.cloudCover.toFixed(2) : 'unknown';"""
new="""  document.body.dataset.environmentCloud = state.weather.known ? state.weather.cloudCover.toFixed(2) : 'unknown';
  document.body.dataset.environmentSunY = sunY.toFixed(3);
  document.body.dataset.environmentMoonY = moonY.toFixed(3);"""
assert old in s
s=s.replace(old,new,1)

p.write_text(s)
p=Path('site/sw.js')
s=p.read_text()
assert 'sindhorn-midtown-internal-pwa-v8' in s
p.write_text(s.replace('sindhorn-midtown-internal-pwa-v8','sindhorn-midtown-internal-pwa-v9',1))
Path('site/version.txt').write_text('production-build: main\nrendering-fix: atmosphere-projection-v9\nrenderer: display-synced-adaptive-resolution\npwa-spa: fullscreen-top-header-frosted-save-v9\n')
