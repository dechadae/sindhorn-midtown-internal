from pathlib import Path
from urllib.request import urlopen
from io import BytesIO
import re
from PIL import Image

index=Path('site/index.html')
s=index.read_text()
s=s.replace('<html lang="en" style="background:#FAF7F5">','<html lang="en" class="app-shell">')
s=s.replace('<meta name="theme-color" content="#FAF7F5">','<meta name="theme-color" content="#2E273B">')
s=s.replace('<meta name="color-scheme" content="light dark">','<meta name="color-scheme" content="dark">')
s=s.replace('<meta name="fg-pwa" content="off">\n','')
s=re.sub(r'<script>\s*\(function\(\)\{\s*var key=\'sindhorn-midtown:pm25:theme:v1\';.*?</script>\s*','',s,count=1,flags=re.S)
head='''<link rel="manifest" href="/manifest.webmanifest">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="Sindhorn Midtown">\n<meta name="application-name" content="Sindhorn Midtown">\n<meta name="format-detection" content="telephone=no">\n'''
desc='<meta name="description" content="Live bilingual PM2.5 and Thai AQI report for Sindhorn Midtown Hotel Bangkok, using official Bangkok Metropolitan Administration data.">\n'
if head not in s:s=s.replace(desc,desc+head,1)
s=re.sub(r'<link rel="icon"[^>]*>','<link rel="icon" type="image/png" sizes="192x192" href="/icons/app-192.png">',s,count=1)
s=re.sub(r'<link rel="apple-touch-icon"[^>]*>','<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">',s,count=1)
full='''      <button class="fullscreen-toggle" type="button" id="fullscreenToggle" aria-pressed="false" aria-label="Enter full screen / เต็มหน้าจอ" title="Full screen / เต็มหน้าจอ">\n        <svg class="enter-fullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8.5 3.5h-5v5M15.5 3.5h5v5M8.5 20.5h-5v-5M20.5 15.5v5h-5"/></svg>\n        <svg class="exit-fullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8.5 8.5h-5v-5M15.5 8.5h5v-5M8.5 15.5h-5v5M20.5 20.5v-5h-5"/></svg>\n      </button>'''
s,n=re.subn(r'      <button class="theme-toggle"[^>]*>.*?      </button>',full,s,count=1,flags=re.S)
assert n==1
s=re.sub(r"\n\s*var THEME_KEY='[^']+';",'',s,count=1)
s=re.sub(r"\n\s*var themeQuery=.*?;",'',s,count=1)
s=s.replace("    saveImage:document.getElementById('saveImageBtn'),\n    theme:document.getElementById('themeToggle')","    saveImage:document.getElementById('saveImageBtn')")
s,n=re.subn(r'\n  function storedTheme\(\).*?\n  function updateMetric','\n  function updateMetric',s,count=1,flags=re.S)
assert n==1
s='\n'.join(line for line in s.splitlines() if 'themeQuery' not in line and 'applyTheme(' not in line and 'els.theme' not in line)
s=s.replace('.theme-toggle','.fullscreen-toggle')
if '<link rel="stylesheet" href="/pwa.css">' not in s:s=s.replace('<link rel="stylesheet" href="/environment.css">','<link rel="stylesheet" href="/environment.css">\n<link rel="stylesheet" href="/pwa.css">',1)
if '<script type="module" src="/app.js"></script>' not in s:s=s.replace('</body>','<script type="module" src="/app.js"></script>\n</body>',1)
index.write_text(s+'\n')

env=Path('site/environment.css')
e=env.read_text().replace('.theme-toggle','.fullscreen-toggle').replace('independent from UI theme','independent from app chrome')
env.write_text(e)

icons=Path('site/icons');icons.mkdir(parents=True,exist_ok=True)
url='https://sjpvhgxacsiorrtijqua.supabase.co/storage/v1/object/public/media/brand/sindhorn-midtown/v1/sindhorn-midtown-vignette-white.png'
logo=Image.open(BytesIO(urlopen(url,timeout=30).read())).convert('RGBA')
def make(size,name,ratio):
    canvas=Image.new('RGBA',(size,size),(46,39,59,255))
    w=int(size*ratio);h=int(w*logo.height/logo.width)
    im=logo.resize((w,h),Image.Resampling.LANCZOS)
    canvas.alpha_composite(im,((size-w)//2,(size-h)//2))
    canvas.convert('RGB').save(icons/name,'PNG',optimize=True)
make(192,'app-192.png',.76)
make(512,'app-512.png',.76)
make(512,'maskable-512.png',.58)
make(180,'apple-touch-icon.png',.72)

agents=Path('AGENTS.md')
a=agents.read_text().replace('Preserve its bilingual content, AirBKK behavior, caching, theme handling, accessibility, and readability improvements unless the user explicitly changes them.','Preserve its bilingual content, AirBKK behavior, caching, accessibility, and readability improvements unless the user explicitly changes them. The user has explicitly removed the UI theme system in favor of a realtime environment plus fullscreen app control.')
block='''## PWA / SPA architecture\n\n- This app is a full installable PWA with a single persistent HTML/WebGL shell.\n- Use History API client-side routes for `/`, `/guidance`, and `/details`; never force a full page reload for in-app navigation.\n- `manifest.webmanifest`, `sw.js`, `app.js`, and `pwa.css` are part of the canonical app shell.\n- The official Sindhorn Midtown / Vignette hotel lockup is the app icon artwork.\n- The top-right utility control is fullscreen, not a light/dark theme switch.\n- Day/night appearance is driven by realtime Bangkok astronomy and weather, never by a UI theme preference.\n- Service-worker navigation fallback must keep direct SPA routes and cached/offline use functional.\n\n'''
if block not in a:a=a.replace('## Real-time environment architecture\n',block+'## Real-time environment architecture\n')
agents.write_text(a)

doc=Path('docs/PWA-SPA-ARCHITECTURE.md')
doc.write_text('''# Sindhorn Midtown Internal — PWA / SPA Architecture\n\nThe logo/date masthead, realtime WebGL atmosphere and bottom navigation persist while route content changes client-side.\n\n## Routes\n- `/` — live PM2.5 / Thai AQI report followed by current weather.\n- `/guidance` — health guidance and AQI interpretation.\n- `/details` — reading details, source and methodology.\n\nNavigation uses the History API and Cloudflare Pages SPA fallback.\n\n## PWA\n`manifest.webmanifest` defines standalone/fullscreen-capable installation and uses the official hotel lockup for app icons. `sw.js` caches the same-origin app shell and falls back to `index.html` for offline SPA navigation.\n\n## Native-app interaction\nA persistent safe-area-aware bottom tab bar provides route navigation. The top utility button uses the browser Fullscreen API. Installed standalone mode respects device safe areas. Route changes use View Transitions where supported and respect reduced-motion preferences.\n\n## Environment rule\nThere is no UI light/dark theme. Physical day/night, sun position, clouds, rain and pollution are realtime environment state.\n''')
