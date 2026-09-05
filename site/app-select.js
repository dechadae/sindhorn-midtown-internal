/* Canonical selector.

   One implementation of the compact dropdown the app uses for finite choices.
   Before this there were two: filterField() private to fnb.js, and a second
   copy in business-card-settings.js. The CI day-cycle would have been a third,
   which is exactly the duplication this work exists to stop.

   Visual definition still lives in fnb-approved-polish.css under the .fnb-select
   class names, so consuming this component is visually identical to the proven
   F&B selector. Those rules move to the canonical component stylesheet when F&B
   is rebuilt; renaming them now would mean editing F&B markup out of turn.

   Markup contract mirrors fnb.js exactly: a hidden native <select> carries the
   value for forms and assistive technology, a button is the visible trigger,
   and a listbox holds the options. */

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export function selectField({kind,label,values,selected,labelFor=v=>v}){
  const menuId=`fnb-${kind}-menu`;
  return`<div class="fnb-select" data-filter-field="${esc(kind)}">`
    +`<span class="fnb-select-label">${esc(label)}</span>`
    +`<button class="fnb-select-trigger" type="button" data-filter-trigger="${esc(kind)}" aria-label="${esc(label)} filter" aria-haspopup="listbox" aria-expanded="false" aria-controls="${menuId}">`
    +`<span data-filter-value>${esc(labelFor(selected))}</span>`
    +`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5"/></svg></button>`
    +`<select data-${esc(kind)}-select hidden tabindex="-1" aria-hidden="true">`
    +values.map(value=>`<option value="${esc(value)}">${esc(labelFor(value))}</option>`).join('')
    +`</select>`
    +`<div class="fnb-select-menu" id="${menuId}" role="listbox" aria-label="${esc(label)}" aria-hidden="true">`
    +values.map(value=>`<button class="fnb-select-option${value===selected?' is-selected':''}" type="button" role="option" aria-selected="${value===selected}" data-filter-option="${esc(kind)}" data-value="${esc(value)}"><span>${esc(labelFor(value))}</span><i aria-hidden="true"></i></button>`).join('')
    +`</div></div>`;
}

export function bindSelectField(root,kind,onChange,labelFor=v=>v){
  const field=root.querySelector(`[data-filter-field="${kind}"]`);
  if(!field)return()=>{};
  const trigger=field.querySelector('[data-filter-trigger]');
  const menu=field.querySelector('.fnb-select-menu');
  const setOpen=open=>{
    field.classList.toggle('is-open',open);
    trigger?.setAttribute('aria-expanded',String(open));
    menu?.setAttribute('aria-hidden',String(!open));
  };
  const onTrigger=event=>{event.stopPropagation();setOpen(!field.classList.contains('is-open'))};
  const onPick=event=>{
    const option=event.target.closest('[data-filter-option]');
    if(!option)return;
    event.stopPropagation();
    setValue(option.dataset.value);
    setOpen(false);
    onChange?.(option.dataset.value);
  };
  const onOutside=()=>setOpen(false);
  const onKey=event=>{if(event.key==='Escape')setOpen(false)};

  function setValue(value){
    const select=field.querySelector(`select[data-${kind}-select]`);
    if(select&&select.value!==value)select.value=value;
    const valueNode=field.querySelector('[data-filter-value]');
    if(valueNode)valueNode.textContent=labelFor(value);
    field.querySelectorAll('[data-filter-option]').forEach(option=>{
      const isSelected=option.dataset.value===value;
      option.setAttribute('aria-selected',String(isSelected));
      option.classList.toggle('is-selected',isSelected);
    });
  }

  trigger?.addEventListener('click',onTrigger);
  menu?.addEventListener('click',onPick);
  document.addEventListener('click',onOutside);
  document.addEventListener('keydown',onKey);
  return{
    setValue,
    destroy(){
      trigger?.removeEventListener('click',onTrigger);
      menu?.removeEventListener('click',onPick);
      document.removeEventListener('click',onOutside);
      document.removeEventListener('keydown',onKey);
    }
  };
}

/* ---- The library selector ------------------------------------------------
   .app-select is the selector the UI Library specifies (08 Selector) and the
   rebuilt pages consume. The markup is the library's: a trigger control, a
   value span, an overlay menu of options. The root carries the chosen value
   in data-value so a form can read it without a hidden <select>.

   appSelect() writes one; bindAppSelects() makes every selector under a root
   behave - one open at a time, outside tap and Escape close, a pick sets
   aria-selected, the value text and data-value, then reports through
   onChange(kind, value, root). Listeners hang on the AbortSignal the caller
   already owns, so a page disposes them with everything else.

   compact:true is the same selector as a badge (08 Selector, the compact
   specimen): no visible label, the trigger a badge at a tappable height,
   the menu hanging from the trigger's right edge. An option's tone travels
   to the trigger when chosen, so a status reads in its own color. It is
   the status on a job card (23 Job). */
export function appSelect({kind,label,options,selected,disabled=false,compact=false}){
  const current=options.find(o=>String(o.value)===String(selected))||options[0]||{value:'',label:''};
  const toneOf=o=>o.tone?` data-tone="${esc(o.tone)}"`:'';
  return`<div class="app-select" data-select="${esc(kind)}" data-value="${esc(current.value)}"${compact?' data-compact="true"':''}>`
    +(compact?'':`<span class="app-select-label">${esc(label)}</span>`)
    +`<button class="app-select-trigger ${compact?'app-badge':'app-control'}" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(label)}"${compact?toneOf(current):''}${disabled?' disabled':''}><span data-select-value>${esc(current.label)}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5"/></svg></button>`
    +`<div class="app-select-menu app-overlay" role="listbox" aria-label="${esc(label)}">`
    +options.map(o=>`<button class="app-select-option" type="button" role="option" aria-selected="${String(o.value)===String(current.value)}" data-value="${esc(o.value)}"${toneOf(o)}${o.disabled?' disabled':''}>${esc(o.label)}</button>`).join('')
    +`</div></div>`;
}

export function appSelectValue(root,kind){return root.querySelector(`[data-select="${kind}"]`)?.dataset.value??''}

export function setAppSelectValue(root,kind,value,{disabled}={}){
  const field=root.querySelector(`[data-select="${kind}"]`);if(!field)return;
  const trigger=field.querySelector('.app-select-trigger');
  for(const option of menuOf(field).querySelectorAll('.app-select-option')){
    const on=option.dataset.value===String(value);
    option.setAttribute('aria-selected',String(on));
    if(on){
      field.dataset.value=option.dataset.value;
      const text=field.querySelector('[data-select-value]');if(text)text.textContent=option.textContent;
      if(field.dataset.compact==='true'&&trigger){if(option.dataset.tone)trigger.dataset.tone=option.dataset.tone;else delete trigger.dataset.tone}
    }
  }
  if(disabled!==undefined&&trigger)trigger.disabled=disabled;
}

/* The menu of a field, wherever it is: in the field, or lifted to the
   document while open (below). */
const lifted=new WeakMap();let liftedNow=null;
const menuOf=field=>lifted.get(field)||field.querySelector('.app-select-menu');

/* Glass never nests (24 Rules): a menu that opened inside a card would
   sample the card, not the page, and render as a flat tint. So a selector
   that sits in a card lifts its menu to the document while it is open - the
   same element, moved under <body> as position:fixed and anchored to the
   trigger through custom properties the library sets - and takes it back on
   close, so the markup a page wrote is what it reads. Inside a modal dialog
   the top layer already covers the page, so the menu stays where it is. */
const LIFT_FROM='.app-card';
const MENU_GAP=6,EDGE=12,COMPACT_MENU_WIDTH=200;

function anchor(field,trigger,menu){
  const rect=trigger.getBoundingClientRect();
  const compact=field.dataset.compact==='true';
  const width=Math.min(compact?Math.max(rect.width,COMPACT_MENU_WIDTH):rect.width,innerWidth-EDGE*2);
  const left=Math.max(EDGE,Math.min(compact?rect.right-width:rect.left,innerWidth-EDGE-width));
  const ceiling=(document.querySelector('.app-masthead')?.getBoundingClientRect().bottom||0)+MENU_GAP;
  const floor=(document.querySelector('.app-navbar')?.getBoundingClientRect().top||innerHeight)-MENU_GAP;
  const height=menu.offsetHeight;
  const below=rect.bottom+MENU_GAP,above=rect.top-MENU_GAP-height;
  const top=below+height<=floor||above<ceiling?below:above;
  menu.style.setProperty('--app-select-top',`${Math.round(top)}px`);
  menu.style.setProperty('--app-select-left',`${Math.round(left)}px`);
  menu.style.setProperty('--app-select-width',`${Math.round(width)}px`);
}

function lift(field,trigger){
  if(!field.closest(LIFT_FROM)||field.closest('dialog'))return;
  const menu=field.querySelector('.app-select-menu');if(!menu)return;
  lifted.set(field,menu);liftedNow=field;
  menu.dataset.floating='true';
  document.body.append(menu);
  anchor(field,trigger,menu);
}

function lower(field){
  const menu=lifted.get(field);if(!menu)return;
  lifted.delete(field);if(liftedNow===field)liftedNow=null;
  if(menu.contains(document.activeElement))field.querySelector('.app-select-trigger')?.focus({preventScroll:true});
  delete menu.dataset.floating;
  for(const prop of ['--app-select-top','--app-select-left','--app-select-width'])menu.style.removeProperty(prop);
  menu.style.length||menu.removeAttribute('style');
  field.append(menu);
}

export function bindAppSelects(root,{signal,onChange}={}){
  const all=()=>root.querySelectorAll('[data-select]');
  const close=field=>{field.dataset.open='false';field.querySelector('.app-select-trigger')?.setAttribute('aria-expanded','false');lower(field)};
  const closeAll=()=>{for(const field of all())if(field.dataset.open==='true')close(field)};
  const openField=()=>root.querySelector('[data-select][data-open="true"]');
  const pick=(field,option)=>{
    setAppSelectValue(root,field.dataset.select,option.dataset.value);
    close(field);
    onChange?.(field.dataset.select,option.dataset.value,field);
  };
  root.addEventListener('click',event=>{
    const option=event.target.closest('.app-select-option');
    if(option&&root.contains(option)){pick(option.closest('[data-select]'),option);return}
    const trigger=event.target.closest('.app-select-trigger');
    if(trigger&&root.contains(trigger)){
      const field=trigger.closest('[data-select]'),open=field.dataset.open==='true';
      closeAll();
      if(!open){field.dataset.open='true';trigger.setAttribute('aria-expanded','true');lift(field,trigger)}
      event.stopPropagation();
      return;
    }
    closeAll();
  },{signal});
  // A lifted menu is outside the root: its picks, and taps anywhere else on
  // the document, arrive here.
  document.addEventListener('click',event=>{
    const field=openField();if(!field||!lifted.has(field))return;
    const menu=lifted.get(field);
    const option=event.target.closest('.app-select-option');
    if(option&&menu.contains(option)){pick(field,option);return}
    if(!menu.contains(event.target))close(field);
  },{signal});
  // The anchor is a snapshot: a scroll or a resize under an open menu
  // closes it rather than leaving it hanging in the wrong place.
  addEventListener('scroll',event=>{const field=openField();if(field&&lifted.has(field)&&!lifted.get(field).contains(event.target))close(field)},{capture:true,passive:true,signal});
  addEventListener('resize',()=>{const field=openField();if(field&&lifted.has(field))close(field)},{signal});
  // Escape closes an open menu and is consumed there, so a dialog around the
  // selector does not close on the same key.
  const onEscape=event=>{if(event.key!=='Escape')return;if(openField()){event.preventDefault();event.stopPropagation()}closeAll()};
  root.addEventListener('keydown',onEscape,{signal});
  document.addEventListener('keydown',event=>{const field=openField();if(field&&lifted.has(field)&&lifted.get(field).contains(event.target))onEscape(event)},{signal});
  // A page that goes away takes its lifted menu with it.
  signal?.addEventListener('abort',()=>{closeAll();if(liftedNow&&!liftedNow.isConnected)lower(liftedNow)},{once:true});
  return closeAll;
}
