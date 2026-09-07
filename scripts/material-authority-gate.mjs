#!/usr/bin/env node
/* Material has one authority.

   A consumer declares semantic role and context; only a registered material
   authority may derive fill, edge, blur, shadow or related material treatment.

   This replaces the old wording - "no backdrop-filter anywhere but
   app-glass.css" - which Origarium falsified. That sentence is still true of
   Sindhorn and is now a Sindhorn contract; the generic law is about authority,
   not about a filename. Core defines the grammar of authority and never owns
   the authorities themselves: glass is Sindhorn's taste, paper is Origarium's.

   Two distinctions make it decidable, and both matter:

     Authoring is not declining. Assigning a material value is a decision;
     `background:none` on a control is a refusal, and refusing material is not
     authoring it.

     A surface is a registered role, not a name prefix. `.app-navbar-button`
     shares four characters with `.app-navbar` and is a control. The registry
     says which selectors are surfaces; this script does not guess.

     node scripts/material-authority-gate.mjs [--json] */
import {readFileSync, existsSync} from 'node:fs';
import {globSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const contract = JSON.parse(readFileSync(path.join(root, 'governance/idui-contract.json'), 'utf8'));
const {surfaceRoles, materialProperties, decliningValues} = contract.core;

const authorities = new Set();
for (const group of ['products', 'evidence'])
  for (const scope of Object.values(contract[group] || {}))
    for (const f of scope.materialAuthorities || []) authorities.add(f);

/* Every stylesheet in the repo that is not vendored, not an authority, and not
   a constitution's token file (which declares values, never treatment). */
const sheets = globSync('**/*.css', {cwd: root})
  .filter(f => !f.includes('node_modules') && !f.startsWith('scratchpad'))
  .filter(f => !authorities.has(f))
  .filter(f => !/constitutions\/[^/]+\/(app-tokens|fonts)\.css$/.test(f));

const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
const declining = new Set(decliningValues.values);
const isSurface = sel => surfaceRoles.selectors.some(role => {
  if (role.startsWith('[')) return sel.includes(role.slice(0, -1));      // [data-surface] matches [data-surface="x"]
  return new RegExp(`(?<![\\w-])${role.replace('.', '\\.')}(?![\\w-])`).test(sel);
});
const authored = value => {
  const v = value.trim().toLowerCase().replace(/!important/, '').trim();
  if (!v) return false;
  if (declining.has(v)) return false;
  /* `border:0`, `border:none`, `0 0 0 transparent` — a refusal in longhand. */
  return !/^(0(px)?\s*)+$/.test(v) && !/^(none|0)\s/.test(v);
};

const findings = [];
let scanned = 0, surfaces = 0;
for (const file of sheets) {
  const css = strip(readFileSync(path.join(root, file), 'utf8'));
  scanned++;
  /* A sheet this cannot parse is a sheet it cannot judge, so structure is
     checked before material. Twice in one day an edit left a stylesheet
     malformed - once a selector list split in half, once a stray closing brace
     from a removed @media - and both times every gate stayed green while the
     browser quietly dropped rules. */
  const open = (css.match(/{/g) || []).length, close = (css.match(/}/g) || []).length;
  if (open !== close) findings.push(`${file}: ${open} "{" against ${close} "}" — the sheet does not close`);
  let depth = 0, stray = 0;
  for (const ch of css) { if (ch === '{') depth++; else if (ch === '}') { if (depth === 0) stray++; else depth--; } }
  if (stray) findings.push(`${file}: ${stray} closing brace${stray === 1 ? '' : 's'} with nothing open — a rule was removed and its brace left behind`);
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().replace(/\s+/g, ' ');
    if (selector.startsWith('@') || !isSurface(selector)) continue;
    surfaces++;
    for (const decl of m[2].split(';')) {
      const [prop, ...rest] = decl.split(':');
      const name = prop.trim().toLowerCase();
      if (!materialProperties.includes(name)) continue;
      if (!authored(rest.join(':'))) continue;
      findings.push(`${file}: "${selector.slice(0, 58)}" authors ${name} — only a registered material authority may`);
    }
  }
}

for (const a of authorities) if (!existsSync(path.join(root, a))) findings.push(`registry: ${a} is registered as a material authority and is not there`);

const ok = findings.length === 0;
console.log(JSON.stringify({ok, sheets: scanned, authorities: [...authorities], surfaceRulesChecked: surfaces, findings}, null, findings.length ? 1 : 0));
if (!ok) process.exit(1);
