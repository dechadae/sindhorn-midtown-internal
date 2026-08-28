import fs from 'node:fs';
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
  if(file.endsWith('environment.bundle.js')||file.endsWith('font-architecture.test.mjs'))continue;
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
        if(!value.startsWith('inherit')&&!value.includes('var(--font-ui)'))errors.push(`${path.relative(site,file)} font shorthand lacks canonical family: ${value}`);
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
