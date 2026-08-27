import {seasonalSkyForState,bangkokSeasonalProfile,cloudMorphologyForWeather} from './seasonal-sky.js';

const DPR=2;
const canvas=document.getElementById('sky');
const boltCanvas=document.getElementById('bolt');
const boltCtx=boltCanvas.getContext('2d');
const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
if(!gl)throw new Error('WebGL2 is required for the volumetric weather lab');

const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,Number(v)||0));
const mix=(a,b,t)=>a+(b-a)*t;
const MONTH_NAMES=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const WEATHER_CODES={clear:0,'mainly-clear':1,'partly-cloudy':2,overcast:3,rain:63,showers:81,thunderstorm:95,snow:75};

const state={
  month:8,day:27,solarAltitude:18,solarAzimuth:258,haze:.47,warmLight:.55,
  weatherFamily:'partly-cloudy',cloudCover:.56,humidity:.82,pm25:18,storm:.08,
  coverage:.58,density:.95,erosion:.46,verticalBuild:.66,connected:.16,baseDarkness:.62,
  phaseG:.55,jitter:.02,windSpeed:14,windDirection:245,
  rain:.0,rainLength:.95,snow:.0,snowTurbulence:.65,
  windowRain:.0,trickleRate:.65,windowRefraction:.9,
  heat:.06,heatScale:1,
  lightningFrequency:.0,internalLightning:.9,boltChance:.35,
  animate:true,quality:'balanced',seed:0x8a41ce27
};

const PRESETS={
  augPartly:{month:8,day:27,solarAltitude:18,solarAzimuth:258,weatherFamily:'partly-cloudy',cloudCover:.56,humidity:.82,pm25:18,storm:.06,coverage:.58,density:.92,erosion:.48,verticalBuild:.68,connected:.16,baseDarkness:.62,rain:0,windowRain:0,snow:0,heat:.04,lightningFrequency:0},
  augStorm:{month:8,day:27,solarAltitude:4.8,solarAzimuth:263,weatherFamily:'thunderstorm',cloudCover:1,humidity:.96,pm25:9,storm:.92,coverage:1,density:1.28,erosion:.24,verticalBuild:.94,connected:.90,baseDarkness:.90,rain:.88,rainLength:1.28,windowRain:.78,trickleRate:1.15,windowRefraction:1.12,snow:0,heat:0,lightningFrequency:.72,internalLightning:1.25,boltChance:.42},
  janBroken:{month:1,day:15,solarAltitude:1.1,solarAzimuth:248,weatherFamily:'partly-cloudy',cloudCover:.48,humidity:.62,pm25:22,storm:0,coverage:.49,density:.84,erosion:.54,verticalBuild:.46,connected:.08,baseDarkness:.34,rain:0,windowRain:0,snow:0,heat:0,lightningFrequency:0,warmLight:1.1},
  aprHaze:{month:4,day:15,solarAltitude:4.2,solarAzimuth:270,weatherFamily:'mainly-clear',cloudCover:.16,humidity:.55,pm25:42,storm:0,coverage:.13,density:.68,erosion:.68,verticalBuild:.30,connected:0,baseDarkness:.24,rain:0,windowRain:0,snow:0,heat:.86,heatScale:1.25,lightningFrequency:0,warmLight:.92},
  octClearing:{month:10,day:15,solarAltitude:2.0,solarAzimuth:258,weatherFamily:'showers',cloudCover:.58,humidity:.78,pm25:12,storm:.15,coverage:.55,density:.86,erosion:.58,verticalBuild:.58,connected:.08,baseDarkness:.46,rain:.12,windowRain:.16,trickleRate:.35,snow:0,heat:0,lightningFrequency:0,warmLight:1.0},
  snowDemo:{month:12,day:15,solarAltitude:10,solarAzimuth:245,weatherFamily:'snow',cloudCover:.96,humidity:.90,pm25:4,storm:.08,coverage:.92,density:1.0,erosion:.30,verticalBuild:.42,connected:.82,baseDarkness:.62,rain:0,windowRain:.18,trickleRate:.18,snow:.86,snowTurbulence:1.05,heat:0,lightningFrequency:0,warmLight:.35}
};

const QUALITY={economy:{steps:8,scale:.23},balanced:{steps:10,scale:.28},high:{steps:12,scale:.34}};

function compile(type,source){
  const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader compile failed');
  return s;
}
function program(vs,fs){
  const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'program link failed');
  return p;
}
const VS=`#version 300 es
layout(location=0) in vec2 aPosition;out vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.0,1.0);}`;

const VOLUME_FS=`#version 300 es
precision highp float;precision highp sampler3D;
in vec2 vUv;out vec4 outColor;
uniform sampler3D uBaseNoise;uniform sampler3D uErosionNoise;uniform sampler2D uWeatherTex;
uniform vec2 uResolution,uWind;uniform vec3 uSunDir,uCloudAmbient,uCloudWarm,uCloudBase;
uniform float uTime,uCoverage,uDensity,uErosion,uVerticalBuild,uConnected,uBaseDarkness,uPhaseG,uJitter,uStorm,uLightningFlash;uniform vec3 uLightningPos;uniform int uSteps;
float sat(float x){return clamp(x,0.0,1.0);}float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float phaseHG(float mu,float g){float g2=g*g;return (1.0-g2)/max(.14,pow(1.0+g2-2.0*g*mu,1.5));}
float densityAt(vec3 p){
  float h=sat((p.y-1.0)/1.65);float lower=smoothstep(.015,.11,h);float top=mix(.50,.94,uVerticalBuild);float upper=1.0-smoothstep(top,min(1.0,top+.18),h);float vertical=lower*upper;
  vec3 q=vec3(p.x*.034+uWind.x,p.z*.036+uWind.y,h*.54+uTime*.00018);
  float n0=texture(uBaseNoise,q).r;float n1=texture(uBaseNoise,q*2.37+vec3(.31,.17,.43)).g;float n2=texture(uBaseNoise,q*4.75+vec3(.07,.53,.21)).b;
  float weather=texture(uWeatherTex,p.xz*.024+uWind*.42).r;float erosion=texture(uErosionNoise,q*5.35+vec3(.19,.41,.11)).r;
  float broad=n0*.56+n1*.30+n2*.14;float weatherShape=(weather-.5)*.76+uConnected*.24;float erode=(erosion-.5)*uErosion*.42;
  float threshold=mix(.79,.34,uCoverage);float d=smoothstep(threshold-.075,threshold+.055,broad+weatherShape-erode)*vertical*uDensity;
  return d*sat(uCoverage*1.22);
}
void main(){
  float aspect=uResolution.x/max(1.0,uResolution.y);vec2 q=vUv*2.0-1.0;q.x*=aspect;
  vec3 ro=vec3(0.0,0.0,0.0);vec3 rd=normalize(vec3(q.x*.78,.18+vUv.y*1.04,1.04-vUv.y*.36));
  float t0=1.0/max(.08,rd.y),t1=2.65/max(.08,rd.y);t1=min(t1,14.0);float span=max(.001,t1-t0);float dt=span/float(max(uSteps,1));
  float jitter=(hash12(gl_FragCoord.xy+uTime)-.5)*uJitter;float t=t0+dt*(.5+jitter*.45);vec3 accum=vec3(0.0);float T=1.0;float mu=dot(rd,uSunDir);float phase=phaseHG(mu,uPhaseG)*.15+.72;
  for(int i=0;i<12;i++){
    if(i>=uSteps)break;vec3 p=ro+rd*t;float d=densityAt(p);
    if(d>.004){
      float h=sat((p.y-1.0)/1.65);vec3 sq=vec3((p.x+uSunDir.x*.52)*.034+uWind.x,(p.z+uSunDir.z*.52)*.036+uWind.y,h*.54+uSunDir.y*.08);
      float shadowNoise=texture(uBaseNoise,sq).a;float selfShadow=exp(-max(0.0,shadowNoise-.42)*uDensity*(1.15+uBaseDarkness*2.2));
      float baseLight=mix(.34,1.0,smoothstep(.02,.64,h));baseLight*=mix(1.0,.66,uBaseDarkness*(1.0-h));
      float flash=uLightningFlash*exp(-length((p-uLightningPos)*vec3(.7,1.35,.7))*2.7);
      vec3 light=mix(uCloudBase,uCloudAmbient,sat(.26+baseLight*.70));light*=mix(.48,1.0,selfShadow);light=mix(light,uCloudWarm,sat(phase*.18*selfShadow));light+=vec3(.68,.78,1.0)*flash*(.55+.45*selfShadow);
      float sigma=d*(1.05+uStorm*.34);float stepT=exp(-sigma*dt*.88);float scatter=(1.0-stepT);accum+=T*light*scatter;T*=stepT;if(T<.025)break;
    }
    t+=dt;
  }
  outColor=vec4(accum,1.0-T);
}`;

const COMPOSITE_FS=`#version 300 es
precision highp float;in vec2 vUv;out vec4 outColor;
uniform sampler2D uCloudTex,uWetTex;uniform vec2 uResolution,uSunUv,uWindScreen;uniform vec3 uSkyTop,uSkyHorizon;
uniform float uTime,uSolarAltitude,uSunGlow,uPm25,uHumidity,uHeat,uHeatScale,uRain,uRainLength,uSnow,uSnowTurbulence,uWindowRain,uWindowRefraction,uLightningFlash;
float sat(float x){return clamp(x,0.0,1.0);}float hash11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}float hash21(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec3 saturation(vec3 c,float s){float l=dot(c,vec3(.2126,.7152,.0722));return mix(vec3(l),c,s);}
float rainLayer(vec2 uv,float scale,float speed,float seed){
  vec2 p=uv*vec2(42.0*scale,12.0*scale);p.x-=uWindScreen.x*uTime*.012*scale;float col=floor(p.x);float rnd=hash11(col+seed);float x=abs(fract(p.x)-.5);float y=fract(p.y+rnd*7.0+uTime*speed*(1.1+rnd*.8));float head=smoothstep(.52,.20,y);float tail=smoothstep(.02,.14,y)*head;float line=smoothstep(.026,.006,x)*tail;return line*(.45+.55*rnd);
}
float snowLayer(vec2 uv,float scale,float speed,float seed){
  vec2 g=uv*vec2(18.0*scale,34.0*scale);vec2 id=floor(g);float r=hash21(id+seed),rx=hash21(id+vec2(seed+17.3,9.1)),ry=hash21(id+vec2(31.7,seed+4.9));vec2 f=fract(g)-vec2(rx,fract(ry-uTime*speed*(.18+.34*r)));if(f.x>.5)f.x-=1.0;if(f.x<-.5)f.x+=1.0;if(f.y>.5)f.y-=1.0;if(f.y<-.5)f.y+=1.0;f.x+=sin(uTime*.46+r*6.283+id.y)*.11*uSnowTurbulence;float d=length(f);return smoothstep(.075+.045*r,.012,d)*step(.34,r);
}
void main(){
  float horizon=pow(1.0-vUv.y,1.65);vec2 texel=1.0/uResolution;
  float heatMask=horizon*horizon*uHeat;float hn=sin((vUv.y*uHeatScale*95.0+uTime*2.1)+sin(vUv.x*31.0-uTime*.7))*sin(vUv.x*uHeatScale*57.0+uTime*1.3);vec2 heatOffset=vec2(hn,cos(hn*3.1+uTime))*texel*6.0*heatMask;
  vec2 uv=vUv+heatOffset;float wl=texture(uWetTex,uv-vec2(texel.x*3.0,0)).r,wr=texture(uWetTex,uv+vec2(texel.x*3.0,0)).r,wb=texture(uWetTex,uv-vec2(0,texel.y*3.0)).r,wt=texture(uWetTex,uv+vec2(0,texel.y*3.0)).r;float wet=texture(uWetTex,uv).r;
  vec2 wetNormal=vec2(wr-wl,wt-wb);vec2 refractOffset=wetNormal*.0085*uWindowRain*uWindowRefraction;vec4 cloud=texture(uCloudTex,uv+refractOffset);
  vec3 sky=mix(uSkyHorizon,uSkyTop,smoothstep(.01,.98,uv.y));
  float sunVisible=smoothstep(-1.0,-.1,uSolarAltitude);vec2 sd=uv-uSunUv;sd.x*=uResolution.x/max(1.0,uResolution.y);float sunD=length(sd);float disc=1.0-smoothstep(.012,.020,sunD);float halo=1.0-smoothstep(.02,.115,sunD);vec3 sunColor=mix(vec3(1.0,.56,.25),vec3(1.0,.97,.84),smoothstep(4.0,30.0,uSolarAltitude));sky+=sunColor*(disc*.95+halo*.12*uSunGlow)*sunVisible;
  vec3 c=mix(sky,cloud.rgb,cloud.a);c+=vec3(.62,.72,1.0)*uLightningFlash*.08*(.55+.45*cloud.a);
  float pm=sat(uPm25/180.0);c=saturation(c,1.0-pm*.52);c=mix(c,vec3(.62,.58,.54),pm*(.05+.30*horizon));c=mix(c,vec3(.67,.69,.70),uHumidity*.10*horizon*horizon);
  float rain=(rainLayer(vUv,1.0,1.65,3.0)+rainLayer(vUv+vec2(.17,.03),1.55,2.05,18.0)*.65+rainLayer(vUv+vec2(.41,.19),.72,1.25,41.0)*.45)*uRain;rain*=mix(.72,1.22,uRainLength);c+=vec3(.73,.82,.91)*rain*.15;
  float snow=(snowLayer(vUv,1.0,.55,8.0)+snowLayer(vUv+vec2(.31,.0),1.65,.34,29.0)*.65+snowLayer(vUv+vec2(.11,.17),.70,.78,61.0)*.42)*uSnow;c=mix(c,vec3(.95,.97,1.0),sat(snow*.78));
  float wetRim=sat(wet*1.4)*uWindowRain;float wetSpec=sat(length(wetNormal)*8.0)*uWindowRain;c+=vec3(.84,.90,.96)*(wetRim*.018+wetSpec*.052);
  float vign=smoothstep(1.22,.32,length((vUv-.5)*vec2(uResolution.x/uResolution.y,1.0)));c*=mix(.90,1.0,vign);
  outColor=vec4(clamp(c,0.0,1.0),1.0);
}`;

const volumeProgram=program(VS,VOLUME_FS),compositeProgram=program(VS,COMPOSITE_FS);
const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0)

function seededRandom(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
function hash3i(x,y,z,seed){let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(z,1442695041)+(seed>>>0))>>>0;h=Math.imul(h^(h>>>13),1274126177)>>>0;return((h^(h>>>16))>>>0)/4294967295}
function valueNoise3(x,y,z,seed){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=x-ix,fy=y-iy,fz=z-iz,s=t=>t*t*(3-2*t),tx=s(fx),ty=s(fy),tz=s(fz),h=(dx,dy,dz)=>hash3i(ix+dx,iy+dy,iz+dz,seed),a=mix(h(0,0,0),h(1,0,0),tx),b=mix(h(0,1,0),h(1,1,0),tx),c=mix(h(0,0,1),h(1,0,1),tx),d=mix(h(0,1,1),h(1,1,1),tx);return mix(mix(a,b,ty),mix(c,d,ty),tz)}
function tex3D(size,seed,erosion=false){
  const data=new Uint8Array(size*size*size*4),freqs=erosion?[10,16,23,7]:[3.2,6.5,12.5,4.6];let o=0;
  for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){const nx=x/size,ny=y/size,nz=z/size;for(let c=0;c<4;c++){const f=freqs[c],warp=.18*Math.sin((nx+nz*1.37+ny*.63)*(c+2)*6.283);const v=valueNoise3(nx*f+warp,ny*f*.72,nz*f+warp*.55,(seed+Math.imul(c+1,0x9e3779b1))>>>0);data[o++]=Math.round(clamp(v)*255)}}
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_3D,t);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_R,gl.REPEAT);gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA8,size,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,data);return t;
}
function weatherTexture(seed){
  const size=128,rand=seededRandom(seed^0x5f3759df),coarse=16,grid=new Float32Array(coarse*coarse);for(let i=0;i<grid.length;i++)grid[i]=rand();const data=new Uint8Array(size*size);
  const smooth=t=>t*t*(3-2*t),g=(x,y)=>grid[((y%coarse+coarse)%coarse)*coarse+((x%coarse+coarse)%coarse)];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const gx=x/size*coarse,gy=y/size*coarse,ix=Math.floor(gx),iy=Math.floor(gy),fx=smooth(gx-ix),fy=smooth(gy-iy);const a=mix(g(ix,iy),g(ix+1,iy),fx),b=mix(g(ix,iy+1),g(ix+1,iy+1),fx);let v=mix(a,b,fy);v=.68*v+.22*Math.sin((x+y*.37)*.073+seed*.000001)+.10*Math.sin((x*.31-y)*.051);data[y*size+x]=clamp(v*.75+.25)*255}
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,size,size,0,gl.RED,gl.UNSIGNED_BYTE,data);return t;
}
let baseNoise=tex3D(48,state.seed),erosionNoise=tex3D(32,state.seed^0xa5a5a5a5,true),weatherTex=weatherTexture(state.seed);
function rebuildNoise(){for(const t of [baseNoise,erosionNoise,weatherTex])gl.deleteTexture(t);baseNoise=tex3D(48,state.seed);erosionNoise=tex3D(32,state.seed^0xa5a5a5a5,true);weatherTex=weatherTexture(state.seed);resetWetness(true)}

const wetCanvas=document.createElement('canvas');wetCanvas.width=256;wetCanvas.height=256;const wetCtx=wetCanvas.getContext('2d',{alpha:false});
const wetTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,wetTex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
let drops=[];function resetWetness(hard=false){if(hard)drops=[];wetCtx.fillStyle='black';wetCtx.fillRect(0,0,256,256)}
function updateWetness(dt){
  if(state.windowRain<.005){if(drops.length){drops=[];resetWetness()}return}
  const target=Math.round(10+state.windowRain*72);const rand=seededRandom((state.seed^((performance.now()/170)|0))>>>0);while(drops.length<target)drops.push({x:rand()*256,y:rand()*256,r:1.0+rand()*2.8,vy:.12+rand()*.62,trail:rand()<state.trickleRate*.32,phase:rand()*6.28});if(drops.length>target)drops.splice(target);
  wetCtx.fillStyle='rgba(0,0,0,.29)';wetCtx.fillRect(0,0,256,256);wetCtx.globalCompositeOperation='lighter';
  for(const d of drops){d.y+=d.vy*dt*.045*(.4+state.trickleRate);d.x+=Math.sin(d.phase+d.y*.03)*.015*dt;if(d.y>270){d.y=-10;d.x=rand()*256}const g=wetCtx.createRadialGradient(d.x,d.y,0,d.x,d.y,d.r*1.55);g.addColorStop(0,'rgba(255,255,255,.72)');g.addColorStop(.45,'rgba(210,210,210,.38)');g.addColorStop(1,'rgba(0,0,0,0)');wetCtx.fillStyle=g;wetCtx.beginPath();wetCtx.arc(d.x,d.y,d.r*1.55,0,Math.PI*2);wetCtx.fill();if(d.trail){wetCtx.strokeStyle='rgba(190,190,190,.18)';wetCtx.lineWidth=Math.max(1,d.r*.45);wetCtx.beginPath();wetCtx.moveTo(d.x,d.y-d.r*.4);wetCtx.quadraticCurveTo(d.x+Math.sin(d.phase)*4,d.y-d.r*5,d.x+Math.sin(d.phase*1.7)*2,d.y-d.r*(8+state.trickleRate*10));wetCtx.stroke()}}
  wetCtx.globalCompositeOperation='source-over';gl.bindTexture(gl.TEXTURE_2D,wetTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,wetCanvas);
}
resetWetness(true);updateWetness(16);

let cloudTex=gl.createTexture(),cloudFbo=gl.createFramebuffer(),cloudW=1,cloudH=1;
function resizeCloudTarget(){const q=QUALITY[state.quality]||QUALITY.balanced;cloudW=Math.max(96,Math.round(canvas.width*q.scale));cloudH=Math.max(96,Math.round(canvas.height*q.scale));gl.bindTexture(gl.TEXTURE_2D,cloudTex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,cloudW,cloudH,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,cloudFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,cloudTex,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Cloud framebuffer incomplete');gl.bindFramebuffer(gl.FRAMEBUFFER,null)}
function resize(){const w=Math.max(1,Math.round(innerWidth*DPR)),h=Math.max(1,Math.round(innerHeight*DPR));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;boltCanvas.width=w;boltCanvas.height=h;boltCtx.setTransform(DPR,0,0,DPR,0,0);resizeCloudTarget()}}
addEventListener('resize',resize,{passive:true});resize();

function uloc(p,n){return gl.getUniformLocation(p,n)}function uf(p,n,v){gl.uniform1f(uloc(p,n),v)}function ui(p,n,v){gl.uniform1i(uloc(p,n),v)}function uv2(p,n,a,b){gl.uniform2f(uloc(p,n),a,b)}function uv3(p,n,v){gl.uniform3f(uloc(p,n),v[0],v[1],v[2])}
function vec3Color(arr){return arr.map(v=>Number(v)||0)}
function bangkokDate(){return new Date(`2026-${String(state.month).padStart(2,'0')}-${String(Math.min(state.day,28)).padStart(2,'0')}T18:00:00+07:00`)}
function weatherObject(){return{weatherCode:WEATHER_CODES[state.weatherFamily]??2,cloudCover:state.cloudCover,humidity:state.humidity,storm:state.storm,precipitation:state.rain*8,rain:state.rain*8,showers:state.weatherFamily==='showers'?state.rain*8:0}}
function seasonal(){return seasonalSkyForState({date:bangkokDate(),solarAltitude:state.solarAltitude,solarAzimuth:state.solarAzimuth,weather:weatherObject()})}
function wind2(){const r=state.windDirection*Math.PI/180,s=state.windSpeed*.000018;return[Math.sin(r)*s,Math.cos(r)*s]}
function sunDir(){const alt=state.solarAltitude*Math.PI/180,az=state.solarAzimuth*Math.PI/180;return[Math.sin(az)*Math.cos(alt),Math.sin(alt),Math.cos(az)*Math.cos(alt)]}
function sunUv(){const az=(state.solarAzimuth-180)*Math.PI/180;return[clamp(.5+Math.sin(az)*.28,.08,.92),clamp(.11+(state.solarAltitude+2)/78*.70,.07,.88)]}

let lightningFlash=0,nextLightning=Infinity,boltUntil=0;
function scheduleLightning(now){if(state.lightningFrequency<.01){nextLightning=Infinity;return}const base=mix(16000,2100,state.lightningFrequency);nextLightning=now+base*(.55+Math.random()*.9)}
function drawBolt(now){
  boltCtx.clearRect(0,0,innerWidth,innerHeight);if(now>boltUntil)return;
  const fade=clamp((boltUntil-now)/260);const x0=innerWidth*(.24+Math.random()*.52),y0=innerHeight*(.08+Math.random()*.18),y1=innerHeight*(.62+Math.random()*.22),segments=16,pts=[[x0,y0]];let x=x0;for(let i=1;i<=segments;i++){const y=mix(y0,y1,i/segments);x+=((Math.random()-.5)*innerWidth*.055)*(1-i/segments*.55);pts.push([x,y])}
  boltCtx.save();boltCtx.globalCompositeOperation='screen';for(const [width,alpha,blur] of [[9,.10,18],[4,.24,10],[1.35,.92,2]]){boltCtx.beginPath();boltCtx.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)boltCtx.lineTo(...pts[i]);boltCtx.lineWidth=width;boltCtx.strokeStyle=`rgba(220,232,255,${alpha*fade})`;boltCtx.shadowBlur=blur;boltCtx.shadowColor='rgba(190,215,255,.9)';boltCtx.stroke()}for(let b=0;b<3;b++){const start=4+Math.floor(Math.random()*8),p=pts[start],ex=p[0]+(Math.random()-.5)*innerWidth*.12,ey=p[1]+innerHeight*(.06+Math.random()*.12);boltCtx.beginPath();boltCtx.moveTo(...p);boltCtx.lineTo(ex,ey);boltCtx.lineWidth=.8;boltCtx.strokeStyle=`rgba(205,222,255,${.45*fade})`;boltCtx.stroke()}boltCtx.restore()
}
function triggerLightning(forceBolt=true){lightningFlash=Math.max(lightningFlash,state.internalLightning);if(forceBolt||Math.random()<state.boltChance)boltUntil=performance.now()+260;scheduleLightning(performance.now())}
document.getElementById('triggerLightning').addEventListener('click',()=>triggerLightning(true));

function renderVolume(now){
  const sky=seasonal(),w=wind2();gl.bindFramebuffer(gl.FRAMEBUFFER,cloudFbo);gl.viewport(0,0,cloudW,cloudH);gl.useProgram(volumeProgram);gl.bindVertexArray(vao);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,baseNoise);ui(volumeProgram,'uBaseNoise',0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_3D,erosionNoise);ui(volumeProgram,'uErosionNoise',1);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,weatherTex);ui(volumeProgram,'uWeatherTex',2);
  uv2(volumeProgram,'uResolution',cloudW,cloudH);uv2(volumeProgram,'uWind',w[0]*now,w[1]*now);uv3(volumeProgram,'uSunDir',sunDir());uv3(volumeProgram,'uCloudAmbient',vec3Color(sky.cloudAmbient));uv3(volumeProgram,'uCloudWarm',vec3Color(sky.cloudWarm));uv3(volumeProgram,'uCloudBase',vec3Color(sky.cloudBase));uf(volumeProgram,'uTime',state.animate?now:0);uf(volumeProgram,'uCoverage',state.coverage);uf(volumeProgram,'uDensity',state.density);uf(volumeProgram,'uErosion',state.erosion);uf(volumeProgram,'uVerticalBuild',state.verticalBuild);uf(volumeProgram,'uConnected',state.connected);uf(volumeProgram,'uBaseDarkness',state.baseDarkness);uf(volumeProgram,'uPhaseG',state.phaseG);uf(volumeProgram,'uJitter',state.jitter);uf(volumeProgram,'uStorm',state.storm);uf(volumeProgram,'uLightningFlash',lightningFlash);uv3(volumeProgram,'uLightningPos',[0.2,1.9,2.8]);ui(volumeProgram,'uSteps',QUALITY[state.quality].steps);gl.drawArrays(gl.TRIANGLES,0,6)
}
function renderComposite(now){
  const sky=seasonal(),su=sunUv(),r=state.windDirection*Math.PI/180;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(compositeProgram);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,cloudTex);ui(compositeProgram,'uCloudTex',0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,wetTex);ui(compositeProgram,'uWetTex',1);
  uv2(compositeProgram,'uResolution',canvas.width,canvas.height);uv2(compositeProgram,'uSunUv',su[0],su[1]);uv2(compositeProgram,'uWindScreen',Math.sin(r),Math.cos(r));uv3(compositeProgram,'uSkyTop',sky.top);uv3(compositeProgram,'uSkyHorizon',sky.horizon);uf(compositeProgram,'uTime',state.animate?now*.001:0);uf(compositeProgram,'uSolarAltitude',state.solarAltitude);uf(compositeProgram,'uSunGlow',1);uf(compositeProgram,'uPm25',state.pm25);uf(compositeProgram,'uHumidity',state.humidity);uf(compositeProgram,'uHeat',state.heat);uf(compositeProgram,'uHeatScale',state.heatScale);uf(compositeProgram,'uRain',state.rain);uf(compositeProgram,'uRainLength',state.rainLength);uf(compositeProgram,'uSnow',state.snow);uf(compositeProgram,'uSnowTurbulence',state.snowTurbulence);uf(compositeProgram,'uWindowRain',state.windowRain);uf(compositeProgram,'uWindowRefraction',state.windowRefraction);uf(compositeProgram,'uLightningFlash',lightningFlash);gl.drawArrays(gl.TRIANGLES,0,6)
}

let last=performance.now(),samples=[];function frame(now){resize();const dt=Math.min(60,now-last);last=now;if(state.animate)updateWetness(dt);if(now>=nextLightning){triggerLightning(false)}lightningFlash*=Math.pow(.035,dt/1000);drawBolt(now);const t0=performance.now();renderVolume(now*.001);renderComposite(now);const cost=performance.now()-t0;samples.push(cost);if(samples.length>90)samples.shift();updateStats();requestAnimationFrame(frame)}

function autoFromWeather(){const profile=bangkokSeasonalProfile(bangkokDate()),m=cloudMorphologyForWeather(weatherObject(),profile);state.coverage=clamp(Math.max(m.mid*.72,m.low*.88,state.cloudCover*.88));state.verticalBuild=clamp(.28+m.convective*.50+(m.family==='thunderstorm'?.22:0));state.connected=m.connected;state.baseDarkness=m.darkness;state.density=clamp(.62+m.mid*.28+m.low*.34,.5,1.45);state.erosion=clamp(.72-m.edge*.55-m.connected*.18,.15,.75);if(m.family==='rain'||m.family==='showers'||m.family==='thunderstorm')state.rain=Math.max(state.rain,m.family==='thunderstorm'?.82:m.family==='rain'?.58:.32);if(m.family==='snow')state.snow=Math.max(state.snow,.72);syncControls()}
function applyPreset(name){Object.assign(state,PRESETS[name]||PRESETS.augPartly);document.getElementById('preset').value=name;document.getElementById('month').value=state.month;document.getElementById('day').value=state.day;document.getElementById('weatherFamily').value=state.weatherFamily;syncControls();scheduleLightning(performance.now())}
function fmt(k,v){if(['cloudCover','humidity','coverage','erosion','verticalBuild','connected','baseDarkness','rain','snow','windowRain','heat','storm','lightningFrequency','boltChance'].includes(k))return`${Math.round(v*100)}%`;if(k==='pm25')return`${Math.round(v)} µg/m³`;if(k==='windSpeed')return`${Number(v).toFixed(1)} km/h`;if(k.includes('Azimuth')||k==='windDirection'||k==='solarAltitude')return`${Number(v).toFixed(k==='solarAltitude'?1:0)}°`;return Number(v).toFixed(2)}
function syncControls(){
  document.getElementById('month').value=state.month;document.getElementById('day').value=state.day;document.getElementById('weatherFamily').value=state.weatherFamily;document.getElementById('quality').value=state.quality;document.getElementById('animate').checked=state.animate;
  document.querySelectorAll('[data-k]').forEach(input=>{const k=input.dataset.k;if(state[k]!==undefined)input.value=state[k];const out=input.parentElement.querySelector('output');if(out)out.textContent=fmt(k,state[k])});updateStats()
}
function updateStats(){
  const sky=seasonal(),q=QUALITY[state.quality],avg=samples.length?samples.reduce((a,b)=>a+b,0)/samples.length:0;document.getElementById('monthName').textContent=MONTH_NAMES[state.month-1];document.getElementById('profileName').textContent=`${sky.profile.anchorA} → ${sky.profile.anchorB}`;document.getElementById('renderSize').textContent=`cloud ${cloudW}×${cloudH} → DPR2 ${canvas.width}×${canvas.height}`;document.getElementById('stepsReadout').textContent=`${q.steps} ray steps · ${(q.scale*100).toFixed(0)}% linear`;document.getElementById('fps').textContent=`GPU submit ${avg.toFixed(1)} ms`;document.getElementById('paletteReadout').textContent=`${sky.profile.profile}\nmonth ${state.month} · ${sky.morphology.family}\nzenith ${sky.top.map(v=>Math.round(v*255)).join(', ')}\nhorizon ${sky.horizon.map(v=>Math.round(v*255)).join(', ')}\ncloud base darkness ${sky.profile.baseDarkness.toFixed(2)} · convective ${sky.profile.convective.toFixed(2)}`
}

document.querySelectorAll('[data-k]').forEach(input=>input.addEventListener('input',()=>{state[input.dataset.k]=Number(input.value);const out=input.parentElement.querySelector('output');if(out)out.textContent=fmt(input.dataset.k,state[input.dataset.k])}));
document.getElementById('month').addEventListener('change',e=>{state.month=Number(e.target.value);const p=bangkokSeasonalProfile(bangkokDate());state.haze=p.haze;state.baseDarkness=Math.max(state.baseDarkness*.7,p.baseDarkness*.75);syncControls()});document.getElementById('day').addEventListener('input',e=>{state.day=Number(e.target.value);syncControls()});document.getElementById('weatherFamily').addEventListener('change',e=>{state.weatherFamily=e.target.value;autoFromWeather()});document.getElementById('quality').addEventListener('change',e=>{state.quality=e.target.value;resizeCloudTarget();syncControls()});document.getElementById('animate').addEventListener('change',e=>state.animate=e.target.checked);document.getElementById('preset').addEventListener('change',e=>applyPreset(e.target.value));document.getElementById('auto').addEventListener('click',autoFromWeather);document.getElementById('newSeed').addEventListener('click',()=>{state.seed=(crypto.getRandomValues(new Uint32Array(1))[0]||Date.now())>>>0;rebuildNoise()});document.getElementById('fullscreen').addEventListener('click',()=>document.documentElement.requestFullscreen?.());
const panel=document.getElementById('panel'),show=document.getElementById('showPanel');document.getElementById('hidePanel').addEventListener('click',()=>{panel.classList.add('hidden');show.classList.add('visible')});show.addEventListener('click',()=>{panel.classList.remove('hidden');show.classList.remove('visible')});

window.VolumetricWeatherLab={
  applyPreset,autoFromWeather,triggerLightning,hideControls(){panel.classList.add('hidden');show.classList.add('visible')},showControls(){panel.classList.remove('hidden');show.classList.remove('visible')},
  metrics(){const q=QUALITY[state.quality],s=[...samples].sort((a,b)=>a-b);return{renderer:'ue-inspired-webgl2-volumetric-weather-lab-v1',webgl2:true,dpr:DPR,canvas:{width:canvas.width,height:canvas.height},cloud:{width:cloudW,height:cloudH,linearScale:q.scale,raySteps:q.steps},effects:{rain:state.rain,windowRain:state.windowRain,snow:state.snow,heat:state.heat,lightningFrequency:state.lightningFrequency},avgSubmitMs:s.length?s.reduce((a,b)=>a+b,0)/s.length:0,p95SubmitMs:s.length?s[Math.min(s.length-1,Math.floor(s.length*.95))]:0,state:{...state}}}
};
applyPreset('augPartly');window.__volumetricLabReady=true;requestAnimationFrame(frame);
