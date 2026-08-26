const SVG_NS='http://www.w3.org/2000/svg';
const CELESTIAL_IDS=['moonEclipse'];
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const num=(id,fallback=0)=>{const el=document.getElementById(id);const n=Number(el?.value);return Number.isFinite(n)?n:fallback};

const stage=document.getElementById('environmentStage');
if(stage){
  const svg=document.createElementNS(SVG_NS,'svg');
  svg.id='testerCelestials';
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('preserveAspectRatio','none');
  Object.assign(svg.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'2',pointerEvents:'none',overflow:'hidden'});

  const defs=document.createElementNS(SVG_NS,'defs');
  defs.innerHTML=`
    <filter id="moonCorona" x="-300%" y="-300%" width="700%" height="700%">
      <feGaussianBlur stdDeviation="7"/>
    </filter>
    <filter id="moonHalo" x="-300%" y="-300%" width="700%" height="700%">
      <feGaussianBlur stdDeviation="21"/>
    </filter>
    <radialGradient id="moonHaloGradient">
      <stop offset="0%" stop-color="#f7fbff" stop-opacity=".55"/>
      <stop offset="24%" stop-color="#dfeaff" stop-opacity=".27"/>
      <stop offset="58%" stop-color="#a9c7ff" stop-opacity=".10"/>
      <stop offset="100%" stop-color="#a9c7ff" stop-opacity="0"/>
    </radialGradient>`;
  svg.appendChild(defs);

  const makeMoon=()=>{
    const g=document.createElementNS(SVG_NS,'g');
    g.id='moonEclipse';
    const halo=document.createElementNS(SVG_NS,'circle');
    halo.setAttribute('r','64');
    halo.setAttribute('fill','url(#moonHaloGradient)');
    halo.setAttribute('filter','url(#moonHalo)');
    const corona=document.createElementNS(SVG_NS,'circle');
    corona.setAttribute('r','28');
    corona.setAttribute('fill','none');
    corona.setAttribute('stroke','rgba(226,238,255,.82)');
    corona.setAttribute('stroke-width','9');
    corona.setAttribute('filter','url(#moonCorona)');
    const rim=document.createElementNS(SVG_NS,'circle');
    rim.setAttribute('r','15');
    rim.setAttribute('fill','none');
    rim.setAttribute('stroke','rgba(239,246,255,.96)');
    rim.setAttribute('stroke-width','2.2');
    const innerRim=document.createElementNS(SVG_NS,'circle');
    innerRim.setAttribute('r','13.7');
    innerRim.setAttribute('fill','none');
    innerRim.setAttribute('stroke','rgba(157,195,255,.46)');
    innerRim.setAttribute('stroke-width','1');
    const core=document.createElementNS(SVG_NS,'circle');
    core.setAttribute('r','13.2');
    core.setAttribute('fill','rgba(7,11,18,.96)');
    const earthshine=document.createElementNS(SVG_NS,'circle');
    earthshine.setAttribute('r','11.6');
    earthshine.setAttribute('fill','rgba(68,90,126,.12)');
    g.append(halo,corona,rim,innerRim,core,earthshine);
    svg.appendChild(g);
    return {g,halo,corona,rim,innerRim,core,earthshine};
  };

  const moon=makeMoon();
  stage.appendChild(svg);

  let width=1,height=1,raf=0;
  const resize=()=>{
    const rect=stage.getBoundingClientRect();
    width=Math.max(1,rect.width||innerWidth||1);
    height=Math.max(1,rect.height||innerHeight||1);
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  };

  const visibilityFactors=()=>{
    const cloud=num('cloudCover',0)/100;
    const fog=num('fog',0)/100;
    const storm=num('stormDarkness',0)/100;
    const visibility=num('visibility',30);
    const pm=clamp(num('pm25',0)/220);
    const dust=num('dust',0)/100;
    const smoke=num('smoke',0)/100;
    const clearSky=clamp((42-cloud*100)/42);
    const optical=clearSky*(1-fog*.88)*(1-storm*.82)*clamp((visibility-.4)/12)*(1-pm*.62-dust*.34-smoke*.52);
    const diffuse=clamp((1-storm*.72)*(1-fog*.70)*clamp((visibility-.2)/8)*(1-pm*.42-dust*.24-smoke*.36));
    return {clear:clamp(optical),diffuse:clamp(diffuse),cloud};
  };

  const place=(obj,x,y,scale,sharp,diffuse,time)=>{
    obj.g.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(3)})`);
    const breathe=1+Math.sin(time*.27)*0.018;
    obj.halo.setAttribute('r',String(64*breathe));
    obj.g.style.opacity=String(clamp(.04+diffuse*.44+sharp*.70));
    obj.rim.style.opacity=String(clamp(sharp*1.08));
    obj.innerRim.style.opacity=String(clamp(sharp*.82));
    obj.core.style.opacity=String(clamp(sharp*.96));
    obj.earthshine.style.opacity=String(clamp(sharp*.42));
    obj.corona.style.opacity=String(clamp(.10+diffuse*.30+sharp*.62));
    obj.halo.style.opacity=String(clamp(.08+diffuse*.40+sharp*.34));
  };

  const frame=(now)=>{
    raf=requestAnimationFrame(frame);
    const solar=num('solarAltitude',38);
    const {clear,diffuse,cloud}=visibilityFactors();
    const baseScale=clamp((Math.min(width,height)/690),.72,1.28);
    const moonVisible=clamp((-solar-1)/8);

    if(moonVisible>.01){
      const moonAltitude=clamp((-solar-2)/22);
      const moonY=(.18+moonAltitude*.52)*height;
      const moonX=.28*width;
      const sharp=moonVisible*clear*clamp((38-cloud*100)/38);
      const diff=moonVisible*diffuse;
      place(moon,moonX,moonY,baseScale*.92,sharp,diff,now/1000);
      moon.g.style.display='block';
    }else moon.g.style.display='none';
  };

  resize();
  if('ResizeObserver'in window)new ResizeObserver(resize).observe(stage);
  addEventListener('resize',resize,{passive:true});
  raf=requestAnimationFrame(frame);
}

/* Tester wet-glass visibility calibration.
   Geometry, brightness and opacity remain unchanged here; this adds directional
   specular reflection so pane droplets read as water catching light. */
if(location.pathname.includes('atmosphere-tester')){
  let rainPaneRaf=0;
  let reflectionReady=false;

  const ensureReflectionFilter=(pane)=>{
    if(reflectionReady||pane.querySelector('#testerWetReflection'))return;
    const defs=pane.querySelector('defs');
    if(!defs)return;
    const filter=document.createElementNS(SVG_NS,'filter');
    filter.id='testerWetReflection';
    filter.setAttribute('x','-70%');
    filter.setAttribute('y','-70%');
    filter.setAttribute('width','240%');
    filter.setAttribute('height','240%');
    filter.innerHTML=`
      <feGaussianBlur in="SourceAlpha" stdDeviation="0.75" result="softAlpha"/>
      <feSpecularLighting in="softAlpha" surfaceScale="5.2" specularConstant="1.15" specularExponent="28" lighting-color="#ffffff" result="specular">
        <feDistantLight azimuth="315" elevation="58"/>
      </feSpecularLighting>
      <feComposite in="specular" in2="SourceAlpha" operator="in" result="clippedSpecular"/>
      <feGaussianBlur in="clippedSpecular" stdDeviation="0.22" result="softSpecular"/>
      <feMerge>
        <feMergeNode in="SourceGraphic"/>
        <feMergeNode in="softSpecular"/>
      </feMerge>`;
    defs.appendChild(filter);
    reflectionReady=true;
  };

  const wetGlassFrame=()=>{
    rainPaneRaf=requestAnimationFrame(wetGlassFrame);
    const pane=document.getElementById('rainPaneSvg');
    if(!pane)return;
    const rain=clamp(num('rain',0)/100);
    const enabled=document.getElementById('paneDrops')?.checked!==false;
    if(!enabled||rain<.005){
      pane.style.setProperty('opacity','0','important');
      return;
    }

    ensureReflectionFilter(pane);
    pane.style.setProperty('opacity','1','important');
    pane.style.filter='brightness(1.58) contrast(1.10) saturate(.04) drop-shadow(0 0 1.6px rgba(255,255,255,.42))';

    const beads=[...pane.querySelectorAll('#rainPaneBeads path')];
    const beadCount=Math.min(beads.length,Math.round(28+rain*24));
    beads.forEach((bead,i)=>{
      if(i<beadCount){
        const variation=.90+((i*37)%17)/80;
        bead.style.setProperty('opacity',String(Math.min(.98,(.56+rain*.30)*variation)),'important');
        bead.setAttribute('fill','rgba(255,255,255,.24)');
        bead.setAttribute('stroke','rgba(255,255,255,.72)');
        bead.setAttribute('stroke-width','.52');
        bead.setAttribute('filter','url(#testerWetReflection)');
      }else bead.style.setProperty('opacity','0','important');
    });

    const drops=[...pane.querySelectorAll('[data-rain-drop]')];
    drops.forEach((drop,i)=>{
      if(!drop.hasAttribute('transform'))return;
      const variation=.92+((i*29)%13)/90;
      drop.style.setProperty('opacity',String(Math.min(1,(.78+rain*.20)*variation)),'important');
      drop.style.filter='drop-shadow(0 0 1.8px rgba(255,255,255,.66)) drop-shadow(0 2px 2px rgba(20,30,38,.06))';
      const children=drop.children;
      if(children[0]){
        children[0].setAttribute('stroke','rgba(255,255,255,.62)');
        children[0].style.setProperty('opacity',String(.42+rain*.30),'important');
      }
      if(children[1])children[1].setAttribute('stroke','rgba(28,38,46,.08)');
      if(children[2]){
        children[2].setAttribute('fill','rgba(255,255,255,.22)');
        children[2].setAttribute('stroke','rgba(255,255,255,.78)');
        children[2].setAttribute('stroke-width','.72');
        children[2].setAttribute('filter','url(#testerWetReflection)');
      }
      if(children[3]){
        children[3].setAttribute('stroke','rgba(255,255,255,.98)');
        children[3].setAttribute('stroke-width','1.05');
      }
    });
  };
  rainPaneRaf=requestAnimationFrame(wetGlassFrame);
}
