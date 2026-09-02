import {loadSettingsAuthority,hasCapability} from '../capabilities.js';

let stylePromise=null;
function ensureStyle(){
  if(stylePromise)return stylePromise;
  stylePromise=new Promise(resolve=>{
    const existing=document.querySelector('link[data-ui-ci-style]');
    if(existing){resolve();return}
    const link=document.createElement('link');
    link.rel='stylesheet';link.href='/ui/ci.css';link.dataset.uiCiStyle='true';
    link.addEventListener('load',resolve,{once:true});link.addEventListener('error',resolve,{once:true});
    document.head.appendChild(link);
  });
  return stylePromise;
}

const backIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>';
const shareIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 13v6h14v-6"/></svg>';

function section(title,copy,body){return `<section class="ui-ci__section"><header class="ui-ci__section-head"><p class="ui-eyebrow">${title}</p><p class="ui-copy">${copy}</p></header>${body}</section>`}
function card(title,copy,extra=''){return `<article class="ui-card"><p class="ui-eyebrow">${title}</p><p class="ui-copy ui-ci__body-copy">${copy}</p>${extra}</article>`}

export async function mountCiRoute(host){
  await ensureStyle();
  let authority;
  try{authority=await loadSettingsAuthority()}catch(_){authority=null}
  if(!hasCapability('developer.ui_library',authority)){
    host.innerHTML='<section class="ui-ci"><header class="ui-route-hero"><p class="ui-eyebrow">Developer</p><h1 class="ui-title">UI Library</h1><p class="ui-copy">This route requires the developer UI Library capability.</p></header></section>';
    return()=>{};
  }

  const route=document.createElement('section');
  route.className='ui-ci';
  route.innerHTML=`
    <header class="ui-route-hero">
      <div class="ui-route-hero__head"><div><p class="ui-eyebrow">Developer</p><h1 class="ui-title">UI Library</h1></div><button class="ui-utility-action" type="button" data-ui-top>${shareIcon}<span>Back to top</span></button></div>
      <p class="ui-copy">Living production primitives for the rebuilt Sindhorn Midtown Internal shell. These specimens use the exact classes routes consume.</p>
    </header>
    ${section('Typography','LINE Seed Sans TH only. Real weights 100 / 400 / 700. Letter spacing is always zero.',`<div class="ui-card ui-ci__type-sample"><p class="ui-ci__type-thin">Thin 100 · Sindhorn Midtown · โรงแรมสินธร มิดทาวน์</p><p class="ui-ci__type-regular">Regular 400 · Sindhorn Midtown · โรงแรมสินธร มิดทาวน์</p><p class="ui-ci__type-bold">Bold 700 · Sindhorn Midtown · โรงแรมสินธร มิดทาวน์</p></div>`)}
    ${section('Colors + Glass','One purple, one white, one Sorbet accent and one canonical frosted material.',`<div class="ui-ci__swatches"><div class="ui-ci__swatch" data-token="vignette">Vignette</div><div class="ui-ci__swatch" data-token="white">White</div><div class="ui-ci__swatch" data-token="sorbet">Sorbet</div><div class="ui-ci__swatch" data-token="glass">Glass · 18px</div></div>`)}
    ${section('Spacing + Shape','Spacing, radii and controls come from shared tokens rather than route values.',`<div class="ui-ci__spacing"><div class="ui-ci__space" data-space="1">4</div><div class="ui-ci__space" data-space="2">8</div><div class="ui-ci__space" data-space="4">16</div><div class="ui-ci__space" data-space="6">24</div><div class="ui-ci__space" data-space="8">32</div><div class="ui-ci__space" data-space="12">48</div></div>`)}
    ${section('Cards','Every card derives from one frosted material; semantics change layout and behavior, not the material.',`<div class="ui-ci__specimens ui-ci__specimens--2">${card('Default card','Informational content with no false affordance.')}${card('Interactive card','Whole surface is actionable.','<div class="ui-actions ui-ci__actions-top"><button class="ui-button ui-button--secondary" type="button">Open detail</button></div>')}</div>`)}
    ${section('Buttons + Utility Actions','Primary, glass secondary, back control and frameless utility action share one interaction grammar.',`<div class="ui-actions"><button class="ui-button ui-button--primary" type="button">Primary</button><button class="ui-button ui-button--secondary" type="button">Secondary</button><button class="ui-back-control" type="button" aria-label="Back">${backIcon}</button><button class="ui-utility-action" type="button">${shareIcon}<span>Share</span></button></div>`)}
    ${section('Chips + Status','Metadata and finite filters use the same chip primitive.',`<div class="ui-actions"><button class="ui-chip is-active" type="button">Active</button><button class="ui-chip" type="button">Bangkok’78</button><span class="ui-chip ui-status-chip" data-tone="success">Live</span><span class="ui-chip ui-status-chip" data-tone="warning">Delayed</span><span class="ui-chip ui-status-chip" data-tone="error">Error</span></div>`)}
    ${section('Selectors + Forms','Inputs and selectors consume the canonical glass material and focus system.',`<div class="ui-ci__specimens ui-ci__specimens--2"><div class="ui-field"><label for="ci-search">Search</label><input class="ui-input" id="ci-search" type="search" placeholder="Search employees"></div><div class="ui-select"><button class="ui-select-trigger" type="button"><span>All outlets</span><span aria-hidden="true">⌄</span></button></div></div>`)}
    ${section('Disclosure','Disclosure cards remain one material and reveal content inside the same object.',`<article class="ui-card ui-card--disclosure"><button class="ui-card__button" type="button" aria-expanded="true"><p class="ui-eyebrow">Disclosure</p><p class="ui-copy ui-ci__body-copy--tight">Hotel reference detail</p></button><div class="ui-card__panel"><p class="ui-copy">The panel inherits card spacing and material instead of introducing a new route skin.</p></div></article>`)}
    ${section('Secondary Navigation','F&B and Settings consume one sticky contextual navigation primitive.',`<nav class="ui-secondary-nav" aria-label="Contextual navigation"><a class="ui-secondary-nav__item" href="#" aria-current="page">Overview</a><a class="ui-secondary-nav__item" href="#">Brief</a><a class="ui-secondary-nav__item" href="#">Copy</a><a class="ui-secondary-nav__item" href="#">Artwork</a></nav>`)}
    ${section('Loading','Startup and route loading use pulse/crossfade only. No ray, arrow, shimmer sweep or temporary fish artwork.',`<div class="ui-skeleton-stack"><div class="ui-skeleton ui-skeleton--line ui-ci__loading-label"></div><div class="ui-skeleton ui-skeleton--title"></div><div class="ui-skeleton ui-skeleton--card"></div><div class="ui-skeleton ui-skeleton--card"></div></div>`)}
    ${section('Table','Dense data stays semantic and horizontally scrollable on small screens.',`<div class="ui-table-wrap"><table class="ui-table"><thead><tr><th>Metric</th><th>Actual</th><th>Budget</th><th>Status</th></tr></thead><tbody><tr><td>Rooms</td><td>82.4%</td><td>80.0%</td><td>On track</td></tr><tr><td>F&B</td><td>1.24m</td><td>1.18m</td><td>Above</td></tr></tbody></table></div>`)}
    ${section('Dialog','Dialogs use the same frosted material, radii, controls and focus treatment.',`<button class="ui-button ui-button--secondary" type="button" data-ui-dialog-open>Open dialog</button><dialog class="ui-dialog" data-ui-dialog><div class="ui-dialog__body"><p class="ui-eyebrow">Dialog</p><h2 class="ui-ci__dialog-title">Central dialog primitive</h2><p class="ui-copy">Routes provide content; the shell system owns the material and action layout.</p></div><div class="ui-dialog__actions"><button class="ui-button ui-button--secondary" type="button" data-ui-dialog-close>Close</button><button class="ui-button ui-button--primary" type="button" data-ui-dialog-close>Done</button></div></dialog>`)}
    <p class="ui-ci__footer-note">Header and footer visible around this route are the live persistent shell specimens; CI intentionally does not draw duplicate imitations.</p>`;
  host.replaceChildren(route);

  const top=route.querySelector('[data-ui-top]');
  const dialog=route.querySelector('[data-ui-dialog]');
  const open=route.querySelector('[data-ui-dialog-open]');
  const closes=route.querySelectorAll('[data-ui-dialog-close]');
  const onTop=()=>window.scrollTo({top:0,behavior:'smooth'});
  const onOpen=()=>dialog?.showModal?.();
  const onClose=()=>dialog?.close?.();
  top?.addEventListener('click',onTop);open?.addEventListener('click',onOpen);closes.forEach(button=>button.addEventListener('click',onClose));
  return()=>{top?.removeEventListener('click',onTop);open?.removeEventListener('click',onOpen);closes.forEach(button=>button.removeEventListener('click',onClose));dialog?.close?.();route.remove()};
}
