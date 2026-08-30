export const BETTA_VERTEX_SHADER=`
precision highp float;
uniform float uTime;
uniform float uSeed;
uniform float uSpread;
uniform float uFoldDensity;
uniform float uCurl;
uniform float uTwist;
uniform float uEdgeFlutter;
uniform float uDepth;
uniform float uCurrentStrength;
uniform float uMotionSpeed;
uniform float uTurbulence;
uniform float uMotionAmplitude;
uniform vec2 uCurrent;
uniform float uPhase;
uniform float uSatelliteEnergy;
uniform float uSatelliteCloud;
uniform float uSatelliteCold;
uniform float uSatelliteCooling;
uniform float uSatelliteTexture;
uniform float uSatelliteVapor;
uniform vec2 uSatelliteMotion;
uniform vec3 uSatelliteFingerprint;
attribute float aU;
attribute float aV;
attribute float aRayJitter;
varying vec2 vFinUv;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vRay;
varying float vFold;
varying float vEdge;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.0,i1.z,i2.z,1.0))
    +i.y+vec4(0.0,i1.y,i2.y,1.0))
    +i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float noiseField(float u,float v,float t,float seed){
  vec3 p=vec3(u*1.75+seed*.17,v*2.9-seed*.11,t*.38+seed);
  float n=snoise(p);
  n+=.52*snoise(p*1.91+vec3(7.1,-3.4,t*.071));
  n+=.24*snoise(p*3.73+vec3(-4.2,9.8,-t*.052));
  return n/1.76;
}
vec3 membranePosition(float u,float v,float jitter){
  float satelliteTempo=.72+uSatelliteEnergy*.92+max(0.0,uSatelliteCooling)*.2;
  float t=uTime*uMotionSpeed*satelliteTempo+uPhase;
  float theta=(v-.5)*uSpread;
  float edgeShape=1.0-.16*pow(abs(v-.5)*2.0,2.3);
  float scallop=.035*sin((v*19.0+uSeed)*6.28318)+.018*sin((v*41.0-uSeed*.4)*6.28318);
  float rayLength=(1.0+jitter*.105+scallop)*edgeShape;
  float r=u*(3.55*rayLength);
  float rootEase=smoothstep(.02,.22,u);
  float tipEase=smoothstep(.52,1.0,u);
  float broad=noiseField(u*.74,v*.8,t,uSeed);
  float secondary=noiseField(u*1.7,v*2.1,t*1.13,uSeed+8.4);
  float slow=noiseField(u*.42,v*.5,t*.36,uSeed+17.9);
  float organism=noiseField(u*.28+.09*uSatelliteFingerprint.x,v*.42,t*.52,uSeed+54.0);
  float shapeSweep=noiseField(u*.35,v*.55,t*.29,uSeed+73.0+uSatelliteFingerprint.z*9.0);
  vec2 physicalCurrent=mix(uCurrent,uSatelliteMotion,.72);
  float currentBend=(physicalCurrent.x*cos(theta)+physicalCurrent.y*sin(theta))*uCurrentStrength;
  float foldPhase=(v*uFoldDensity+secondary*.12+slow*.08)*6.28318+uSeed+t*(.54+.24*uSatelliteTexture);
  float fold=sin(foldPhase)*(.26+.5*u)*(1.0+uSatelliteEnergy*.48+uSatelliteTexture*.22);
  float curlAngle=uCurl*u*u*(.52+slow*.24)+currentBend*u*.22;
  curlAngle+=(uSatelliteVapor-.5)*u*u*.14+(uSatelliteFingerprint.y-.5)*u*u*.12;
  theta+=curlAngle+broad*.12*uMotionAmplitude*rootEase;
  theta+=shapeSweep*(.105+.105*uSatelliteEnergy)*u*rootEase;
  float twist=uTwist*u*u+slow*.25*uTurbulence+(uSatelliteCloud-.5)*u*u*.16;
  r*=1.0+organism*(.052+.06*uSatelliteEnergy)*rootEase;
  r*=1.0+(uSatelliteFingerprint.x-.5)*.045*u*rootEase;
  vec3 p=vec3(cos(theta),sin(theta),0.0)*r;
  float thickness=sin(theta*1.7+twist)*uDepth*u*.22;
  p.z+=thickness+fold*uDepth*.34*rootEase;
  p.z+=(broad*.42+secondary*.17+organism*.13)*uMotionAmplitude*rootEase*(.4+.6*u);
  p.xy+=physicalCurrent*uCurrentStrength*u*u*(.34+.08*uSatelliteEnergy);
  float flutter=noiseField(u*5.4,v*8.5,t*2.3,uSeed+31.0);
  p.z+=flutter*uEdgeFlutter*tipEase*tipEase*(.18+.08*uSatelliteEnergy);
  p.xy+=vec2(-sin(theta),cos(theta))*flutter*uEdgeFlutter*tipEase*.064;
  float convective=max(0.0,uSatelliteCooling)*tipEase;
  p.z+=secondary*convective*uDepth*.18;
  float ct=cos(twist),st=sin(twist);
  p.yz=mat2(ct,-st,st,ct)*p.yz;
  return p;
}
void main(){
  vec3 p=membranePosition(aU,aV,aRayJitter);
  float eU=.0065;
  float eV=.0045;
  vec3 pu=membranePosition(min(1.0,aU+eU),aV,aRayJitter)-membranePosition(max(0.0,aU-eU),aV,aRayJitter);
  vec3 pv=membranePosition(aU,min(1.0,aV+eV),aRayJitter)-membranePosition(aU,max(0.0,aV-eV),aRayJitter);
  vec3 n=normalize(cross(pu,pv));
  vec4 world=modelMatrix*vec4(p,1.0);
  vWorldPos=world.xyz;
  vNormal=normalize(mat3(modelMatrix)*n);
  vFinUv=vec2(aU,aV);
  vRay=abs(sin((aV*uFoldDensity*1.91+aRayJitter*.18)*3.14159265));
  vFold=clamp(abs(p.z)/(max(uDepth,.05))*.9,0.0,1.0);
  float sideEdge=pow(abs(aV-.5)*2.0,6.0);
  vEdge=max(smoothstep(.78,1.0,aU),sideEdge);
  gl_Position=projectionMatrix*viewMatrix*world;
}
`;

export const BETTA_FRAGMENT_SHADER=`
precision highp float;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uOpacity;
uniform float uTransmission;
uniform float uRimStrength;
uniform float uFoldHighlight;
uniform float uIridescence;
uniform float uBloom;
uniform float uSaturation;
uniform float uBrightness;
uniform float uGradientPosition;
uniform float uLayerAlpha;
uniform float uTime;
uniform float uSeed;
uniform float uSatelliteEnergy;
uniform float uSatelliteCold;
uniform float uSatelliteVapor;
uniform float uSatelliteVisible;
uniform vec3 uSatelliteColor;
uniform vec3 uSatelliteFingerprint;
varying vec2 vFinUv;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vRay;
varying float vFold;
varying float vEdge;

float hash21(vec2 p){
  p=fract(p*vec2(123.34,456.21));
  p+=dot(p,p+45.32);
  return fract(p.x*p.y);
}
vec3 palette(float t){
  t=clamp(t,0.0,1.0);
  if(t<.34)return mix(uColor0,uColor1,t/.34);
  if(t<.7)return mix(uColor1,uColor2,(t-.34)/.36);
  return mix(uColor2,uColor3,(t-.7)/.3);
}
vec3 saturateColor(vec3 c,float s){
  float l=dot(c,vec3(.2126,.7152,.0722));
  return mix(vec3(l),c,s);
}
void main(){
  vec3 N=normalize(vNormal);
  if(!gl_FrontFacing)N=-N;
  vec3 V=normalize(cameraPosition-vWorldPos);
  float nv=clamp(abs(dot(N,V)),0.0,1.0);
  float fresnel=pow(1.0-nv,2.1);
  float rayRidge=pow(1.0-vRay,5.5);
  float micro=hash21(floor(vFinUv*vec2(211.0,377.0)+uSeed*17.0));
  float satelliteGradient=(uSatelliteFingerprint.x-.5)*.12+(uSatelliteCold-uSatelliteVapor)*.075;
  float gradient=clamp(vFinUv.x*.67+vFinUv.y*.28+uGradientPosition+satelliteGradient+.055*sin(vFinUv.y*13.0+uSeed),0.0,1.0);
  vec3 base=palette(gradient);
  vec3 satTint=saturateColor(max(uSatelliteColor,vec3(.02)),1.45);
  float satMix=clamp(.08+uSatelliteVisible*.18+uSatelliteVapor*.07,0.0,.34);
  base=mix(base,base*(.64+satTint*.82),satMix);
  float irShift=(fresnel*.65+vFold*.35)*uIridescence;
  irShift+=uSatelliteVapor*.08+(uSatelliteFingerprint.z-.5)*.055;
  base=mix(base,base.brg,clamp(irShift*.28,0.0,.38));
  base=saturateColor(base,uSaturation*(.94+.12*uSatelliteEnergy))*uBrightness;
  vec3 lightA=normalize(vec3(-.35,.72,.9));
  vec3 lightB=normalize(vec3(.72,-.28,.55));
  float wrapA=pow(clamp(dot(N,lightA)*.5+.5,0.0,1.0),2.2);
  float wrapB=pow(clamp(dot(N,lightB)*.5+.5,0.0,1.0),3.0);
  float foldLight=(wrapA*.72+wrapB*.28)*(vFold*.48+rayRidge*.68)*uFoldHighlight;
  float edgeLight=(fresnel*.7+vEdge*.3)*uRimStrength;
  float biologicalNoise=(micro-.5)*.045;
  vec3 transmitted=base*(.36+.44*uTransmission+.2*nv);
  vec3 lit=transmitted+base*(foldLight*.42+edgeLight*.25)+vec3(1.0,.82,.92)*edgeLight*uBloom*.13;
  lit+=satTint*uSatelliteCold*vFold*.045;
  lit+=biologicalNoise*base;
  float membrane=.42+.35*(1.0-uTransmission)+.22*(1.0-nv);
  float alpha=uOpacity*uLayerAlpha*membrane;
  alpha*=.72+.28*rayRidge;
  alpha+=vEdge*uOpacity*.09;
  alpha=clamp(alpha,0.025,.86);
  gl_FragColor=vec4(lit,alpha);
}
`;
