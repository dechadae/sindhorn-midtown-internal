const SVG_NS='http://www.w3.org/2000/svg';
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const num=(id,fallback=0)=>{const el=document.getElementById(id);const n=Number(el?.value);return Number.isFinite(n)?n:fallback};

/*
  Atmosphere Tester celestial cleanup.

  The tester shader already renders the correct sun/moon atmospheric glow.
  A separate SVG eclipse layer previously rendered a second, vertically mirrored
  dark disc. That duplicate celestial layer is intentionally removed.

  Keep this module only for the approved wet-glass reflection calibration below.
*/
const CELESTIAL_OVERLAY_REMOVED=true;

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
