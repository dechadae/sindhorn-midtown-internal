from pathlib import Path

path=Path('site/betta-environment.js')
s=path.read_text()

old="let initialized=false,stage=null,canvas=null,renderer=null,scene=null,camera=null,sharedGeometry=null,raf=0,activeTime=0,previousNow=performance.now(),firstFrameRendered=false;"
new="let initialized=false,stage=null,canvas=null,renderer=null,scene=null,camera=null,sharedGeometry=null,backgroundMesh=null,backgroundMaterial=null,raf=0,activeTime=0,previousNow=performance.now(),firstFrameRendered=false;"
assert old in s
s=s.replace(old,new,1)

anchor="function color(hex){return new THREE.Color(hex)}\n"
insert="""function color(hex){return new THREE.Color(hex)}
const BACKGROUND_VERTEX_SHADER=`
varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,1.0,1.0);}
`;
const BACKGROUND_FRAGMENT_SHADER=`
precision highp float;
uniform vec3 uBg0From;uniform vec3 uBg1From;uniform vec3 uBg2From;
uniform vec3 uBg0To;uniform vec3 uBg1To;uniform vec3 uBg2To;
uniform float uMix;uniform vec3 uSatelliteColor;uniform float uSatelliteMix;
varying vec2 vUv;
void main(){
  vec2 p=vUv;
  vec3 c0=mix(uBg0From,uBg0To,uMix),c1=mix(uBg1From,uBg1To,uMix),c2=mix(uBg2From,uBg2To,uMix);
  float radial=smoothstep(.06,1.0,length((p-vec2(.61,.36))*vec2(.82,1.04)));
  float sweep=smoothstep(.18,.94,p.x*.62+(1.0-p.y)*.38);
  vec3 bg=mix(c0,c1,clamp(radial*.74+p.y*.10,0.0,1.0));
  bg=mix(bg,c2,sweep*.48);
  bg=mix(bg,bg*(.82+uSatelliteColor*.34),uSatelliteMix);
  float vignette=1.0-.22*smoothstep(.38,.92,length((p-.5)*vec2(.92,1.08)));
  gl_FragColor=vec4(bg*vignette,1.0);
}
`;
function gradientFor(preset){const g=preset.backgroundGradient;return Array.isArray(g)&&g.length>=3?g:[preset.background,preset.background,preset.background]}
function buildBackground(preset){
  const g=gradientFor(preset),sat=satellite.current;
  backgroundMaterial=new THREE.ShaderMaterial({vertexShader:BACKGROUND_VERTEX_SHADER,fragmentShader:BACKGROUND_FRAGMENT_SHADER,depthTest:false,depthWrite:false,transparent:false,toneMapped:false,uniforms:{uBg0From:{value:color(g[0])},uBg1From:{value:color(g[1])},uBg2From:{value:color(g[2])},uBg0To:{value:color(g[0])},uBg1To:{value:color(g[1])},uBg2To:{value:color(g[2])},uMix:{value:1},uSatelliteColor:{value:new THREE.Vector3(...sat.color)},uSatelliteMix:{value:.025+.025*sat.cloud+.018*sat.visible}}});
  backgroundMesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),backgroundMaterial);backgroundMesh.frustumCulled=false;backgroundMesh.renderOrder=-1000;scene.add(backgroundMesh);
}
function applyBackgroundFrame(from,to,e){if(!backgroundMaterial)return;const fg=gradientFor(from),tg=gradientFor(to),u=backgroundMaterial.uniforms;for(let i=0;i<3;i++){u['uBg'+i+'From'].value.copy(color(fg[i]));u['uBg'+i+'To'].value.copy(color(tg[i]))}u.uMix.value=e}
"""
assert anchor in s
s=s.replace(anchor,insert,1)

old_apply="""function applyPresetFrame(from,to,t){
  const e=clamp(t),fromBg=color(from.background),toBg=color(to.background);active=to;activeKey=e>=1?dayCycle.targetPeriod?.baseline||to.__key||activeKey:activeKey;"""
new_apply="""function applyPresetFrame(from,to,t){
  const e=clamp(t);active=to;activeKey=e>=1?dayCycle.targetPeriod?.baseline||to.__key||activeKey:activeKey;applyBackgroundFrame(from,to,e);"""
assert old_apply in s
s=s.replace(old_apply,new_apply,1)

old_bg="  const tint=new THREE.Color(satellite.current.color[0],satellite.current.color[1],satellite.current.color[2]),base=fromBg.lerp(toBg,e);scene.background=base.lerp(tint,.025+.025*satellite.current.cloud+.018*satellite.current.visible);\n"
assert old_bg in s
s=s.replace(old_bg,"",1)

old_sat="function applySatelliteUniforms(){const s=satellite.current;for(const material of materials){const u=material.uniforms;u.uCurrent.value.set(s.motion[0],s.motion[1]);u.uSatelliteEnergy.value=s.energy;u.uSatelliteCloud.value=s.cloud;u.uSatelliteCold.value=s.cold;u.uSatelliteCooling.value=s.cooling;u.uSatelliteTexture.value=s.texture;u.uSatelliteVapor.value=s.vapor;u.uSatelliteVisible.value=s.visible;u.uSatelliteMotion.value.set(s.motion[0],s.motion[1]);u.uSatelliteColor.value.set(s.color[0],s.color[1],s.color[2]);u.uSatelliteFingerprint.value.set(s.fingerprint[0],s.fingerprint[1],s.fingerprint[2])}}"
new_sat=old_sat[:-1]+"if(backgroundMaterial){backgroundMaterial.uniforms.uSatelliteColor.value.set(s.color[0],s.color[1],s.color[2]);backgroundMaterial.uniforms.uSatelliteMix.value=.025+.025*s.cloud+.018*s.visible}}"
assert old_sat in s
s=s.replace(old_sat,new_sat,1)

old_init="stage.hidden=false;resize();buildFins();updateDayCycleDatasets();"
new_init="stage.hidden=false;resize();scene.background=color('#010103');buildBackground(active);buildFins();updateDayCycleDatasets();"
assert old_init in s
s=s.replace(old_init,new_init,1)

path.write_text(s)

for cleanup in [Path('scripts/patch-betta-gradient.py'),Path('.github/workflows/betta-gradient-background-patch.yml'),Path('.github/workflows/betta-gradient-background-apply.yml')]:
    if cleanup.exists(): cleanup.unlink()
