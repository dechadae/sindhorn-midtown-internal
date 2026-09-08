/* A public document on the Sindhorn domain (/idui, /evidence; r34).

   The document is the shell in public mode without the shell: the same
   seven stylesheets /ci.html loads (read from it, so the cache-busting
   versions have one source), the live atmosphere stage, the masthead the
   share pages carry - the logo as a mark, no tools - and, since r43, the
   app's own fixed navbar listing the transfer tests.
   /public-doc.js boots the atmosphere and lets the runtime resolve its mode (r57). The document itself is
   library classes only; a build fails if a body carries CSS. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const SITE=path.join(ROOT,'site');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export const LOGO='/assets/brand/sindhorn-midtown-vignette-white.png';
export const ORIGIN='https://sindhorn-midtown-internal.pages.dev';

/* The foundation links exactly as /ci.html carries them. */
export function foundationLinks(){
  const ci=fs.readFileSync(path.join(SITE,'ci.html'),'utf8');
  const links=[...ci.matchAll(/<link rel="stylesheet" href="\/[^"]+\.css\?v=\d+">/g)].map(m=>m[0]);
  if(links.length!==7)throw new Error(`ci.html: expected seven stylesheet links, found ${links.length}`);
  return links.join('\n');
}

/* The transfer tests, as a navbar. The document pages carry the app's own
   fixed footer rather than a rail in the flow: it is the same primitive, the
   same material and the same band height, and it keeps the series reachable
   from anywhere in a long document. A tab is a link only when its page
   exists; the one you are on is aria-current and inert, as the app's own
   current tab is (r43). Since r67 the tabs swap the document in place
   (/public-doc.js), as the shell's own tabs do, so the masthead, the navbar
   and the atmosphere stay put while the page beneath them changes.

   03 was Apple, never run; the Betta test - "Test 04" in its own record, see
   idui-core/evidence/generative/PROTOCOL.md A4 - was published third in its
   place on 8 September 2026. */
const TESTS=[
  {slug:'idui',label:'IDUI',href:'/idui',live:true},
  {slug:'evidence',label:'01 Flipgazine',href:'/evidence',live:true},
  {slug:'origarium',label:'02 Origarium',href:'/origarium',live:true},
  {slug:'betta',label:'03 Betta',href:'/betta',live:true},
];
const MARK={
  idui:'<path d="M4 6h16M4 12h10M4 18h13"/>',
  evidence:'<path d="M5 4h9l5 5v11H5z"/><path d="M14 4v5h5"/>',
  origarium:'<path d="M4 5h7v14H4z"/><path d="M13 5h7v14h-7z"/>',
  /* a seed: one point, and the ring of what it selects within */
  betta:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.5"/>',
};
function testsNavbar(current){
  const tabs=TESTS.map(test=>{
    const here=test.slug===current;
    const icon=`<svg viewBox="0 0 24 24" aria-hidden="true">${MARK[test.slug]}</svg>`;
    const inner=`${icon}\n      <span>${test.label}</span>`;
    /* Not started, and not somewhere to send anyone: a tab with no page is
       disabled rather than a link that goes nowhere. */
    if(here)return `    <span class="app-navbar-button" aria-current="page">\n      ${inner}\n    </span>`;
    if(!test.live)return `    <span class="app-navbar-button" aria-disabled="true">\n      ${inner}\n    </span>`;
    return `    <a class="app-navbar-button" href="${test.href}">\n      ${inner}\n    </a>`;
  }).join('\n');
  return `<nav class="app-navbar" aria-label="The transfer tests" data-mode="app">\n  <div class="app-navbar-set" data-set="app">\n${tabs}\n  </div>\n</nav>`;
}

/* The masthead as the share pages render it: the same markup as index.html
   after public-page.js has cut it. Read from index.html so a masthead edit
   reaches the documents too. */
export function publicMasthead(){
  const index=fs.readFileSync(path.join(SITE,'index.html'),'utf8');
  const m=index.match(/<header class="app-masthead">\n  <button class="app-masthead-home" type="button" aria-label="Home">([\s\S]*?)<\/button>/);
  if(!m)throw new Error('index.html: masthead home not found');
  return `<header class="app-masthead">\n  <div class="app-masthead-home">${m[1]}</div>\n</header>`;
}

export const STAGE='<div class="environment-stage" id="environmentStage" aria-hidden="true"><canvas class="environment-canvas" id="environmentCanvas"></canvas></div>';

/* The release the page was built with, as sw.js names it. /public-doc.js
   fetches the neighbouring documents under this stamp so the app's service
   worker, where it controls the origin, caches each release's copy under its
   own key and a redeploy is never answered from the last one. */
export function release(){
  const sw=fs.readFileSync(path.join(SITE,'sw.js'),'utf8').match(/const VERSION='([^']+)'/)?.[1];
  if(!sw)throw new Error('sw.js: VERSION not found');
  return sw.replace(/^sindhorn-midtown-internal-pwa-/,'');
}

export function docPage({title,description,slug,body,comment=''}){
  if(/<style[\s>]/.test(body)||/\sstyle=/.test(body))throw new Error(`${slug}: the document body carries CSS`);
  const url=`${ORIGIN}/${slug}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#2E273B">
<meta name="release" content="${esc(release())}">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:site_name" content="Sindhorn Midtown">
<meta property="og:title" content="${esc(title)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(url)}">
<meta property="og:description" content="${esc(description)}">
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/png" sizes="192x192" href="/icons/app-192.png?v=2">
${comment?`<!--\n${comment}\n-->\n`:''}<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/line-seed-sans-th-regular.woff2">
${foundationLinks()}
</head>
<body data-public="doc">

${STAGE}

${publicMasthead()}

${body}

${testsNavbar(slug)}

<script type="module" src="/public-doc.js"></script>

</body>
</html>
`;
}
