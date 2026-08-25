from pathlib import Path
import glob
import shutil

ROOT=Path('.')


def require(text, needle, label):
    if needle not in text:
        raise SystemExit(f'missing {label}: {needle[:80]}')


def copy_font(package, script, weight, dest):
    root=Path('node_modules')/'@fontsource'/package/'files'
    patterns=[f'*{script}-{weight}-normal.woff2',f'*-{weight}-normal.woff2']
    for pattern in patterns:
        matches=sorted(root.glob(pattern))
        if matches:
            Path(dest).parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(matches[0],dest)
            return
    raise SystemExit(f'font not found: {package} {script} {weight}')

# Self-host Noto and html2canvas.
for weight in (200,300,400,500,600):
    copy_font('noto-sans','latin',weight,f'site/assets/fonts/noto-sans-{weight}.woff2')
for weight in (300,400,500,600):
    copy_font('noto-sans-thai','thai',weight,f'site/assets/fonts/noto-sans-thai-{weight}.woff2')
Path('site/vendor').mkdir(parents=True,exist_ok=True)
shutil.copyfile('node_modules/html2canvas/dist/html2canvas.min.js','site/vendor/html2canvas.min.js')

# index.html: Noto everywhere, explicit Thai live status, 10% smaller logo, long-page capture.
p=Path('site/index.html')
s=p.read_text()
old_preload='<link rel="preload" as="font" type="font/woff" crossorigin href="/assets/fonts/vignette-sans-light.woff">\n<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/ibm-plex-sans-thai-light.woff2">'
require(s,old_preload,'font preload')
s=s.replace(old_preload,'<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/noto-sans-300.woff2">\n<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/noto-sans-thai-300.woff2">',1)
start=s.index('@font-face{font-family:"Vignette Sans"')
end=s.index(':root{',start)
font_faces='''@font-face{font-family:"Noto Sans";src:url("/assets/fonts/noto-sans-200.woff2") format("woff2");font-style:normal;font-weight:200;font-display:swap}\n@font-face{font-family:"Noto Sans";src:url("/assets/fonts/noto-sans-300.woff2") format("woff2");font-style:normal;font-weight:300;font-display:swap}\n@font-face{font-family:"Noto Sans";src:url("/assets/fonts/noto-sans-400.woff2") format("woff2");font-style:normal;font-weight:400;font-display:swap}\n@font-face{font-family:"Noto Sans";src:url("/assets/fonts/noto-sans-500.woff2") format("woff2");font-style:normal;font-weight:500;font-display:swap}\n@font-face{font-family:"Noto Sans";src:url("/assets/fonts/noto-sans-600.woff2") format("woff2");font-style:normal;font-weight:600;font-display:swap}\n@font-face{font-family:"Noto Sans Thai";src:url("/assets/fonts/noto-sans-thai-300.woff2") format("woff2");font-style:normal;font-weight:300;font-display:swap}\n@font-face{font-family:"Noto Sans Thai";src:url("/assets/fonts/noto-sans-thai-400.woff2") format("woff2");font-style:normal;font-weight:400;font-display:swap}\n@font-face{font-family:"Noto Sans Thai";src:url("/assets/fonts/noto-sans-thai-500.woff2") format("woff2");font-style:normal;font-weight:500;font-display:swap}\n@font-face{font-family:"Noto Sans Thai";src:url("/assets/fonts/noto-sans-thai-600.woff2") format("woff2");font-style:normal;font-weight:600;font-display:swap}\n'''
s=s[:start]+font_faces+s[end:]
s=s.replace('font-family:"Vignette Sans","Trebuchet MS",sans-serif','font-family:"Noto Sans",system-ui,sans-serif')
s=s.replace(':lang(th){font-family:"IBM Plex Sans Thai","Noto Sans Thai",sans-serif;',':lang(th){font-family:"Noto Sans Thai","Noto Sans",sans-serif;')
s=s.replace('.brand-lockup{position:relative;width:clamp(132px,38vw,188px);','.brand-lockup{position:relative;width:clamp(119px,34vw,169px);')
s=s.replace('.brand-lockup{width:clamp(150px,20vw,188px)}','.brand-lockup{width:clamp(135px,18vw,169px)}')
old_conn='<span id="connectionText">Connecting</span>'
require(s,old_conn,'connection markup')
s=s.replace(old_conn,'<span id="connectionText"><span id="connectionEn">Connecting</span><span aria-hidden="true"> / </span><span id="connectionTh" lang="th">กำลังเชื่อมต่อ</span></span>',1)
old_ref="connectionText:document.getElementById('connectionText'),"
require(s,old_ref,'connection refs')
s=s.replace(old_ref,old_ref+"\n    connectionEn:document.getElementById('connectionEn'),\n    connectionTh:document.getElementById('connectionTh'),",1)
old_fn="""  function connection(state,en,th){\n    els.connection.setAttribute('data-state',state);\n    setText(els.connectionText,en+' / '+th);\n  }"""
require(s,old_fn,'connection function')
s=s.replace(old_fn,"""  function connection(state,en,th){\n    els.connection.setAttribute('data-state',state);\n    setText(els.connectionEn,en);\n    setText(els.connectionTh,th);\n  }""",1)
s=s.replace('Save compact image / <span lang="th">บันทึกภาพ</span>','Save full page / <span lang="th">บันทึกทั้งหน้า</span>',1)
css_link='<link rel="stylesheet" href="/ci-ui.css">'
require(s,css_link,'CI CSS link')
s=s.replace(css_link,css_link+'\n<script src="/vendor/html2canvas.min.js" defer></script>',1)

save_start=s.index('  function roundedRect(ctx')
save_end=s.index('  function onVisibility()',save_start)
full_capture=r'''  function homeImageFilename(){
    var parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    var obj={};parts.forEach(function(part){obj[part.type]=part.value;});return 'sindhorn-midtown-air-quality-full-'+obj.year+'-'+obj.month+'-'+obj.day+'.png';
  }
  function blobFromCanvas(canvas){return new Promise(function(resolve){canvas.toBlob(resolve,'image/png',1);});}
  async function saveFullPage(){
    if(!els.saveImage)return;
    var pm=els.pm.textContent.trim(),aqi=els.aqi.textContent.trim();
    if(!/^\d+(\.\d+)?$/.test(pm)||!/^\d+$/.test(aqi)){
      var waiting=els.saveImage.innerHTML;els.saveImage.textContent='Waiting for data / รอข้อมูล';setTimeout(function(){els.saveImage.innerHTML=waiting;},1800);return;
    }
    if(!window.html2canvas){els.saveImage.textContent='Capture unavailable / ไม่สามารถบันทึกภาพ';return;}
    var original=els.saveImage.innerHTML,atmosphere=null;
    els.saveImage.disabled=true;els.saveImage.textContent='Preparing full page / กำลังสร้างภาพทั้งหน้า';
    try{
      if(document.fonts&&document.fonts.ready)await Promise.race([document.fonts.ready,new Promise(function(resolve){setTimeout(resolve,1200);})]);
      document.body.classList.add('capture-home');
      await new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});});
      var width=Math.ceil(document.documentElement.clientWidth);
      var height=Math.ceil(document.body.scrollHeight);
      if(window.SindhornEnvironment&&window.SindhornEnvironment.renderExport){
        var data=await window.SindhornEnvironment.renderExport(width*2,height*2);
        atmosphere=document.createElement('img');atmosphere.className='capture-atmosphere';atmosphere.alt='';atmosphere.setAttribute('aria-hidden','true');
        await new Promise(function(resolve,reject){atmosphere.onload=resolve;atmosphere.onerror=reject;atmosphere.src=data;document.body.prepend(atmosphere);});
      }
      var canvas=await window.html2canvas(document.body,{backgroundColor:'#2E273B',scale:2,useCORS:true,logging:false,width:width,height:height,windowWidth:width,windowHeight:height,scrollX:0,scrollY:0});
      var blob=await blobFromCanvas(canvas);if(!blob)throw new Error('PNG failed');
      var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=homeImageFilename();document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},2500);els.saveImage.textContent='Saved / บันทึกแล้ว';
    }catch(error){console.warn('Full-page capture failed',error);els.saveImage.textContent='Try again / ลองอีกครั้ง';}
    finally{if(atmosphere)atmosphere.remove();document.body.classList.remove('capture-home');setTimeout(function(){els.saveImage.innerHTML=original;els.saveImage.disabled=false;},1800);}
  }
'''
s=s[:save_start]+full_capture+s[save_end:]
old_listener="if(els.saveImage)els.saveImage.addEventListener('click',saveCompactImage);"
require(s,old_listener,'save listener')
s=s.replace(old_listener,"if(els.saveImage)els.saveImage.addEventListener('click',saveFullPage);",1)
p.write_text(s)

# CI CSS: Noto + Voice footer + capture mode.
p=Path('site/ci-ui.css')
s=p.read_text()
s=s.replace('Vignette Sans + IBM Plex Sans Thai','Noto Sans + Noto Sans Thai')
s=s.replace('"Vignette Sans","Trebuchet MS",sans-serif','"Noto Sans",system-ui,sans-serif')
s=s.replace('"IBM Plex Sans Thai","Noto Sans Thai",sans-serif','"Noto Sans Thai","Noto Sans",sans-serif')
s+=r'''

/* v13 — Noto typography, Voice footer, full-page capture. */
body,button,a,input,textarea,select{font-family:"Noto Sans",system-ui,sans-serif!important}
:lang(th),.connection-th{font-family:"Noto Sans Thai","Noto Sans",sans-serif!important}
.brand-lockup{width:clamp(97px,25vw,122px)!important}
.connection #connectionTh{font-family:"Noto Sans Thai","Noto Sans",sans-serif!important;font-weight:400!important;letter-spacing:0!important;text-transform:none!important}
body.app-spa-ready{padding-bottom:calc(58px + env(safe-area-inset-bottom))!important}
.app-tabbar.bottom-nav{position:fixed!important;left:0!important;right:0!important;bottom:0!important;z-index:100!important;transform:none!important;width:100%!important;max-width:none!important;min-height:50px!important;display:flex!important;gap:8px!important;align-items:center!important;justify-content:safe center!important;overflow-x:auto!important;overscroll-behavior-x:contain!important;scrollbar-width:none!important;-webkit-overflow-scrolling:touch!important;padding-block:9px!important;padding-bottom:calc(9px + env(safe-area-inset-bottom))!important;padding-inline:max(var(--sm-gutter),calc((100% - var(--sm-max))/2 + var(--sm-gutter)))!important;border:0!important;border-top:1px solid var(--sm-glass-brd)!important;border-radius:0!important;background:rgba(46,39,59,.68)!important;box-shadow:none!important;backdrop-filter:blur(22px) saturate(1.35)!important;-webkit-backdrop-filter:blur(22px) saturate(1.35)!important}
.app-tabbar.bottom-nav::-webkit-scrollbar{display:none!important}
.app-tabbar.bottom-nav .nav-chip{flex:0 0 auto!important;white-space:nowrap!important;min-width:0!important;height:32px!important;min-height:32px!important;padding:0 14px!important;border-radius:16px!important;border:1px solid var(--sm-glass-brd)!important;background:rgba(46,39,59,.34)!important;color:var(--sm-muted)!important;font-size:.64rem!important;font-weight:600!important;letter-spacing:.09em!important;text-transform:uppercase!important;transition:color .28s var(--sm-soft),border-color .28s var(--sm-soft),background .28s var(--sm-soft),transform .16s var(--sm-ease),box-shadow .28s var(--sm-soft)!important}
.app-tabbar.bottom-nav .nav-chip small{display:inline!important;margin-left:4px!important;color:inherit!important;font-family:"Noto Sans Thai","Noto Sans",sans-serif!important;font-size:.95em!important;font-weight:400!important;letter-spacing:0!important;text-transform:none!important;opacity:.76!important}
.app-tabbar.bottom-nav .nav-chip.is-active,.app-tabbar.bottom-nav .nav-chip.on{color:var(--sm-accent)!important;border-color:var(--sm-accent)!important;background:rgba(var(--sm-accent-rgb),.055)!important;box-shadow:0 0 18px rgba(var(--sm-accent-rgb),.07)!important;transform:translateY(-1px)!important}
.app-tabbar.bottom-nav .nav-chip:active{transform:scale(.965)!important}
body.capture-home{position:relative!important;padding-bottom:0!important;background:#2E273B!important;overflow:visible!important}
body.capture-home .masthead,body.capture-home .app-footer,body.capture-home .app-tabbar,body.capture-home .report-actionbar,body.capture-home .environment-stage{display:none!important}
body.capture-home main{position:relative!important;z-index:2!important;padding-top:0!important;padding-bottom:38px!important}
.capture-atmosphere{position:absolute!important;z-index:0!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;pointer-events:none!important}
@media(max-width:520px){.brand-lockup{width:99px!important}.app-tabbar.bottom-nav{gap:7px!important;padding-left:20px!important;padding-right:20px!important}.app-tabbar.bottom-nav .nav-chip{font-size:.61rem!important;padding-inline:12px!important}}
@media(max-width:350px){.brand-lockup{width:94px!important}.app-tabbar.bottom-nav{justify-content:flex-start!important}}
'''
p.write_text(s)

# Environment CSS: reveal the actual weather field equally on mobile and desktop.
p=Path('site/environment.css')
s=p.read_text()
s+=r'''

/* v13 high-fidelity environment: equal visible quality on mobile and desktop. */
.environment-stage::before{background:linear-gradient(180deg,rgba(22,19,29,.08) 0%,rgba(22,19,29,.055) 34%,rgba(25,21,31,.13) 68%,rgba(24,20,30,.24) 100%)}
.environment-canvas{image-rendering:auto;transform:translateZ(0);will-change:transform}
@media(max-width:699px){.environment-stage::before{background:linear-gradient(180deg,rgba(22,19,29,.08) 0%,rgba(22,19,29,.055) 34%,rgba(25,21,31,.13) 68%,rgba(24,20,30,.24) 100%)}}
'''
p.write_text(s)

# Service worker: v13 shell and Noto/html2canvas cache; retain push handlers.
p=Path('site/sw.js')
s=p.read_text()
require(s,"sindhorn-midtown-internal-pwa-v12",'SW v12')
s=s.replace("sindhorn-midtown-internal-pwa-v12","sindhorn-midtown-internal-pwa-v13",1)
old_fonts="'/assets/fonts/vignette-sans-light.woff','/assets/fonts/vignette-sans-regular.woff','/assets/fonts/vignette-sans-semibold.woff',\n  '/assets/fonts/ibm-plex-sans-thai-light.woff2','/assets/fonts/ibm-plex-sans-thai-regular.woff2','/assets/fonts/ibm-plex-sans-thai-semibold.woff2'"
require(s,old_fonts,'old SW fonts')
new_fonts="'/assets/fonts/noto-sans-200.woff2','/assets/fonts/noto-sans-300.woff2','/assets/fonts/noto-sans-400.woff2','/assets/fonts/noto-sans-500.woff2','/assets/fonts/noto-sans-600.woff2',\n  '/assets/fonts/noto-sans-thai-300.woff2','/assets/fonts/noto-sans-thai-400.woff2','/assets/fonts/noto-sans-thai-500.woff2','/assets/fonts/noto-sans-thai-600.woff2','/vendor/html2canvas.min.js'"
s=s.replace(old_fonts,new_fonts,1)
require(s,"self.addEventListener('push'",'push handler')
require(s,"self.addEventListener('notificationclick'",'notification click handler')
p.write_text(s)

# Version markers.
p=Path('site/version.txt')
s=p.read_text()
for line in ('environment: weather-first-full-quality-tilt-v13\n','ui: noto-voice-footer-luxury-transitions-v13\n','capture: full-home-atmosphere-v13\n'):
    if line not in s:s+=line
p.write_text(s)

# Canonical docs.
p=Path('AGENTS.md')
s=p.read_text()
old='''- Respect `prefers-reduced-motion` and mobile performance constraints.\n- Stop or heavily throttle rendering when hidden or offscreen.'''
if old in s:
    s=s.replace(old,'''- The user explicitly requires full atmospheric motion and full visual quality on mobile; do not lower renderer DPR, cloud complexity, animation cadence, or celestial quality relative to desktop.\n- Mobile device tilt is part of the default atmosphere. Use DeviceOrientation continuously where the platform allows it; on iOS request permission from the first user gesture because the OS requires that gesture.\n- Stop rendering only when the document is actually hidden; do not degrade the visible scene.''',1)
if '## v13 visual authority' not in s:
    s+='''\n## v13 visual authority\n\n- App typography is Noto Sans / Noto Sans Thai throughout UI and content. The official hotel logo remains artwork.\n- Realtime atmosphere resolves **weather first** (sky, sun/moon, clouds, precipitation, visibility), then applies PM2.5 haze/extinction and suspended particulate as the final optical layer.\n- The sticky footer follows the Flipgazine Voice bottom-nav contract: full-width frosted rail with independent compact navigation chips.\n- Save Image means a full-length capture of the Today route atmosphere/content; masthead, sticky footer, app footer and the Save button itself are excluded.\n'''
p.write_text(s)

p=Path('docs/REALTIME-ENVIRONMENT-PLAN.md')
s=p.read_text()
old_perf='''## Performance\n\n- HTML is always the functional layer.\n- Cap mobile device pixel ratio.\n- Prefer approximately 30 fps for slow ambient motion.\n- Respect `prefers-reduced-motion`.\n- Stop rendering when the page is hidden; throttle where appropriate.\n- Avoid heavy post-processing and large environment textures.'''
new_perf='''## Rendering fidelity authority\n\n- HTML remains the functional layer, but the visible WebGL environment must use the same quality target on mobile and desktop.\n- Renderer DPR is fixed at 2 for the current app; do not reduce quality based on device-memory or hardware-concurrency heuristics.\n- Render ambient motion on every display-synchronised animation frame while the app is visible.\n- Do not disable atmospheric motion because of `prefers-reduced-motion`; the user explicitly chose a continuously living environmental surface.\n- Stop rendering when the document is actually hidden.\n- Mobile tilt is always part of the visual system. Android/device-orientation capable browsers attach immediately; iOS requests orientation permission from the first user gesture as required by the platform.\n- Weather resolves first. Clouds, overcast, fog, rain and storm state must be visibly represented from the weather code and cloud cover before any PM2.5 optics are applied.\n- PM2.5 is a final optical layer: haze, saturation/contrast loss, solar diffusion and suspended particulate. It never invents cloud/rain/weather.\n- Celestial edges must be high precision and anti-aliased; the moon must not degrade to a pixelated sprite.'''
if old_perf in s:s=s.replace(old_perf,new_perf,1)
if '## Full-page capture' not in s:
    s+='''\n## Full-page capture\n\nThe Save action captures the complete Today route as a long PNG using the live HTML composition plus an offscreen full-resolution render of the same current environment state. It excludes the masthead, sticky navigation/footer, reference footer and Save control. This is a web-app capture feature, not generated imagery.\n'''
p.write_text(s)

p=Path('docs/CI-UI-ADAPTATION.md')
s=p.read_text()
if '## v13 typography and footer authority' not in s:
    s+='''\n\n## v13 typography and footer authority\n\n- Noto Sans is the app-wide English/UI typeface; Noto Sans Thai is mandatory for Thai glyphs, including mixed status copy such as `ข้อมูลล่าสุด`.\n- English remains eminent through scale, tracking and placement; Thai remains correctly shaped and readable.\n- Header logo artwork is reduced by 10% from the v12 size.\n- Guidance/Details route kickers are semantic (`AIR QUALITY CARE`, `CURRENT OBSERVATION`) with no redundant page numbers.\n- Sticky navigation uses the Flipgazine Voice-page footer contract: edge-to-edge frosted rail, compact independent chips, no oversized rounded dock.\n- Route changes use a short out/in depth transition while header, environment and sticky footer remain persistent.\n'''
p.write_text(s)
