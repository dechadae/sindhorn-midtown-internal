/* Rebuilds Flipgazine's "Moving to Claude Code" page on idui-core.

   Reads the page as it lives in Supabase site_files (flipgazine-source/
   claude-code.html, anon key redacted) and writes after/claude-code.html:
   the same words in library markup, no CSS of its own. The conversion is a
   class mapping, deterministic and re-runnable, so the after page can never
   drift from the before page by hand:

     .g-hero / h1 / p / .btn   -> .app-hero, -title, -copy, .app-primary
     h2#sN > .num              -> .app-section > .app-section-title > .app-section-index
     .g-body running text      -> .app-prose[data-tone=quiet] (b / i / lead)
     .g-toc                    -> .app-surface > .app-surface-label + .app-prose[data-columns=2]
     .g-note[.warn] / .g-say   -> .app-surface[data-mode=note|quote][data-tone=warn]
     .g-cmd > .g-copy + code   -> .app-code-block > .app-chip + code
     .g-step > .st + p         -> .app-step > .app-step-label + p
     .g-tbl                    -> .app-table-wrap > .app-table[data-mode=text] with thead/tbody
     .g-list                   -> ul / ol
     header (fg-header.html)   -> .app-masthead: wordmark home, three actions, progress rule
     nav.bottom-nav > .nav-chip -> .app-navbar[data-mode=rail] > .app-chip
     #glCanvas / #bgLetters    -> .environment-stage > .environment-canvas / the glyph host

   Dropped: the seven style blocks, the inline style on <html> and .brand,
   the hidden catalog grid, the dead catalog CSS, the reduced-motion style. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const here=new URL('./',import.meta.url);
const src=await readFile(new URL('flipgazine-source/claude-code.html',here),'utf8');
const header=await readFile(new URL('flipgazine-source/fg-header.html',here),'utf8');
const head=await readFile(new URL('flipgazine-source/fg-head.html',here),'utf8');

/* ---- the page's own content: main > .wrap, minus its style block ---- */
const wrapStart=src.indexOf('<div class="wrap">',src.indexOf('<main'));
const mainEnd=src.indexOf('</main>');
let body=src.slice(wrapStart+'<div class="wrap">'.length,mainEnd);
body=body.replace(/<style>[\s\S]*?<\/style>/,'');               // the in-body sheet
const railSrc=(src.match(/<nav[^>]*id="claudeNav"[\s\S]*?<\/nav>/)||[''])[0];
body=body.replace(railSrc,'');
body=body.replace(/<div style="display:none"[\s\S]*?<\/div>\s*<\/div>/,''); // hidden catalog grid
body=body.replace(/<\/div>\s*$/,'');                              // closing .wrap

/* ---- hero ---- */
body=body.replace(/<section class="g-hero" id="top">([\s\S]*?)<\/section>/,(m,inner)=>{
  inner=inner
    .replace('<div class="eyebrow">','<p class="app-hero-eyebrow">').replace('</div>','</p>')
    .replace('<h1>','<h1 class="app-hero-title">')
    .replace(/<p>(?=Written)/,'<p class="app-hero-copy">')
    .replace(/<a class="btn btn-primary" href="#s1">([\s\S]*?)<\/a>/,'<div class="app-row"><a class="app-primary app-control" href="#s1">$1</a></div>');
  return `<section class="app-hero" id="top">${inner}</section>`;
});
body=body.replace(/\s*<hr class="g-rule">\s*/,'\n');

/* ---- body: split at every h2 into sections ---- */
const gb=body.indexOf('<div class="g-body">');
let content=body.slice(gb+'<div class="g-body">'.length);
content=content.replace(/<!--[\s\S]*?-->/g,'');           // the author's closing note
content=content.replace(/\s*<\/div>\s*$/,"");           // .g-body closer (.wrap was cut above)
const parts=content.split(/(?=<h2 id="s\d+">)/);
const intro=parts.shift();
const sections=[];
const hero=body.match(/<section class="app-hero"[\s\S]*?<\/section>/);
if(!hero)throw new Error('hero shape');
sections.push(hero[0].replace(/\n\s+/g,'\n'));
sections.push(`<section class="app-section">\n${convertIntro(intro)}\n</section>`);
for(const part of parts){
  const m=part.match(/^<h2 id="(s\d+)"><span class="num">(\d+)<\/span>([\s\S]*?)<\/h2>([\s\S]*)$/);
  if(!m)throw new Error('section shape');
  sections.push(`<section class="app-section" id="${m[1]}">\n<h2 class="app-section-title"><span class="app-section-index">${m[2]}</span>${m[3]}</h2>\n<div class="app-prose" data-tone="quiet">${convertProse(m[4])}</div>\n</section>`);
}

function convertIntro(s){
  const lead=s.match(/<p class="lead">[\s\S]*?<\/p>/)[0].replace('<p class="lead">','<p data-tone="lead">');
  const toc=s.match(/<div class="g-toc">([\s\S]*?)<\/ol>\s*<\/div>/)[0];
  const eyebrow=toc.match(/<div class="eyebrow">([\s\S]*?)<\/div>/)[1];
  const ol=toc.match(/<ol>[\s\S]*<\/ol>/)[0];
  return `<div class="app-prose" data-tone="quiet">${lead}</div>\n<div class="app-surface"><p class="app-surface-label">${eyebrow}</p><div class="app-prose" data-tone="quiet" data-mode="contents" data-columns="2">${ol}</div></div>`;
}
function convertProse(s){
  return s
    .replace(/<(ul|ol) class="g-list">/g,'<$1>')
    .replace(/<div class="g-step">\s*<span class="st">([\s\S]*?)<\/span>/g,'<div class="app-step"><span class="app-step-label">$1</span>')
    .replace(/<p class="lead">/g,'<p data-tone="lead">')
    .replace(/<div class="g-note( warn)?">\s*<p class="nt">([\s\S]*?)<\/p>([\s\S]*?)<\/div>/g,(m,warn,label,rest)=>`<div class="app-surface" data-mode="note"${warn?' data-tone="warn"':''}><p class="app-surface-label">${label}</p>${rest.replace(/<p>/g,'<p class="app-surface-copy">').trim()}</div>`)
    .replace(/<div class="g-say">\s*<span class="sy">([\s\S]*?)<\/span>([\s\S]*?)<\/div>/g,(m,label,rest)=>`<div class="app-surface" data-mode="quote"><p class="app-surface-label">${label}</p>${rest.replace(/<p>/g,'<p class="app-surface-copy">').trim()}</div>`)
    .replace(/<div class="g-cmd"><button class="g-copy" type="button">Copy<\/button>/g,'<div class="app-code-block"><button class="app-chip app-control" type="button" data-copy>Copy</button>')
    .replace(/<table class="g-tbl">\s*(<tr>[\s\S]*?<\/tr>)([\s\S]*?)<\/table>/g,(m,h,rows)=>`<div class="app-table-wrap"><table class="app-table" data-mode="text"><thead>${h}</thead><tbody>${rows.trim()}</tbody></table></div>`);
}

/* ---- header -> masthead ---- */
const logoSvg=header.match(/<svg viewBox="0 0 646 676" id="logoMark" aria-hidden="true"><\/svg>/)[0];
const fsEnter=header.match(/<svg class="fs-enter"[\s\S]*?<\/svg>/)[0].replace('class="fs-enter"','data-icon="off"');
const fsExit=header.match(/<svg class="fs-exit"[\s\S]*?<\/svg>/)[0].replace('class="fs-exit"','data-icon="on"');
const sun=header.match(/<svg class="ic-sun"[\s\S]*?<\/svg>/)[0].replace('class="ic-sun"','data-icon="off"');
const moon=header.match(/<svg class="ic-moon"[\s\S]*?<\/svg>/)[0].replace('class="ic-moon"','data-icon="on"');
const edSvg=header.match(/<button class="ed-switch"[\s\S]*?(<svg viewBox="0 0 24 24" aria-hidden="true">[\s\S]*?<\/svg>)/)[1];
const masthead=`<header class="app-masthead">
  <a class="app-masthead-home" data-mode="wordmark" href="/" aria-label="flipgazine home">${logoSvg}flipgazine</a>
  <div class="app-masthead-tools">
    <button class="app-masthead-action app-control" id="fsSwitch" type="button" aria-label="Enter full screen" aria-pressed="false">${fsEnter}${fsExit}</button>
    <button class="app-masthead-action app-control" id="themeSwitch" type="button" aria-label="Switch between Legacy Light and Legacy Dark" aria-pressed="true">${sun}${moon}</button>
    <button class="app-switch app-control" id="edSwitch" type="button" aria-label="Editorial theme, follows the time of day" aria-pressed="true">${edSvg}<span class="app-switch-track"><span class="app-switch-knob"></span></span></button>
  </div>
  <div class="app-masthead-progress"><i id="ruleFill"></i></div>
</header>`;

/* ---- rail ---- */
const rail=railSrc.replace(/<nav class="bottom-nav" id="claudeNav"/,'<nav class="app-navbar" data-mode="rail" id="claudeNav"').replace(/class="nav-chip"/g,'class="app-chip app-control"').replace(/\n\s+/g,'\n');
if(!rail.includes('app-navbar'))throw new Error('rail shape: '+railSrc.slice(0,80));

/* ---- the pre-paint palette restore, verbatim from fg-head (behavior, not presentation) ---- */
const prepaint=head.match(/<script>[\s\S]*?<\/script>/)[0];
const title=src.match(/<title>([\s\S]*?)<\/title>/)[1];

const page=`<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title>
<meta name="theme-color" content="#0D1110">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="../../../constitutions/flipgazine/fonts.css">
<link rel="stylesheet" href="../../../app-glass.css">
<link rel="stylesheet" href="../../../app-components.css">
<link rel="stylesheet" href="../../../app-compositions.css">
<link rel="stylesheet" href="../../../app-shell.css">
<link rel="stylesheet" href="../../../constitutions/flipgazine/app-tokens.css">
${prepaint}
</head>
<body>
<a class="app-skip-link app-control" href="#main">Skip to content</a>
<div class="environment-stage" data-ready="true"><canvas class="environment-canvas" id="glCanvas" aria-hidden="true"></canvas></div>
<div id="bgLetters" aria-hidden="true"></div>
${masthead}
<main class="app-page is-shell" id="main">
${sections.join('\n')}
</main>
${rail}
<script src="engines/fg-clock.js"></script>
<script src="engines/fg-motion.js"></script>
<script src="engines/fg-theme.js"></script>
<script src="engines/fg-glyph.js"></script>
<script src="engines/fg-atmos.js"></script>
<script src="claude-code.js"></script>
</body>
</html>
`;
await mkdir(new URL('after/',here),{recursive:true});
await writeFile(new URL('after/claude-code.html',here),page);
console.log(JSON.stringify({bytes:Buffer.byteLength(page),sections:sections.length,leftovers:(page.match(/class="(g-|nav-chip|bottom-nav|eyebrow|lead|st|nt|sy|num)\b[^"]*"/g)||[]).length}));
