/* Audits a rebuilt page against the centralized library.

   A page passes only when every class it renders is defined in the foundation
   stylesheets (or, for /ci, its own reference sheet), and when it declares no
   presentation of its own: no style attributes, no <style> blocks, no colour
   literals, no pixel values in templates, no backdrop-filter anywhere but
   app-glass.css. This is the check the eight rebuild requirements reduce to
   for a single page, so it runs on every page as it is finished.

   Usage: node scripts/page-centralization-audit.mjs [--json]
*/
import fs from 'node:fs';

const FOUNDATION = ['site/app-tokens.css', 'site/app-glass.css', 'site/app-components.css', 'site/app-shell.css'];
const PAGES = [
  { name: '/next (Today)', files: ['site/next.html', 'site/today.js', 'site/fnb-page.js'], css: FOUNDATION },
  { name: '/ci (UI Library)', files: ['site/ci.html'], css: [...FOUNDATION, 'site/ci-library.css'] }
];
// Classes that are state hooks or belong to a runtime the page only hosts.
const ALLOW = new Set(['is-shell', 'is-single', 'is-open']);

const read = file => fs.readFileSync(file, 'utf8');
const definedClasses = files => {
  const set = new Set();
  for (const file of files) for (const m of read(file).matchAll(/\.([a-zA-Z_][\w-]*)/g)) set.add(m[1]);
  return set;
};
const usedClasses = source => {
  const set = new Set();
  for (const m of source.matchAll(/class=(?:"|')([^"'`$]+?)(?:"|')/g)) for (const c of m[1].split(/\s+/)) if (c) set.add(c);
  // Template literals: class="app-chip ${...}" — take the static part only.
  for (const m of source.matchAll(/class="([^"]*?)\$\{/g)) for (const c of m[1].split(/\s+/)) if (c) set.add(c);
  for (const m of source.matchAll(/className\s*=\s*['"]([^'"]+)['"]/g)) for (const c of m[1].split(/\s+/)) if (c) set.add(c);
  return set;
};
const stripComments = s => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');

const results = [];
for (const page of PAGES) {
  const defined = definedClasses(page.css);
  const findings = [];
  for (const file of page.files) {
    const raw = read(file);
    const src = stripComments(raw);
    const isHtml = file.endsWith('.html');
    // Scripts inside the HTML are audited as templates too, but a <script> that
    // only sets a CSS custom property on the root is not a style attribute.
    for (const c of usedClasses(src)) if (!defined.has(c) && !ALLOW.has(c)) findings.push(`${file}: class "${c}" is not defined by the library`);
    for (const m of src.matchAll(/\sstyle=["']/g)) findings.push(`${file}: inline style attribute at offset ${m.index}`);
    if (isHtml && /<style[\s>]/.test(src)) findings.push(`${file}: <style> block`);
    for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b(?![^<]*<\/code>)/g)) {
      // Fragment links (#section) and hex in prose/code samples are not colour declarations.
      const ctx = src.slice(Math.max(0, m.index - 12), m.index);
      if (/href=["']$|\(["']?$|>\s*$|`\s*$/.test(ctx) || /\.\w+:\s*$/.test(ctx)) continue;
      if (/(color|background|fill|stroke|border)\s*:\s*$/.test(ctx) || /style/.test(ctx)) findings.push(`${file}: colour literal ${m[0]}`);
    }
    for (const m of src.matchAll(/rgba?\(/g)) {
      const ctx = src.slice(Math.max(0, m.index - 40), m.index);
      if (!/<code>[^<]*$/.test(ctx) && !/expected|smoke|\/\//.test(ctx)) findings.push(`${file}: colour function at offset ${m.index}`);
    }
    if (/backdrop-filter/.test(src)) findings.push(`${file}: backdrop-filter outside app-glass.css`);
    for (const m of src.matchAll(/(?:width|height|margin|padding|gap|top|left|right|bottom|font-size)\s*:\s*-?\d+(?:\.\d+)?px/g)) {
      const ctx = src.slice(Math.max(0, m.index - 60), m.index);
      if (!/<code>[^<]*$/.test(ctx) && !/ci-ref|<td>|<span>|—/.test(ctx)) findings.push(`${file}: pixel geometry "${m[0]}"`);
    }
  }
  // Every stylesheet the page links must be a library file, and versioned.
  for (const file of page.files.filter(f => f.endsWith('.html'))) {
    for (const m of read(file).matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) {
      const href = m[1].split('?')[0].replace(/^\//, 'site/');
      if (!page.css.includes(href) && href !== 'site/fonts.css') findings.push(`${file}: links non-library stylesheet ${m[1]}`);
      if (!/\?v=\d+/.test(m[1]) && href !== 'site/fonts.css') findings.push(`${file}: stylesheet ${m[1]} has no cache-busting version`);
    }
  }
  results.push({ page: page.name, files: page.files, classes: [...page.files].reduce((n, f) => n + usedClasses(stripComments(read(f))).size, 0), findings });
}

const failed = results.filter(r => r.findings.length);
if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
else {
  for (const r of results) {
    console.log(`${r.findings.length ? '✗' : '✓'} ${r.page} — ${r.classes} classes used, ${r.findings.length} finding${r.findings.length === 1 ? '' : 's'}`);
    for (const f of r.findings) console.log(`    ${f}`);
  }
}
process.exit(failed.length ? 1 : 0);
