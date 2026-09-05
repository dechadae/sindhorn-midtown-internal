#!/usr/bin/env node
/* The transfer evidence: one specimens fragment rendered under two
   constitutions. node idui-core/evidence/build.mjs writes sindhorn.html and
   flipgazine.html next to this file. Each page links the core in the README
   order (fonts, glass, components, compositions, shell, tokens last) and
   declares no CSS of its own; the fragment is identical in both, so any
   difference between the renderings comes from the constitution alone.

   The atmosphere is a still SVG gradient inside .environment-stage, as the
   IDUI export does it: its stops are image data, not styling. Each
   constitution brings its own picture. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = file => fs.readFileSync(path.join(HERE, file), 'utf8');

const stage = (base, stops) => `<div class="environment-stage" data-ready="true" aria-hidden="true">
  <svg class="environment-canvas" viewBox="0 0 390 844" preserveAspectRatio="none" role="presentation">
    <defs>
${stops.map(([id, cx, cy, r, a, b]) => `      <radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${a[0]}" stop-opacity="${a[1]}"/><stop offset="1" stop-color="${b[0]}" stop-opacity="${b[1]}"/></radialGradient>`).join('\n')}
    </defs>
    <rect width="390" height="844" fill="${base}"/>
${stops.map(([id]) => `    <rect width="390" height="844" fill="url(#${id})"/>`).join('\n')}
  </svg>
</div>`;

const CONSTITUTIONS = {
  sindhorn: {
    name: 'Sindhorn Midtown', mark: 'Sindhorn Midtown', lang: 'en',
    stage: stage('#211B2E', [
      ['ev-navy', .85, .08, .7, ['#0B1A3A', .9], ['#0B1A3A', 0]],
      ['ev-blue', .18, .22, .62, ['#2F6FD6', .62], ['#0B1A3A', 0]],
      ['ev-red', .82, .78, .55, ['#C8202C', .62], ['#3A0C14', 0]],
      ['ev-glint', .62, .62, .22, ['#FF5A1F', .42], ['#FF5A1F', 0]],
      ['ev-sky', .3, .95, .6, ['#7DB7F0', .28], ['#7DB7F0', 0]]
    ])
  },
  flipgazine: {
    name: 'Flipgazine', mark: 'flipgazine', lang: 'en',
    stage: stage('#0D1110', [
      ['ev-moss', .15, .18, .6, ['#1F3A34', .85], ['#0D1110', 0]],
      ['ev-teal', .88, .12, .5, ['#00F0D1', .22], ['#00F0D1', 0]],
      ['ev-ember', .8, .82, .5, ['#E8792B', .3], ['#E8792B', 0]],
      ['ev-lift', .35, .95, .55, ['#233B36', .7], ['#0D1110', 0]]
    ])
  }
};

const LINKS = key => [
  `../constitutions/${key}/fonts.css`,
  '../app-glass.css', '../app-components.css', '../app-compositions.css', '../app-shell.css',
  `../constitutions/${key}/app-tokens.css`
].map(href => `<link rel="stylesheet" href="${href}">`).join('\n');

const fragment = read('specimens.html');
if (/<style|\sstyle=/.test(fragment)) { console.error('specimens.html declares CSS'); process.exit(1); }

for (const [key, c] of Object.entries(CONSTITUTIONS)) {
  const body = fragment.replaceAll('__CONSTITUTION__', c.name).replaceAll('__MARK__', c.mark);
  const html = `<!doctype html>
<html lang="${c.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>IDUI core · ${c.name}</title>
<!-- Built by idui-core/evidence/build.mjs from specimens.html. No CSS of its own. -->
${LINKS(key)}
</head>
<body>
${c.stage}
${body}
</body>
</html>
`;
  fs.writeFileSync(path.join(HERE, `${key}.html`), html);
  console.log(JSON.stringify({ ok: true, page: `${key}.html`, bytes: html.length }));
}
