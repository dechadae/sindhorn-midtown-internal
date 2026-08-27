const sourceUrl=new URL('./volumetric-weather-final.js',import.meta.url);sourceUrl.searchParams.set('tune','ios-weather-compositor-v8');const seasonalUrl=new URL('./seasonal-sky.js',import.meta.url).href;let source=await fetch(sourceUrl,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`base renderer ${r.status}`);return r.text()});source=source.replace("from './seasonal-sky.js'",`from '${seasonalUrl}'`);

// iOS-Weather-style cloud compositor: real Bangkok palette underneath, art-directed 2.5D animation above.
const shaderStart=source.indexOf('const VOLUME_FS=`');const shaderEnd=source.indexOf('const COMPOSITE_FS=`',shaderStart);if(shaderStart<0||shaderEnd<0)throw new Error('iOS compositor shader contract missing');
const iosCloudShader=`const VOLUME_FS=\`#version 300 es
precision highp float;precision highp sampler3D;in vec2 vUv;out vec4 outColor;
uniform sampler3D uBaseNoise,uErosionNoise;uniform sampler2D uWeatherTex;uniform vec2 uResolution,uWind;uniform vec3 uSunDir,uCloudAmbient,uCloudWarm,uCloudBase,uLightningPos;uniform float uTime,uCoverage,uDensity,uErosion,uVerticalBuild,uConnected,uBaseDarkness,uPhaseG,uStorm,uLightningFlash;uniform int uSteps;
float sat(float x){return clamp(x,0.,1.);} 
float cloudNoise(vec2 uv,float z,float scale){vec2 p=vec2(uv.x*scale,uv.y*scale*2.15);float a=texture(uBaseNoise,vec3(p,z)).r;float b=texture(uBaseNoise,vec3(p*1.92+vec2(.19,.31),z+.23)).g;float c=texture(uBaseNoise,vec3(p*3.55+vec2(.47,.07),z+.51)).b;return a*.58+b*.29+c*.13;}
float coverNoise(vec2 uv,float z,float speed){vec2 d=uWind*speed;float w=texture(uWeatherTex,vec2(uv.x*.92+d.x,uv.y*.32+d.y+z)).r;float n=texture(uBaseNoise,vec3(uv.x*.86+d.x,uv.y*.26+d.y,z+.17)).a;return w*.60+n*.40;}
vec4 cloudLayer(vec2 uv,float center,float halfH,float scale,float speed,float opacity,float z,float depth){
 float storm=uStorm,build=uVerticalBuild;
 float n=cloudNoise(uv+uWind*speed,z,scale);float nTop=cloudNoise(uv+uWind*speed*.82+vec2(.13,.04),z+.37,scale*.82);float cov=coverNoise(uv,z,speed*.48);
 float coverThreshold=mix(.78,.34,uCoverage)-uConnected*.22+depth*.035;float gate=smoothstep(coverThreshold-.075,coverThreshold+.075,cov);
 gate=mix(gate,1.,sat(uConnected*(.72-depth*.12)));
 float base=center-halfH+(n-.5)*mix(.028,.014,storm);float top=center+halfH+(nTop-.5)*(.16+.24*build)+storm*.055;
 float lower=smoothstep(base-.030,base+.018,uv.y);float upper=1.-smoothstep(top-.050,top+.075,uv.y);float body=lower*upper;
 float er=texture(uErosionNoise,vec3(uv.x*scale*3.6+uWind.x*speed,uv.y*scale*5.2+uWind.y*speed,z+.61)).r;
 float edgeBand=1.-smoothstep(.03,.15,min(abs(uv.y-base),abs(uv.y-top)));body*=mix(1.,smoothstep(.25,.67,er),uErosion*.42*edgeBand);
 float alpha=body*gate*opacity*sat(uCoverage*1.30)*mix(.82,1.08,uDensity);float rel=sat((uv.y-base)/max(.05,top-base));
 float baseLight=mix(.28,1.,pow(rel,.72));baseLight*=mix(1.,.50,uBaseDarkness*(1.-rel));baseLight*=mix(1.,.72,storm*(1.-rel*.35));
 vec3 color=mix(uCloudBase,uCloudAmbient,sat(.18+baseLight*.82));float sunWarm=sat(1.-abs(uSunDir.y));float rim=smoothstep(.66,.98,rel)*sunWarm*(.08+.12*sat(uSunDir.x*.5+.5));color=mix(color,uCloudWarm,rim);
 float flash=uLightningFlash*exp(-length(vec2(uv.x-.56,uv.y-.52))*5.2);color+=vec3(.58,.70,1.)*flash*(.20+.38*alpha);
 return vec4(color,sat(alpha));
}
void over(inout vec3 rgb,inout float a,vec4 l){float w=l.a*(1.-a);rgb+=l.rgb*w;a+=w;}
void main(){vec2 uv=vUv;float storm=sat(uStorm),conn=sat(uConnected);
 vec4 farL=cloudLayer(uv,.76,.10+.045*uVerticalBuild,1.45,.20,.34+.18*conn,.13,.85);
 vec4 mainL=cloudLayer(uv,.53-.025*storm,.145+.105*uVerticalBuild+.075*storm,1.05,.44,.78+.20*conn,.47,.35);
 vec4 nearL=cloudLayer(uv,.28-.015*storm,.105+.070*uVerticalBuild+.060*storm,.78,.70,.55+.30*conn,.79,.08);
 vec3 rgb=vec3(0.);float a=0.;over(rgb,a,farL);over(rgb,a,mainL);over(rgb,a,nearL);
 if(a>.001)rgb/=a;outColor=vec4(rgb,a);
}\`;\n`;
source=source.slice(0,shaderStart)+iosCloudShader+source.slice(shaderEnd);

// Raise the cloud pass resolution now that the expensive ray marcher is gone.
source=source.replace("const QUALITY={economy:{steps:8,scale:.24},balanced:{steps:10,scale:.30},high:{steps:12,scale:.36}};","const QUALITY={economy:{steps:3,scale:.42},balanced:{steps:3,scale:.50},high:{steps:3,scale:.62}};");

// Keep the approved rain / wet-window refinements, including correct gravity orientation.
const wetStart=source.indexOf('function updateWetness(dt){');const wetEnd=source.indexOf('\nupdateWetness(16);',wetStart);if(wetStart<0||wetEnd<0)throw new Error('iOS compositor wet-glass contract missing');const wet=`function updateWetness(dt){
 wetCtx.fillStyle='rgba(0,0,0,.20)';wetCtx.fillRect(0,0,256,256);
 if(state.windowRain>.005){
  const target=Math.round(18+state.windowRain*112);
  while(drops.length<target){const i=drops.length,r=hash3i(i,7,state.seed&255,state.seed),r2=hash3i(i,11,5,state.seed^0x9e3779b9);drops.push({x:hash3i(i,3,1,state.seed)*256,y:hash3i(i,5,2,state.seed)*256,r:1.15+r*2.8+(r2>.88?r2*2.6:0),vy:.08+r*.34,trail:r<state.trickleRate*.24,phase:r*6.28})}
  if(drops.length>target)drops.length=target;wetCtx.globalCompositeOperation='lighter';
  for(const d of drops){d.y+=d.vy*dt*.038*(.55+state.trickleRate);d.x+=Math.sin(d.phase+d.y*.022)*.006*dt;if(d.y>268){d.y=-8;d.x=(d.x*1.73+41)%256}const g=wetCtx.createRadialGradient(d.x-d.r*.16,d.y-d.r*.18,d.r*.06,d.x,d.y,d.r*1.18);g.addColorStop(0,'rgba(255,255,255,.76)');g.addColorStop(.34,'rgba(225,225,225,.46)');g.addColorStop(.72,'rgba(130,130,130,.24)');g.addColorStop(1,'rgba(0,0,0,0)');wetCtx.fillStyle=g;wetCtx.beginPath();wetCtx.arc(d.x,d.y,d.r*1.18,0,Math.PI*2);wetCtx.fill();wetCtx.strokeStyle='rgba(245,245,245,.16)';wetCtx.lineWidth=Math.max(.55,d.r*.18);wetCtx.beginPath();wetCtx.arc(d.x-d.r*.08,d.y-d.r*.08,d.r*.78,Math.PI*1.08,Math.PI*1.78);wetCtx.stroke();if(d.trail){wetCtx.strokeStyle='rgba(190,190,190,.11)';wetCtx.lineWidth=Math.max(.65,d.r*.26);wetCtx.beginPath();wetCtx.moveTo(d.x,d.y-d.r*.55);wetCtx.quadraticCurveTo(d.x+Math.sin(d.phase)*2,d.y-d.r*4.5,d.x+Math.sin(d.phase*1.7),d.y-d.r*(8+state.trickleRate*7));wetCtx.stroke()}}
  wetCtx.globalCompositeOperation='source-over'
 }else drops=[];
 gl.bindTexture(gl.TEXTURE_2D,wetTex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,wetCanvas);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false)
}`;source=source.slice(0,wetStart)+wet+source.slice(wetEnd);
source=source.replace('refractOffset=wetNormal*.0065*uWindowRain*uWindowRefraction','refractOffset=wetNormal*.0090*uWindowRain*uWindowRefraction').replace("float wetRim=sat(wet*1.2)*uWindowRain,wetSpec=sat(length(wetNormal)*7.)*uWindowRain;c+=vec3(.84,.90,.96)*(wetRim*.010+wetSpec*.028);","float wetRim=sat(wet*1.35)*uWindowRain,wetSpec=sat(length(wetNormal)*8.5)*uWindowRain;float glassSheen=uWindowRain*.018;c=mix(c,c*vec3(.985,.992,1.015),glassSheen);c+=vec3(.84,.90,.96)*(wetRim*.016+wetSpec*.040);").replace('windowRain:.46,trickleRate:.82,windowRefraction:.78','windowRain:.62,trickleRate:.82,windowRefraction:.92');
source=source.replace("document.getElementById('stepsReadout').textContent=`${q.steps} ray steps · ${Math.round(q.scale*100)}%`;","document.getElementById('stepsReadout').textContent=`3 cloud layers · ${Math.round(q.scale*100)}%`;" );
source=source.replace("renderer:'ue-inspired-webgl2-volumetric-weather-final-v2'","renderer:'ios-weather-style-bangkok-compositor-v8'");
const blob=new Blob([source],{type:'text/javascript'}),blobUrl=URL.createObjectURL(blob);try{await import(blobUrl)}catch(error){window.__volumetricWeatherFinalError=String(error?.stack||error);console.error('iOS Weather compositor bootstrap failed',error);throw error}finally{setTimeout(()=>URL.revokeObjectURL(blobUrl),10000)}