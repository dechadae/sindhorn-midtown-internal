/* ===========================================================================
   flipgazine — Atmosphere. ONE copy, fetched by the homepage, the pilot deck
   and the CI page. Lives in site_files rather than the deploy because
   Cloudflare hosts only the shell; loaded via fetch + injected <script>, since
   a <script src="/fg-atmos.js"> would hit the SPA catch-all and come back as
   HTML.

   Colours are read from the CSS custom properties every frame, so it follows
   whatever palette the host page is showing with no wiring. It also exports
   window.FG_TILT so a glyph field can share the same smoothed camera.

   Requires: a <canvas id="glCanvas"> on the page.
   =========================================================================== */
(function(){
  var cv=document.getElementById("glCanvas");
  if(!cv) return;
  var gl=null;
  try{
    gl=cv.getContext("webgl",{antialias:false,powerPreference:"low-power"})
       || cv.getContext("experimental-webgl");
  }catch(e){}
  if(!gl){ cv.style.display="none"; return; }

  var vs="attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  /* One shader, shared. This engine carried its own fragment body, near
     identical to the one in fg-runtime.js but not identical -- two shaders
     drifting toward the same look, which is how the backgrounds ended up
     subtly different across the seven pages. fg-runtime's is now canonical
     and this is a straight copy of it, kept as a template literal rather than
     the old joined array so the two stay diffable by eye.
     The uniform interface was already the same on both sides -- u_res, u_time,
     u_light, u_scroll, u_base, u_base2, u_glow, u_ripples, u_ambient,
     u_accentc -- so nothing around this had to change. */
  var fs=`
    precision mediump float;
    uniform vec2 u_res; uniform float u_time;
    uniform vec2 u_light;      // tilt-driven light offset (limits applied in JS)
    uniform float u_scroll;    // 0..1
    uniform vec3 u_base;       // crossfaded background colour
    uniform float u_glow;      // theme glow intensity
    uniform vec4 u_ripples[3]; // xy=center(uv) z=age(s) w=strength
    uniform vec3 u_base2;      // second gradient stop
    uniform vec3 u_ambient;    // period ambient — the drifting light-field
    uniform vec3 u_accentc;    // period accent  — the touch ripples
    void main(){
      vec2 uv=gl_FragCoord.xy/u_res;
      vec2 p=uv-0.5; p.x*=u_res.x/u_res.y;
      /* linear-gradient(165deg, base 0%, base2 100%) reproduced in-shader.
         dir is the CSS angle in uv space with y up; 1.2247 is |x|+|y| of that
         unit vector, which normalises the projection across the viewport. */
      vec2 gdir=vec2(0.2588,-0.9659);
      float gt=clamp(0.5+dot(uv-0.5,gdir)/1.2247,0.0,1.0);
      vec3 col=mix(u_base,u_base2,gt);
      // three slow drifting teal light fields
      for(int i=0;i<3;i++){
        float fi=float(i);
        vec2 c=vec2(sin(u_time*0.05+fi*2.1)*0.34, cos(u_time*0.04+fi*1.6)*0.28);
        c+=u_light*(0.35+fi*0.06);
        c.y-=u_scroll*0.12;
        float d=length(p-c);
        float g=smoothstep(0.26,0.0,d)*(0.04+0.02*sin(u_time*0.3+fi));
        col+=u_ambient*g*u_glow*0.55;
      }
      // touch ripples — expanding rings, kept prominent on BOTH themes
      float lum=dot(u_base,vec3(0.299,0.587,0.114)); // ~0.07 dark · ~0.97 light
      for(int i=0;i<3;i++){
        vec4 r=u_ripples[i];
        if(r.w>0.001){
          vec2 rc=r.xy-0.5; rc.x*=u_res.x/u_res.y;
          float dist=length(p-rc);
          float radius=r.z*0.36;
          float ring=smoothstep(0.045,0.0,abs(dist-radius));     // thin ring
          float fill=smoothstep(radius,0.0,dist)*0.10;           // faint interior
          float life=clamp(1.0-r.z*1.1,0.0,1.0);
          float m=(ring+fill)*life*r.w;
          // dark bg: faint additive teal (whisper, not spotlight)
          col+=u_accentc*m*(1.0-lum)*0.28;
          // light bg: gentle blend toward teal, kept subtle
          col=mix(col,vec3(0.0,0.55,0.47),clamp(m*lum*0.6,0.0,0.30));
        }
      }
      gl_FragColor=vec4(col,1.0);
    }`;

  function sh(t,s){ var o=gl.createShader(t); gl.shaderSource(o,s); gl.compileShader(o);
    return gl.getShaderParameter(o,gl.COMPILE_STATUS)?o:null; }
  var v=sh(gl.VERTEX_SHADER,vs), f=sh(gl.FRAGMENT_SHADER,fs);
  if(!v||!f){ cv.style.display="none"; return; }
  var prog=gl.createProgram();
  gl.attachShader(prog,v); gl.attachShader(prog,f); gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){ cv.style.display="none"; return; }
  gl.useProgram(prog);

  var buf=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  var loc=gl.getAttribLocation(prog,"p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);

  var U={};
  ["u_res","u_time","u_light","u_scroll","u_base","u_base2","u_glow","u_ambient","u_accentc"]
    .forEach(function(n){ U[n]=gl.getUniformLocation(prog,n); });
  U.u_ripples=gl.getUniformLocation(prog,"u_ripples[0]");

  var W=0,H=0;
  function resize(){
    var pr=Math.min(window.devicePixelRatio||1,2);
    W=window.innerWidth; H=window.innerHeight;
    cv.width=Math.round(W*pr); cv.height=Math.round(H*pr);
    cv.style.width=W+"px"; cv.style.height=H+"px";
    gl.viewport(0,0,cv.width,cv.height);
  }
  resize();
  addEventListener("resize",resize,{passive:true});

  var cs=getComputedStyle(document.documentElement);
  function rgbVar(name,fb){
    var s=cs.getPropertyValue(name).trim();
    var m=s.match(/(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)/);
    return m ? [ +m[1]/255, +m[2]/255, +m[3]/255 ] : fb;
  }

  /* ---- camera ---------------------------------------------------------------
     Read from fg-motion.js when it is present. This engine used to track tilt
     and pointer itself and publish window.FG_TILT, which meant two independent
     motion sources on a page that ran both -- the shader damped its own copy
     while the glyph layer damped another, and they could disagree about where
     the light was coming from.
     Its own tracker is kept as a fallback so this file still works alone on a
     page without fg-motion. Note the scaling differs slightly: the shared store
     divides gyro by 30 where this used 45, so tilt reads a little stronger now.
     One source is worth the small change. */
  var shared = window.FGMotion || null;
  /* Always a local object, never the shared one. This engine writes to tilt
     every frame, and the shared store is read by the glyph layer too -- writing
     into it would have one module quietly editing another's state.
     It is also a combined camera: this file's original tgt was written by both
     deviceorientation and pointermove, so "tilt" here has always meant pointer
     plus gyro. The shared store keeps those apart, so they are recombined here
     rather than reading tilt alone, which is gyro only and stays at zero on a
     mouse. */
  var tilt = {x:0,y:0};
  var tgt  = shared ? null : {x:0,y:0};
  /* The glyph field on these pages reads FG_TILT and expects the same combined
     camera the shader uses, so it is pointed at the local combined object in
     both modes. fg-motion defines FG_TILT as a gyro-only getter, deliberately
     configurable so this can take it over where an engine has a richer camera
     to offer. Redefined rather than assigned: a getter-only property ignores
     assignment silently, which would have looked like it worked. */
  try{
    Object.defineProperty(window,"FG_TILT",{value:tilt,writable:true,configurable:true});
  }catch(e){ window.FG_TILT=tilt; }

  if(!shared){
    addEventListener("deviceorientation",function(e){
      if(e.gamma==null && e.beta==null) return;
      tgt.x=Math.max(-1,Math.min(1,(e.gamma||0)/45));
      tgt.y=Math.max(-1,Math.min(1,((e.beta||0)-45)/45));
    },{passive:true});
    addEventListener("pointermove",function(e){
      if(e.pointerType==="touch") return;
      tgt.x=(e.clientX/Math.max(1,W)-0.5)*2;
      tgt.y=(e.clientY/Math.max(1,H)-0.5)*2;
    },{passive:true});
  }

  var rip=[];
  function rand(a,b){ return a+Math.random()*(b-a); }
  function addRipple(x,y,primary){
    if(rip.length>=3) rip.shift();
    rip.push({x:x/Math.max(1,W), y:1-(y/Math.max(1,H)),
              start:performance.now()/1000,
              dur:primary?rand(0.7,1.0):rand(0.4,0.7),
              s:primary?1.0:0.4});
  }
  addEventListener("pointerdown",function(e){
    addRipple(e.clientX,e.clientY,true);
    if(e.pointerType==="touch") addRipple(e.clientX+rand(-26,26),e.clientY+rand(-26,26),false);
  },{passive:true});

  var rbuf=new Float32Array(12), t0=performance.now(), running=true, elapsed=0;
  document.addEventListener("visibilitychange",function(){
    running=!document.hidden;
    if(running){ t0=performance.now()-elapsed*1000; requestAnimationFrame(frame); }
  });

  function frame(now){
    if(!running) return;
    elapsed=(now-t0)/1000;
    if(tgt){
      /* Running alone: damp our own target. */
      tilt.x+=(tgt.x-tilt.x)*0.06;
      tilt.y+=(tgt.y-tilt.y)*0.06;
    } else {
      /* Shared store: already damped by fg-motion, so take it straight and only
         recombine. Same weighting the editorial pages use for u_light --
         pointer at half, gyro at full, clamped to the unit range. */
      var cx = shared.pointer.x*0.5 + shared.tilt.x;
      var cy = shared.pointer.y*0.5 + shared.tilt.y;
      tilt.x = Math.max(-1,Math.min(1,cx));
      tilt.y = Math.max(-1,Math.min(1,cy));
    }
    var base=rgbVar("--bg",[0.05,0.07,0.06]);
    var base2=rgbVar("--bg2",base);
    var amb =rgbVar("--ambient",[0,0.94,0.82]);
    var acc =rgbVar("--accent",[0,0.94,0.82]);
    var lum =0.299*base[0]+0.587*base[1]+0.114*base[2];
    var h=document.documentElement;
    var mx=h.scrollHeight-h.clientHeight;
    var sp=mx>0 ? Math.min(1,Math.max(0,(h.scrollTop||document.body.scrollTop)/mx)) : 0;
    gl.uniform2f(U.u_res,cv.width,cv.height);
    /* Same seeding as the inline engines: one clock, two implementations. */
    gl.uniform1f(U.u_time,elapsed+(window.FGClock?window.FGClock.seed():0));
    if(window.FGClock) window.FGClock.mark(elapsed);
    gl.uniform2f(U.u_light,tilt.x*0.09,-tilt.y*0.09);
    gl.uniform1f(U.u_scroll,sp);
    gl.uniform3f(U.u_base,base[0],base[1],base[2]);
    gl.uniform3f(U.u_base2,base2[0],base2[1],base2[2]);
    gl.uniform1f(U.u_glow,lum<0.5?0.7:0.0);
    gl.uniform3f(U.u_ambient,amb[0],amb[1],amb[2]);
    gl.uniform3f(U.u_accentc,acc[0],acc[1],acc[2]);
    var nowS=performance.now()/1000, k=0;
    for(var i=0;i<rip.length;i++){
      var age=nowS-rip[i].start;
      if(age>rip[i].dur) continue;
      rbuf[k*4]=rip[i].x; rbuf[k*4+1]=rip[i].y; rbuf[k*4+2]=age; rbuf[k*4+3]=rip[i].s; k++;
      if(k>=3) break;
    }
    for(var j=k;j<3;j++){ rbuf[j*4]=0; rbuf[j*4+1]=0; rbuf[j*4+2]=0; rbuf[j*4+3]=0; }
    gl.uniform4fv(U.u_ripples,rbuf);
    gl.drawArrays(gl.TRIANGLES,0,3);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
