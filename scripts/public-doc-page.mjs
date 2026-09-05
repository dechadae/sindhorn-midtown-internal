/* A public document on the Sindhorn domain (/idui, /evidence; r34).

   The document is the shell in public mode without the shell: the same
   seven stylesheets /ci.html loads (read from it, so the cache-busting
   versions have one source), the live atmosphere stage, the masthead the
   share pages carry - the logo as a mark, no tools - and no navbar
   (<body data-public> collapses the navbar height the way the share does).
   /public-doc.js boots the atmosphere in sky mode. The document itself is
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

export function docPage({title,description,slug,body,comment=''}){
  if(/<style[\s>]/.test(body)||/\sstyle=/.test(body))throw new Error(`${slug}: the document body carries CSS`);
  const url=`${ORIGIN}/${slug}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#2E273B">
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

<script type="module" src="/public-doc.js"></script>

</body>
</html>
`;
}
