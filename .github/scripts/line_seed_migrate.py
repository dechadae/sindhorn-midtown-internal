from pathlib import Path
import hashlib
import json
import re

ROOT=Path('.')
SITE=ROOT/'site'

LEGACY_FAMILY_RE=re.compile(r'(?i)(?:Vignette Sans|Noto Sans Thai|Noto Sans|Poppins|IBM Plex Sans Thai)')
OLD_FONT_FILE_RE=re.compile(r'(?i)(?:poppins|noto-sans|ibm-plex-sans-thai|vignette-sans)[^\s\"\')]*\.(?:woff2?|ttf|otf)')
WEIGHT_MAP={100:100,200:100,300:400,400:400,500:400,600:700,650:700,700:700,720:700,750:700,780:700,800:700,900:700}

FONTS_CSS='''@font-face{font-family:"LINE Seed Sans TH";src:url("/assets/fonts/line-seed-sans-th-thin.woff2") format("woff2");font-style:normal;font-weight:100;font-display:swap}
@font-face{font-family:"LINE Seed Sans TH";src:url("/assets/fonts/line-seed-sans-th-regular.woff2") format("woff2");font-style:normal;font-weight:400;font-display:swap}
@font-face{font-family:"LINE Seed Sans TH";src:url("/assets/fonts/line-seed-sans-th-bold.woff2") format("woff2");font-style:normal;font-weight:700;font-display:swap}
:root{--font-ui:"LINE Seed Sans TH"}
html,body,button,input,select,textarea,option,dialog{font-family:var(--font-ui)!important;font-synthesis:none}
body *{font-family:var(--font-ui)!important;font-synthesis:none}
*,*::before,*::after{letter-spacing:0!important}
:lang(th),[lang="th"]{font-family:var(--font-ui)!important;letter-spacing:0!important;word-break:normal;overflow-wrap:normal;line-break:loose}
/* Thin is reserved for large premium atmospheric/display typography. */
.intro>h1,.route-hero>h1,.pm-value,.aqi-value,.weather-temp,.category-en,.fnb-hero h1,.fnb-detail-title{font-weight:100!important}
'''

ARCH_TEST=r'''import fs from 'node:fs';
import path from 'node:path';

const root=new URL('.',import.meta.url).pathname;
const site=path.resolve(root);
const allowedFonts=new Set([
  'line-seed-sans-th-thin.woff2',
  'line-seed-sans-th-regular.woff2',
  'line-seed-sans-th-bold.woff2'
]);
const textExtensions=new Set(['.css','.html','.js','.mjs','.json','.webmanifest']);
const banned=/Vignette Sans|Noto Sans Thai|Noto Sans|Poppins|IBM Plex Sans Thai/i;
const oldAsset=/(?:poppins|noto-sans|ibm-plex-sans-thai|vignette-sans)[^\s"')]*\.(?:woff2?|ttf|otf)/i;
const externalFont=/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr[^\n]*(?:font|LINESeed)|raw\.githubusercontent[^\n]*(?:font|LINESeed)/i;
const errors=[];

function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='vendor'||entry.name.startsWith('.'))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(full));else out.push(full);
  }
  return out;
}
for(const file of walk(site)){
  const ext=path.extname(file);
  if(!textExtensions.has(ext))continue;
  // third-party/minified renderer bundles are not typography sources.
  if(file.endsWith('environment.bundle.js'))continue;
  const text=fs.readFileSync(file,'utf8');
  if(banned.test(text))errors.push(`${path.relative(site,file)} contains retired family`);
  if(oldAsset.test(text))errors.push(`${path.relative(site,file)} contains retired font asset`);
  if(externalFont.test(text))errors.push(`${path.relative(site,file)} contains runtime external font dependency`);
  if(ext==='.css'){
    for(const match of text.matchAll(/letter-spacing\s*:\s*([^;}]+)/gi)){
      const value=match[1].replace(/!important/gi,'').trim();
      if(!/^0(?:\.0+)?(?:px|rem|em)?$/i.test(value))errors.push(`${path.relative(site,file)} nonzero letter-spacing: ${match[0]}`);
    }
    for(const match of text.matchAll(/font-weight\s*:\s*(\d+)/gi)){
      if(!['100','400','700'].includes(match[1]))errors.push(`${path.relative(site,file)} unsupported font weight ${match[1]}`);
    }
    if(path.basename(file)!=='fonts.css'){
      for(const match of text.matchAll(/font-family\s*:\s*([^;}]+)/gi)){
        const value=match[1].trim();
        if(value!=='var(--font-ui)'&&value!=='inherit')errors.push(`${path.relative(site,file)} non-canonical font-family: ${value}`);
      }
      for(const match of text.matchAll(/font\s*:\s*([^;}]+)/gi)){
        const value=match[1].trim();
        if(value!=='inherit'&&!value.includes('var(--font-ui)'))errors.push(`${path.relative(site,file)} font shorthand lacks canonical family: ${value}`);
      }
    }
  }
}
const fontDir=path.join(site,'assets','fonts');
const fontFiles=fs.readdirSync(fontDir).filter(name=>/\.(woff2?|ttf|otf)$/i.test(name));
for(const name of fontFiles)if(!allowedFonts.has(name))errors.push(`unexpected font binary: ${name}`);
for(const name of allowedFonts)if(!fontFiles.includes(name))errors.push(`missing LINE Seed asset: ${name}`);
if(fontFiles.length!==allowedFonts.size)errors.push(`expected exactly ${allowedFonts.size} production font binaries, found ${fontFiles.length}`);
const fonts=fs.readFileSync(path.join(site,'fonts.css'),'utf8');
for(const weight of ['100','400','700'])if(!fonts.includes(`font-weight:${weight}`))errors.push(`fonts.css missing weight ${weight}`);
if((fonts.match(/font-family:"LINE Seed Sans TH"/g)||[]).length!==3)errors.push('fonts.css must define exactly three LINE Seed faces');
if(!fonts.includes('*::before,*::after{letter-spacing:0!important}'))errors.push('global zero-tracking invariant missing');
if(!fonts.includes('font-synthesis:none'))errors.push('font weight synthesis guard missing');
const index=fs.readFileSync(path.join(site,'index.html'),'utf8');
const login=fs.readFileSync(path.join(site,'login.html'),'utf8');
for(const [name,text] of [['index.html',index],['login.html',login]])if(!text.includes('/fonts.css?v=1'))errors.push(`${name} does not load fonts.css`);
for(const name of ['line-seed-sans-th-regular.woff2','line-seed-sans-th-thin.woff2'])if(!index.includes(name))errors.push(`index.html does not preload ${name}`);
const sw=fs.readFileSync(path.join(site,'sw.js'),'utf8');
for(const required of ['/fonts.css','/assets/fonts/line-seed-sans-th-thin.woff2','/assets/fonts/line-seed-sans-th-regular.woff2','/assets/fonts/line-seed-sans-th-bold.woff2'])if(!sw.includes(required))errors.push(`service worker missing ${required}`);
if(!sw.includes('pwa-v31-line-seed-sans-th'))errors.push('service worker cache version not bumped for LINE Seed');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`LINE Seed font architecture PASS (${fontFiles.join(', ')})`);
'''

TYPOGRAPHY_DOC='''# Sindhorn Midtown Internal — LINE Seed Sans TH Typography Architecture

**Status:** Mandatory production typography authority  
**Date:** 28 August 2026

## Decision

`LINE Seed Sans TH` is the one and only production type family for Sindhorn Midtown Internal, for both Latin/English and Thai.

The production app self-hosts exactly three WOFF2 faces:

- 100 — Thin: large premium atmospheric/display typography only.
- 400 — Regular: body copy, values, navigation and ordinary UI.
- 700 — Bold: emphasis, labels and controls where genuine emphasis is required.

No synthetic intermediate weight is part of the architecture. CSS must use only 100, 400 or 700.

## Global invariants

- `letter-spacing: 0` everywhere, including uppercase English labels.
- No English/Thai split font stack.
- No runtime Google Fonts, CDN, GitHub raw or other third-party font dependency.
- `font-synthesis: none` prevents browser-generated fake weights.
- The official Sindhorn Midtown / Vignette logo remains image artwork and is not re-typeset.
- Thai F&B campaign copy remains bilingual content, but it uses the same LINE Seed family as English.

## Delivery

`site/fonts.css` owns the three `@font-face` declarations and the canonical `--font-ui` token. The authenticated shell and standalone `login.html` both load it. The installed PWA precaches the stylesheet and all three WOFF2 files.

The regular 400 and thin 100 faces are preloaded on the authenticated shell because they are needed immediately for the body/UI and large atmospheric display. Bold 700 is loaded on demand.

## Regression gate

`site/font-architecture.test.mjs` fails release validation if production code reintroduces retired font families/assets, nonzero letter spacing, unsupported numeric weights, external runtime font hosting, or more than the approved three production font binaries.
'''


def read(path): return Path(path).read_text()
def write(path,text): Path(path).write_text(text)

def normalize_weight(value):
    try:n=int(value)
    except:return value
    if n in WEIGHT_MAP:return str(WEIGHT_MAP[n])
    return '700' if n>=600 else ('100' if n<300 else '400')

def normalize_css(text):
    # Remove every old embedded face. The sole @font-face authority is fonts.css.
    text=re.sub(r'@font-face\s*\{[^{}]*\}\s*','',text,flags=re.I|re.S)
    text=LEGACY_FAMILY_RE.sub('LINE Seed Sans TH',text)
    # All family declarations point to one token. fonts.css itself is excluded.
    text=re.sub(r'font-family\s*:\s*[^;}]+','font-family:var(--font-ui)',text,flags=re.I)
    # Normalize font shorthands that include an explicit family.
    def font_shorthand(m):
        value=m.group(1).strip()
        if value in ('inherit','initial','unset','revert'):return 'font:'+value
        if re.search(r'(?i)(LINE Seed Sans TH|sans-serif|system-ui|ui-monospace|monospace|serif|var\(--font-ui\))',value):
            # Keep everything through the size[/line-height] token; replace the family tail.
            hit=re.search(r'^(.*?(?:\d*\.?\d+(?:px|rem|em|%|vw|vh)(?:\s*/\s*[^\s]+)?))(?:\s+).+$',value)
            if hit:
                prefix=hit.group(1)
                prefix=re.sub(r'(^|\s)(\d{3})(?=\s)',lambda mm:mm.group(1)+normalize_weight(mm.group(2)),prefix,count=1)
                return 'font:'+prefix+' var(--font-ui)'
        return 'font:'+value
    text=re.sub(r'font\s*:\s*([^;}]+)',font_shorthand,text,flags=re.I)
    text=re.sub(r'font-weight\s*:\s*(\d+)',lambda m:'font-weight:'+normalize_weight(m.group(1)),text,flags=re.I)
    text=re.sub(r'font-weight\s*:\s*bold\b','font-weight:700',text,flags=re.I)
    text=re.sub(r'font-weight\s*:\s*normal\b','font-weight:400',text,flags=re.I)
    text=re.sub(r'letter-spacing\s*:\s*[^;}]+','letter-spacing:0!important',text,flags=re.I)
    return text

# Central font architecture.
write(SITE/'fonts.css',FONTS_CSS)
write(SITE/'font-architecture.test.mjs',ARCH_TEST)
write(ROOT/'docs/LINE-SEED-SANS-TH-TYPOGRAPHY-ARCHITECTURE-20260828.md',TYPOGRAPHY_DOC)

# Normalize every first-party production stylesheet.
for path in SITE.rglob('*.css'):
    if path.name=='fonts.css' or 'vendor' in path.parts:continue
    write(path,normalize_css(read(path)))

# Remove legacy font preload/linkage and add the canonical stylesheet.
index=read(SITE/'index.html')
index=re.sub(r'<link rel="preload" as="font"[^>]+href="/assets/fonts/[^"]+"[^>]*>\n?','',index)
anchor='<link rel="preload" as="image" href="/assets/brand/sindhorn-midtown-vignette-white.png">'
font_head='''<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/line-seed-sans-th-regular.woff2">\n<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/line-seed-sans-th-thin.woff2">\n'''
index=index.replace(anchor,font_head+anchor,1)
index=index.replace('<link rel="stylesheet" href="/app-transitions.css">','<link rel="stylesheet" href="/fonts.css?v=1">\n<link rel="stylesheet" href="/app-transitions.css">',1)
index=index.replace('/shell.css?v=2','/shell.css?v=3')
write(SITE/'index.html',index)

login=read(SITE/'login.html')
if '/fonts.css?v=1' not in login:
    login=login.replace('<link rel="stylesheet" href="/app-transitions.css">','<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/line-seed-sans-th-regular.woff2">\n <link rel="stylesheet" href="/fonts.css?v=1">\n <link rel="stylesheet" href="/app-transitions.css">',1)
login=login.replace('/internal-auth.css?v=5','/internal-auth.css?v=6')
write(SITE/'login.html',login)

# Any compatibility standalone HTML document also gets the canonical font layer.
for path in SITE.glob('*.html'):
    if path.name in ('index.html','login.html'):continue
    text=read(path)
    if '<head' in text and '/fonts.css?v=1' not in text:
        text=text.replace('</head>','<link rel="stylesheet" href="/fonts.css?v=1">\n</head>',1)
        write(path,text)

# Service worker: new cache generation + canonical local font assets only.
sw_path=SITE/'sw.js'; sw=read(sw_path)
sw=re.sub(r"const VERSION='[^']+';","const VERSION='sindhorn-midtown-internal-pwa-v31-line-seed-sans-th';",sw,count=1)
# Remove every retired font entry in SHELL.
sw=re.sub(r",?'/assets/fonts/(?:poppins|noto-sans|ibm-plex-sans-thai|vignette-sans)[^']+'",'',sw,flags=re.I)
for asset in ["'/fonts.css'","'/assets/fonts/line-seed-sans-th-thin.woff2'","'/assets/fonts/line-seed-sans-th-regular.woff2'","'/assets/fonts/line-seed-sans-th-bold.woff2'"]:
    if asset not in sw:
        sw=sw.replace("'/shell.css'", "'/shell.css',"+asset,1)
write(sw_path,sw)

# Delete all legacy binaries. New LINE Seed binaries are downloaded by the workflow before this script runs.
font_dir=SITE/'assets/fonts'
allowed={'line-seed-sans-th-thin.woff2','line-seed-sans-th-regular.woff2','line-seed-sans-th-bold.woff2','OFL-LINE-SEED.txt'}
for path in font_dir.iterdir():
    if path.name not in allowed:path.unlink()

# Rehash the offline fallback pack after its typography CSS changes.
manifest_path=SITE/'fallback/manifest.json'; manifest=json.loads(read(manifest_path))
for item in manifest['resources']:
    resource=SITE/'fallback'/item['path']
    item['sha256']=hashlib.sha256(resource.read_bytes()).hexdigest()
manifest['updatedAt']='2026-08-28T17:00:00Z'
write(manifest_path,json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

# Current architecture docs: replace only active typography authority, preserve history elsewhere.
ag=read(ROOT/'AGENTS.md')
ag=ag.replace('Thai **content** is unaffected. F&B promotion copy stays bilingual in `site/fnb-data.js`: the Copy section exists to hand the designer both the English and Thai marketing text for artwork, so `copyTh` is work product, not chrome. Noto Sans Thai and the `:lang(th)` font rule must therefore stay shipped.','Thai **content** is unaffected. F&B promotion copy stays bilingual in `site/fnb-data.js`: the Copy section exists to hand the designer both the English and Thai marketing text for artwork, so `copyTh` is work product, not chrome. English and Thai both use the single self-hosted `LINE Seed Sans TH` family.')
needle='- **Typography invariant: every font and text treatment in Sindhorn Midtown Internal uses zero character tracking (`letter-spacing: 0`). Do not introduce positive or negative tracking anywhere in the PWA, auth, admin, messages, or future modules.**'
ag=ag.replace(needle,'- **Typography invariant: `LINE Seed Sans TH` is the sole production font family for both English and Thai. Production ships only real weights 100 / 400 / 700. Every text treatment uses zero character tracking (`letter-spacing: 0`), with no exceptions. Do not reintroduce Poppins, Noto Sans, Noto Sans Thai, Vignette Sans, IBM Plex, split-language font logic, synthetic weights, or external runtime font hosting.**')
write(ROOT/'AGENTS.md',ag)

lang=read(ROOT/'docs/LANGUAGE-ORDER-OVERRIDE-20260825.md')
lang=lang.replace('Noto Sans Thai and the\n>   `:lang(th)` font rule stay shipped for it.','Both the English and Thai campaign copy use the same self-hosted\n>   `LINE Seed Sans TH` family.')
lang=re.sub(r'- English uses Poppins; Thai uses Noto Sans Thai\.[^\n]*\n','- English and Thai both use the single self-hosted `LINE Seed Sans TH` family. Production weights are 100 / 400 / 700, and every text treatment uses `letter-spacing: 0`.\n',lang)
write(ROOT/'docs/LANGUAGE-ORDER-OVERRIDE-20260825.md',lang)

final=read(ROOT/'docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md')
start=final.find('### 6.2 English typography is eminent')
end=final.find('### 6.3 Thai comprehension rule')
if start!=-1 and end!=-1:
    replacement='''### 6.2 Typography authority — LINE Seed Sans TH\n\n**28 August 2026 override:** `LINE Seed Sans TH` is the one and only production family for both English/Latin and Thai. This supersedes the earlier Vignette Sans / Noto Sans Thai split-family decision.\n\nProduction ships only real weights 100, 400 and 700. Weight 100 is reserved primarily for very large premium atmospheric/display typography; ordinary mobile UI and body copy use 400; emphasis uses 700. No synthetic intermediate weights.\n\nEvery text treatment uses `letter-spacing: 0` with no exceptions, including uppercase English labels. The font is self-hosted from the Cloudflare/GitHub shell; no runtime external font service is permitted. The official Sindhorn Midtown / Vignette lockup remains image artwork and is never re-typeset.\n\n'''
    final=final[:start]+replacement+final[end:]
write(ROOT/'docs/FINAL-APP-ARCHITECTURE-AND-RELEASE-PLAN.md',final)

# Deployment workflow: branch preview, permanent font architecture gate and font asset smoke.
deploy_path=ROOT/'.github/workflows/deploy.yml'; deploy=read(deploy_path)
if '      - typography-line-seed-sans-th\n' not in deploy:
    deploy=deploy.replace('      - main\n','      - main\n      - typography-line-seed-sans-th\n',1)
if 'site/font-architecture.test.mjs' not in deploy:
    deploy=deploy.replace('          node --experimental-default-type=module site/phase8-2-seasonal-clouds.test.mjs\n','          node --experimental-default-type=module site/phase8-2-seasonal-clouds.test.mjs\n          node site/font-architecture.test.mjs\n',1)
smoke=' /fonts.css /assets/fonts/line-seed-sans-th-thin.woff2 /assets/fonts/line-seed-sans-th-regular.woff2 /assets/fonts/line-seed-sans-th-bold.woff2'
deploy=deploy.replace(' /sw.js; do',smoke+' /sw.js; do',1)
write(deploy_path,deploy)

# Launch hardening should also exercise this branch and stop pinning an obsolete Supabase pack number.
lh_path=ROOT/'.github/workflows/launch-hardening.yml'; lh=read(lh_path)
if '      - typography-line-seed-sans-th\n' not in lh:
    lh=lh.replace('      - main\n','      - main\n      - typography-line-seed-sans-th\n',1)
if 'node site/font-architecture.test.mjs' not in lh:
    lh=lh.replace('          node --experimental-default-type=module site/phase8-2-seasonal-clouds.test.mjs\n','          node --experimental-default-type=module site/phase8-2-seasonal-clouds.test.mjs\n          node site/font-architecture.test.mjs\n',1)
lh=lh.replace("          packs={int(row['pack_id']) for row in rows}; assert packs=={38},packs\n          rowmap={row['path']:row for row in rows}; manifest_row=rowmap['manifest.json']; assert hashlib.sha256(manifest_row['content'].encode()).hexdigest()==manifest_row['content_sha256']\n          manifest=json.loads(manifest_row['content']); assert manifest['appPack']==38 and manifest['minimumShell']==17 and manifest['environmentConfig']==3\n", "          packs={int(row['pack_id']) for row in rows}; assert len(packs)==1,packs\n          active_pack=next(iter(packs)); rowmap={row['path']:row for row in rows}; manifest_row=rowmap['manifest.json']; assert hashlib.sha256(manifest_row['content'].encode()).hexdigest()==manifest_row['content_sha256']\n          manifest=json.loads(manifest_row['content']); assert manifest['appPack']==active_pack and manifest['minimumShell']==17 and manifest['environmentConfig']==3\n")
write(lh_path,lh)

# Normalize old font references in first-party workflow assertions if any remain.
for path in (ROOT/'.github/workflows').glob('*.yml'):
    text=read(path)
    text=OLD_FONT_FILE_RE.sub('line-seed-sans-th-regular.woff2',text)
    write(path,text)

print('LINE Seed migration applied')
