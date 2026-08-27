const sourceUrl=new URL('./volumetric-weather-final.js',import.meta.url);sourceUrl.searchParams.set('tune','ios-weather-compositor-v9');const seasonalUrl=new URL('./seasonal-sky.js',import.meta.url).href;let source=await fetch(sourceUrl,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`base renderer ${r.status}`);return r.text()});source=source.replace("from './seasonal-sky.js'",`from '${seasonalUrl}'`);

const shaderStart=source.indexOf('const VOLUME_FS=`');const shaderEnd=source.indexOf('const COMPOSITE_FS=`',shaderStart);if(shaderStart<0||shaderEnd<0)throw new Error('iOS compositor shader contract missing');
const iosCloudShader=`const VOLUME_FS=\`#version 300 es
precision highp float;precision highp sampler3D;in vec2 vUv;out vec4 outColor;
uniform sampler3D uBaseNoise,uErosionNoise;uniform sampler2D uWeatherTex;uniform vec2 uResolution,uWind;uniform vec3 uSunDir,uCloudAmbient,uCloudWarm,uCloudBase,uLightningPos;uniform float uTime,uCoverage,uDensity,uErosion,uVerticalBuild,uConnected,uBaseDarkness,uPhaseG,uStorm,uLightningFlash;uniform int uSteps;
float sat(float x){return clamp(x,0.,1.);} 
float edgeNoise(float x,float z,float scale){float a=texture(uBaseNoise,vec3(x*scale,z,.18)).r;float b=texture(uBaseNoise,vec3(x*scale*2.05+.31,z+.21,.54)).g;float c=texture(uBaseNoise,vec3(x*scale*4.10+.07,z+.43,.81)).b;return a*.58+b*.29+c*.13;}
float spanNoise(float x,float z,float speed){float drift=(uWind.x+uWind.y*.18)*speed;float a=texture(uBaseNoise,vec3((x+drift)*.78,z,.12)).a;float b=texture(uBaseNoise,vec3((x+drift)*1.55+.37,z+.27,.42)).r;return a*.68+b*.32;}
vec4 cloudLayer(vec2 uv,float center,float halfH,float scale,float speed,float opacity,float z,float depth){
 float storm=sat(uStorm),build=sat(uVerticalBuild);float drift=(uWind.x+uWind.y*.18)*speed;float x=uv.x+drift;
 float span=spanNoise(uv.x,z,speed);float coverThreshold=mix(.76,.34,uCoverage)-uConnected*.20+depth*.035;float gate=smoothstep(coverThreshold-.075,coverThreshold+.075,span);gate=mix(gate,1.,sat(uConnected*(.68-depth*.10)));
 float baseN=edgeNoise(x,z+.11,scale*.62);float topN=edgeNoise(x,z+.39,scale*1.05);float detail=texture(uBaseNoise,vec3(x*scale*1.45,uv.y*2.65,z+.67)).g;
 float base=center-halfH+(baseN-.5)*mix(.026,.014,storm);float top=center+halfH+(topN-.5)*(.10+.15*build)+storm*.035;
 float lower=smoothstep(base-.020,base+.018,uv.y);float upper=1.-smoothstep(top-.045,top+.060,uv.y);float body=lower*upper;
 float edgeBand=1.-smoothstep(.025,.13,min(abs(uv.y-base),abs(uv.y-top)));float er=texture(uErosionNoise,vec3(x*scale*2.7,uv.y*3.8,z+.83)).r;body*=mix(1.,smoothstep(.23,.70,er),uErosion*.36*edgeBand);
 float alpha=body*gate*opacity*sat(uCoverage*1.28)*mix(.82,1.06,uDensity)*mix(.88,1.05,detail);
 float rel=sat((uv.y-base)/max(.045,top-base));float light=mix(.24,1.,smoothstep(.02,.88,rel));light*=mix(1.,.48,uBaseDarkness*(1.-rel));light*=mix(1.,.70,storm*(1.-rel*.40));
 vec3 color=mix(uCloudBase,uCloudAmbient,sat(.16+light*.84));color*=mix(.90,1.06,detail);float sunWarm=sat(1.-abs(uSunDir.y));float rim=smoothstep(.72,.98,rel)*sunWarm*(.08+.12*sat(uSunDir.x*.5+.5));color=mix(color,uCloudWarm,rim);
 float flash=uLightningFlash*exp(-length(vec2(uv.x-.56,uv.y-.52))*5.2);color+=vec3(.58,.70,1.)*flash*(.20+.38*alpha);
 return vec4(color,sat(alpha));
}
void over(inout vec3 rgb,inout float a,vec4 l){float w=l.a*(1.-a);rgb+=l.rgb*w;a+=w;}
void main(){vec2 uv=vUv;float storm=sat(uStorm),conn=sat(uConnected);
 vec4 farL=cloudLayer(uv,.79,.075+.035*uVerticalBuild,1.30,.18,.26+.12*conn,.13,.90);
 vec4 mainL=cloudLayer(uv,.54-.018*storm,.125+.075*uVerticalBuild+.055*storm,1.02,.40,.80+.16*conn,.47,.40);
 vec4 nearL=cloudLayer(uv,.29-.012*storm,.090+.055*uVerticalBuild+.045*storm,.82,.68,.56+.25*conn,.79,.10);
 vec3 rgb=vec3(0.);float a=0.;over(rgb,a,farL);over(rgb,a,mainL);over(rgb,a,nearL);if(a>.001)rgb/=a;outColor=vec4(rgb,a);
}\`;\n`;
source=source.slice(0,shaderStart)+iosCloudShader+source.slice(shaderEnd);
source=source.replace("const QUALITY={economy:{steps:8,scale:.24},balanced:{steps:10,scale:.30},high:{steps:12,scale:.36}};","const QUALITY={economy:{steps:3,scale:.42},balanced:{steps:3,scale:.50},high:{steps:3,scale:.62}};");
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
source=source.replace("renderer:'ue-inspired-webgl2-volumetric-weather-final-v2'","renderer:'ios-weather-style-bangkok-compositor-v9'");
const blob=new Blob([source],{type:'text/javascript'}),blobUrl=URL.createObjectURL(blob);try{await import(blobUrl)}catch(error){window.__volumetricWeatherFinalError=String(error?.stack||error);console.error('iOS Weather compositor bootstrap failed',error);throw error}finally{setTimeout(()=>URL.revokeObjectURL(blobUrl),10000)}