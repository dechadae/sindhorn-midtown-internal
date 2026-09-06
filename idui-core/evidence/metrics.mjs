/* The metric definitions, shared by every IDUI transfer test.

   Extracted from idui-core/evidence/rebuild/measure.mjs on 6 September 2026,
   unchanged, when Test 03 needed the same definitions for a different product.
   The harness around them is necessarily per-product - each source page is
   composed and served differently - but the definitions must not be, or a
   comparison between tests measures the measurer rather than the products.
   Flipgazine's comparison.json is byte-identical across this extraction, which
   is the proof the move was faithful.

   CHANGES is the propagation list. It is deliberately shared too: a test that
   invents its own list of "representative changes" can pick flattering ones. */

export function cssMetrics(css){
  const strip=css.replace(/\/\*[\s\S]*?\*\//g,'');
  const rules=(strip.match(/\{[^{}]*\}/g)||[]).length;
  return {
    bytes:Buffer.byteLength(css),
    rules,
    important:(strip.match(/!important/g)||[]).length,
    media:(strip.match(/@media/g)||[]).length,
    literalFontSizes:new Set((strip.match(/font-size:\s*([^;}]+)/g)||[]).filter(v=>!/var\(/.test(v))).size,
    literalRadii:new Set((strip.match(/border-radius:\s*([^;}]+)/g)||[]).filter(v=>!/var\(/.test(v))).size,
    backdropFilters:(strip.match(/backdrop-filter:/g)||[]).length,
    hexColors:new Set((strip.match(/#[0-9a-fA-F]{3,8}\b/g)||[]).map(s=>s.toLowerCase())).size,
  };
}
export function markupMetrics(html){
  const styleBlocks=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]);
  const inlineStyleAttrs=(html.replace(/<code>[\s\S]*?<\/code>/g,'').match(/\sstyle="/g)||[]).length;
  const classes=new Set();
  for(const m of html.replace(/<code>[\s\S]*?<\/code>/g,'').matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach(c=>classes.add(c));
  return {bytes:Buffer.byteLength(html),styleBlocks:styleBlocks.length,pageCss:cssMetrics(styleBlocks.join('\n')),inlineStyleAttrs,distinctClasses:classes.size,classList:[...classes].sort()};
}

/* ---- architecture metrics ----
   Discretionary appearance decisions: declarations in page-authored CSS or
   style attributes whose value is a literal, not a token — each one is a
   choice the page made on its own. Semantic declarations: the distinct
   classes and data attributes the page must write to get its look. Change
   propagation distance: for a named visual change, how many literal
   declarations must be edited. */
export const APPEARANCE=/^(font-size|font-weight|font-family|letter-spacing|line-height|color|background|background-color|border|border-color|border-radius|padding|margin|gap|box-shadow|backdrop-filter|-webkit-backdrop-filter|opacity|text-transform|width|height|min-height|max-width)$/;
export function declarations(css){
  const strip=css.replace(/\/\*[\s\S]*?\*\//g,'');
  const out=[];
  for(const m of strip.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
    const sel=m[1].trim();
    for(const d of m[2].split(';')){const i=d.indexOf(':');if(i<0)continue;out.push({sel,prop:d.slice(0,i).trim(),value:d.slice(i+1).trim()})}
  }
  return out;
}
export function discretionary(css,html){
  const decl=declarations(css).filter(d=>APPEARANCE.test(d.prop)&&!/var\(/.test(d.value)&&!/^(0|none|inherit|transparent|currentColor|auto)$/.test(d.value));
  const inline=[...html.replace(/<code>[\s\S]*?<\/code>/g,'').matchAll(/\sstyle="([^"]*)"/g)].flatMap(m=>m[1].split(';').filter(x=>x.includes(':')));
  return {cssDecisions:decl.length,inlineDecisions:inline.length,total:decl.length+inline.length,byProperty:Object.fromEntries([...decl.reduce((m,d)=>m.set(d.prop,(m.get(d.prop)||0)+1),new Map())].sort((a,b)=>b[1]-a[1]))};
}
export function semantic(html){
  const body=html.replace(/<code>[\s\S]*?<\/code>/g,'').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'');
  const classes=new Set(),attrs=new Set();
  for(const m of body.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach(c=>classes.add(c));
  for(const m of body.matchAll(/\s(data-[a-z-]+)(?:="([^"]*)")?/g)) attrs.add(m[1]+(m[2]!==undefined?'='+m[2]:''));
  const names=new Set([...attrs].map(a=>a.split('=')[0]));
  return {classes:classes.size,dataAttributeNames:names.size,dataAttributeValues:attrs.size,total:classes.size+names.size,classList:[...classes].sort(),attrList:[...attrs].sort()};
}
/* literal declarations that must change for one named visual change */
export const CHANGES={
  'chip radius':{prop:/^border-radius$/,sel:/chip|copy|mode-btn|btn|ed-switch|control|pill/i,token:/^--radius-control$/},
  'label tracking':{prop:/^letter-spacing$/,sel:/./,token:/^--tracking-label$/},
  'glass recipe':{prop:/^(-webkit-)?backdrop-filter$/,sel:/./,token:/^--app-glass-filter$/},
  'body face':{prop:/^font-family$/,sel:/./,token:/^--font-ui$/},
  'label weight':{prop:/^font-weight$/,sel:/eyebrow|nt|st|sy|chip|btn|brand|num|label/i,token:/^--weight-label$/},
};
export function propagation(sources){
  const out={};
  for(const [name,c] of Object.entries(CHANGES)){
    out[name]={};
    for(const [src,css] of Object.entries(sources)){
      /* a literal declaration is one edit; a token definition is one edit;
         a declaration that consumes a token is none */
      const hits=declarations(css).filter(d=>(c.prop.test(d.prop)&&c.sel.test(d.sel)&&!/var\(/.test(d.value)&&!/^(none|0|inherit)$/.test(d.value))||c.token.test(d.prop));
      out[name][src]=hits.length;
    }
    out[name].total=Object.values(out[name]).reduce((a,b)=>a+b,0);
  }
  return out;
}

/* The rendered probe: what the browser actually computed, as opposed to what
   the source declared. Shared for the same reason the rest is. */
export const RENDER=`(()=>{
  const els=[...document.querySelectorAll('body *')].filter(e=>!e.closest('#bgLetters,#glCanvas,.environment-stage,script,style,svg'));
  const vis=els.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0});
  const set=k=>{const s=new Map();for(const e of vis){const v=getComputedStyle(e)[k];s.set(v,(s.get(v)||0)+1)}return [...s].sort((a,b)=>b[1]-a[1])};
  const bf=vis.map(e=>getComputedStyle(e).backdropFilter||getComputedStyle(e).webkitBackdropFilter).filter(v=>v&&v!=='none');
  const nested=vis.filter(e=>{const f=getComputedStyle(e).backdropFilter;if(!f||f==='none')return false;let p=e.parentElement;while(p){const g=getComputedStyle(p).backdropFilter;if(g&&g!=='none')return true;p=p.parentElement}return false}).length;
  const runtimeInline=[...document.querySelectorAll('[style]')].filter(e=>!e.closest('#bgLetters,.environment-stage')&&e.id!=='glCanvas').map(e=>e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+'['+e.getAttribute('style').slice(0,60)+']');
  const sheets=[...document.styleSheets].map(s=>({href:s.href?s.href.split('/').slice(-3).join('/'):(s.ownerNode&&s.ownerNode.id)||'inline',rules:(()=>{try{return s.cssRules.length}catch{return -1}})()}));
  return {
    elements:els.length, visible:vis.length,
    fontSizes:set('fontSize'), fontWeights:set('fontWeight'), letterSpacings:set('letterSpacing'),
    radii:set('borderRadius').filter(([v])=>v!=='0px'), lineHeights:set('lineHeight'),
    colors:set('color'), backdropFilters:[...new Set(bf)], backdropCount:bf.length, nestedGlass:nested,
    runtimeInline, sheets, docHeight:document.documentElement.scrollHeight,
    fontFamily:getComputedStyle(document.body).fontFamily,
    tokens:Object.fromEntries(['--accent','--bg','--text','--muted','--surface','--app-accent','--app-ground','--app-text'].map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue(k).trim()]))
  };
})()`;
