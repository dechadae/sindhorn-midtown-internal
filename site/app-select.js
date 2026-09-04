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
   already owns, so a page disposes them with everything else. */
export function appSelect({kind,label,options,selected,disabled=false}){
  const current=options.find(o=>String(o.value)===String(selected))||options[0]||{value:'',label:''};
  return`<div class="app-select" data-select="${esc(kind)}" data-value="${esc(current.value)}">`
    +`<span class="app-select-label">${esc(label)}</span>`
    +`<button class="app-select-trigger app-control" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(label)}"${disabled?' disabled':''}><span data-select-value>${esc(current.label)}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5"/></svg></button>`
    +`<div class="app-select-menu app-overlay" role="listbox" aria-label="${esc(label)}">`
    +options.map(o=>`<button class="app-select-option" type="button" role="option" aria-selected="${String(o.value)===String(current.value)}" data-value="${esc(o.value)}"${o.disabled?' disabled':''}>${esc(o.label)}</button>`).join('')
    +`</div></div>`;
}

export function appSelectValue(root,kind){return root.querySelector(`[data-select="${kind}"]`)?.dataset.value??''}

export function setAppSelectValue(root,kind,value,{disabled}={}){
  const field=root.querySelector(`[data-select="${kind}"]`);if(!field)return;
  for(const option of field.querySelectorAll('.app-select-option')){
    const on=option.dataset.value===String(value);
    option.setAttribute('aria-selected',String(on));
    if(on){field.dataset.value=option.dataset.value;const text=field.querySelector('[data-select-value]');if(text)text.textContent=option.textContent}
  }
  if(disabled!==undefined){const trigger=field.querySelector('.app-select-trigger');if(trigger)trigger.disabled=disabled}
}

export function bindAppSelects(root,{signal,onChange}={}){
  const all=()=>root.querySelectorAll('[data-select]');
  const close=field=>{field.dataset.open='false';field.querySelector('.app-select-trigger')?.setAttribute('aria-expanded','false')};
  const closeAll=()=>{for(const field of all())if(field.dataset.open==='true')close(field)};
  root.addEventListener('click',event=>{
    const option=event.target.closest('.app-select-option');
    if(option&&root.contains(option)){
      const field=option.closest('[data-select]');
      setAppSelectValue(root,field.dataset.select,option.dataset.value);
      close(field);
      onChange?.(field.dataset.select,option.dataset.value,field);
      return;
    }
    const trigger=event.target.closest('.app-select-trigger');
    if(trigger&&root.contains(trigger)){
      const field=trigger.closest('[data-select]'),open=field.dataset.open==='true';
      closeAll();
      if(!open){field.dataset.open='true';trigger.setAttribute('aria-expanded','true')}
      event.stopPropagation();
      return;
    }
    closeAll();
  },{signal});
  // Escape closes an open menu and is consumed there, so a dialog around the
  // selector does not close on the same key.
  root.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(root.querySelector('[data-select][data-open="true"]')){event.preventDefault();event.stopPropagation()}closeAll()},{signal});
  return closeAll;
}
