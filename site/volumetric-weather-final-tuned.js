const sourceUrl=new URL('./volumetric-weather-final.js',import.meta.url);sourceUrl.searchParams.set('tune','broad-banks-wet-glass-v6');const seasonalUrl=new URL('./seasonal-sky.js',import.meta.url).href;let source=await fetch(sourceUrl,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`base renderer ${r.status}`);return r.text()});source=source.replace("from './seasonal-sky.js'",`from '${seasonalUrl}'`);
const densityStart=source.indexOf('float densityAt(vec3 p,float skyY){');const densityEnd=source.indexOf('\nvoid main(){',densityStart);if(densityStart<0||densityEnd<0)throw new Error('v6 density contract missing');const density=`float densityAt(vec3 p,vec2 screenUv){
 float h=sat((p.y-.72)/2.05),bottom=smoothstep(.015,.10,h),top=mix(.46,.97,uVerticalBuild),upper=1.-smoothstep(top,min(1.,top+.16),h),vertical=bottom*upper;
 vec3 q=vec3(p.x*.120+uWind.x,p.z*.095+uWind.y,h*.60+uTime*.00012);
 float n0=texture(uBaseNoise,q).r,n1=texture(uBaseNoise,q*1.93+vec3(.31,.11,.43)).g,n2=texture(uBaseNoise,q*3.85+vec3(.07,.53,.21)).b;
 float broad=n0*.55+n1*.30+n2*.15;
 float w0=texture(uWeatherTex,vec2(screenUv.x*.18,screenUv.y*.30)+uWind*.22).r;
 float w1=texture(uWeatherTex,vec2(screenUv.x*.38+.21,screenUv.y*.62+.13)+uWind*.13).r;
 float bank=w0*.70+w1*.30;
 float bankThreshold=mix(.66,.36,uCoverage)-uConnected*.12;
 float bankGate=smoothstep(bankThreshold-.040,bankThreshold+.045,bank);
 bankGate=mix(bankGate,1.,sat(uConnected*.88));
 float threshold=mix(.69,.40,uCoverage)-uConnected*.07;
 float field=broad+(bank-.5)*.20+uConnected*.08;
 float edge=1.-smoothstep(.040,.16,abs(field-threshold));float er=texture(uErosionNoise,q*4.8+vec3(.19,.41,.11)).r-.5;
 field-=er*uErosion*.16*edge*(.58+.42*h);
 float d=smoothstep(threshold-.040,threshold+.040,field)*vertical*uDensity*bankGate;
 d*=mix(.82,1.18,broad);d*=mix(.98,1.04,screenUv.y);return d*sat(uCoverage*1.18);
}`;source=source.slice(0,densityStart)+density+source.slice(densityEnd);source=source.replace('float d=densityAt(p,vUv.y);','float d=densityAt(p,vUv);').replace("vec3 sq=vec3((p.x+uSunDir.x*.65)*.020+uWind.x,(p.z+uSunDir.z*.65)*.037+uWind.y,h*.52+uSunDir.y*.10);","vec3 sq=vec3((p.x+uSunDir.x*.65)*.120+uWind.x,(p.z+uSunDir.z*.65)*.095+uWind.y,h*.60+uSunDir.y*.10);");
const wetStart=source.indexOf('function updateWetness(dt){');const wetEnd=source.indexOf('\nupdateWetness(16);',wetStart);if(wetStart<0||wetEnd<0)throw new Error('v6 wet-glass contract missing');const wet=`function updateWetness(dt){
 wetCtx.fillStyle='rgba(0,0,0,.20)';wetCtx.fillRect(0,0,256,256);
 if(state.windowRain>.005){
  const target=Math.round(18+state.windowRain*112);
  while(drops.length<target){const i=drops.length,r=hash3i(i,7,state.seed&255,state.seed),r2=hash3i(i,11,5,state.seed^0x9e3779b9);drops.push({x:hash3i(i,3,1,state.seed)*256,y:hash3i(i,5,2,state.seed)*256,r:1.15+r*2.8+(r2>.88?r2*2.6:0),vy:.08+r*.34,trail:r<state.trickleRate*.24,phase:r*6.28})}
  if(drops.length>target)drops.length=target;wetCtx.globalCompositeOperation='lighter';
  for(const d of drops){d.y+=d.vy*dt*.038*(.55+state.trickleRate);d.x+=Math.sin(d.phase+d.y*.022)*.006*dt;if(d.y>268){d.y=-8;d.x=(d.x*1.73+41)%256}const g=wetCtx.createRadialGradient(d.x-d.r*.16,d.y-d.r*.18,d.r*.06,d.x,d.y,d.r*1.18);g.addColorStop(0,'rgba(255,255,255,.76)');g.addColorStop(.34,'rgba(225,225,225,.46)');g.addColorStop(.72,'rgba(130,130,130,.24)');g.addColorStop(1,'rgba(0,0,0,0)');wetCtx.fillStyle=g;wetCtx.beginPath();wetCtx.arc(d.x,d.y,d.r*1.18,0,Math.PI*2);wetCtx.fill();wetCtx.strokeStyle='rgba(245,245,245,.16)';wetCtx.lineWidth=Math.max(.55,d.r*.18);wetCtx.beginPath();wetCtx.arc(d.x-d.r*.08,d.y-d.r*.08,d.r*.78,Math.PI*1.08,Math.PI*1.78);wetCtx.stroke();if(d.trail){wetCtx.strokeStyle='rgba(190,190,190,.11)';wetCtx.lineWidth=Math.max(.65,d.r*.26);wetCtx.beginPath();wetCtx.moveTo(d.x,d.y-d.r*.55);wetCtx.quadraticCurveTo(d.x+Math.sin(d.phase)*2,d.y-d.r*4.5,d.x+Math.sin(d.phase*1.7),d.y-d.r*(8+state.trickleRate*7));wetCtx.stroke()}}
  wetCtx.globalCompositeOperation='source-over'
 }else drops=[];
 gl.bindTexture(gl.TEXTURE_2D,wetTex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,wetCanvas);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false)
}`;source=source.slice(0,wetStart)+wet+source.slice(wetEnd);source=source.replace('refractOffset=wetNormal*.0065*uWindowRain*uWindowRefraction','refractOffset=wetNormal*.0090*uWindowRain*uWindowRefraction').replace("float wetRim=sat(wet*1.2)*uWindowRain,wetSpec=sat(length(wetNormal)*7.)*uWindowRain;c+=vec3(.84,.90,.96)*(wetRim*.010+wetSpec*.028);","float wetRim=sat(wet*1.35)*uWindowRain,wetSpec=sat(length(wetNormal)*8.5)*uWindowRain;float glassSheen=uWindowRain*.018;c=mix(c,c*vec3(.985,.992,1.015),glassSheen);c+=vec3(.84,.90,.96)*(wetRim*.016+wetSpec*.040);").replace('windowRain:.46,trickleRate:.82,windowRefraction:.78','windowRain:.62,trickleRate:.82,windowRefraction:.92').replace("renderer:'ue-inspired-webgl2-volumetric-weather-final-v2'","renderer:'ue-inspired-webgl2-volumetric-weather-final-v6'");const blob=new Blob([source],{type:'text/javascript'}),blobUrl=URL.createObjectURL(blob);try{await import(blobUrl)}catch(error){window.__volumetricWeatherFinalError=String(error?.stack||error);console.error('Volumetric final bootstrap failed',error);throw error}finally{setTimeout(()=>URL.revokeObjectURL(blobUrl),10000)}