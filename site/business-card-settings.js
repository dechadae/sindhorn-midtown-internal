import {getAccessToken,supabaseRpc} from './auth-client.js';
import {loadSettingsAuthority} from './capabilities.js';
import {businessCardUrl} from './business-card-core.js';

const HOTEL_NAME='Sindhorn Midtown Hotel Bangkok, Vignette Collection by IHG';
const HOTEL_LOGO='/assets/brand/sindhorn-midtown-vignette-white.png';

function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function disabled(value){return value?' disabled':''}
function optionHTML(value,label){return`<option value="${esc(value)}">${esc(label)}</option>`}
function selectField({key,label,dataAttr,options,full=false}){
  const menuId=`settings-${key}-menu`;
  return`<div class="settings-field${full?' settings-full':''}"><label>${esc(label)}</label><div class="fnb-select settings-select" data-settings-select="${esc(key)}"><button class="fnb-select-trigger settings-select-trigger" type="button" data-settings-select-trigger="${esc(key)}" aria-label="${esc(label)}" aria-haspopup="listbox" aria-expanded="false" aria-controls="${menuId}"><span data-settings-select-value></span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5"/></svg></button><select data-${dataAttr} hidden tabindex="-1" aria-hidden="true">${options.map(item=>optionHTML(item.value,item.label)).join('')}</select><div class="fnb-select-menu" id="${menuId}" role="listbox" aria-label="${esc(label)}" aria-hidden="true"></div></div></div>`;
}
function syncSettingsSelect(select){
  if(!select)return;
  const field=select.closest('[data-settings-select]'),trigger=field?.querySelector('[data-settings-select-trigger]'),valueNode=field?.querySelector('[data-settings-select-value]'),menu=field?.querySelector('.fnb-select-menu');
  if(!field||!trigger||!valueNode||!menu)return;
  const options=[...select.options],selected=options.find(option=>option.value===select.value)||options[0];
  valueNode.textContent=selected?.textContent||'';
  trigger.disabled=select.disabled;
  menu.innerHTML=options.map(option=>`<button class="fnb-select-option${option.value===select.value?' is-selected':''}" type="button" role="option" aria-selected="${option.value===select.value}" data-settings-select-option data-value="${esc(option.value)}" ${option.disabled?'disabled':''}><span>${esc(option.textContent)}</span><i aria-hidden="true"></i></button>`).join('');
}
function setSelect(dialog,selector,value,disabledValue=false){
  const select=dialog.querySelector(selector);
  if(!select)return;
  select.value=String(value);
  select.disabled=disabledValue;
  syncSettingsSelect(select);
}
async function copyText(value){
  try{await navigator.clipboard.writeText(value);return true}catch(_){}
  const area=document.createElement('textarea');
  area.value=value;area.readOnly=true;area.style.position='fixed';area.style.opacity='0';
  document.body.append(area);area.select();let ok=false;
  try{ok=document.execCommand('copy')}catch(_){}
  area.remove();return ok;
}

export async function mountSettingsBusinessCard(root){
  let disposed=false,data=null,statusTimer=0;
  const cleanup=[];
  const authority=await loadSettingsAuthority();
  const capabilities=new Set(authority?.capabilities||[]);
  if(!capabilities.has('business_card.read'))return()=>{};
  const canManage=capabilities.has('business_card.manage_self');
  const route=root.querySelector('.settings-route');
  if(!route)return()=>{};
  const on=(target,event,handler,options)=>{target?.addEventListener(event,handler,options);cleanup.push(()=>target?.removeEventListener(event,handler,options))};

  const presentDialog=document.createElement('dialog');
  presentDialog.className='business-card-present-dialog';
  presentDialog.innerHTML=`<button class="business-card-present-close" type="button" data-bc-present-close aria-label="Close">×</button><iframe class="business-card-present-frame" data-bc-present-frame title="Business card"></iframe>`;
  route.append(presentDialog);

  const visibilityOptions=[{value:'true',label:'Shown'},{value:'false',label:'Hidden'}];
  const editDialog=document.createElement('dialog');
  editDialog.className='settings-dialog business-card-edit-dialog';
  editDialog.innerHTML=`<form method="dialog" class="settings-dialog-body" data-bc-edit-form>
    <div class="settings-dialog-head"><div><p class="settings-dialog-kicker">My business card</p><h2>Edit card</h2></div><button class="settings-close" type="button" data-bc-edit-close aria-label="Close">×</button></div>
    <div class="settings-form-grid">
      <div class="settings-field"><label>Business mobile <span>Optional · E.164</span></label><input type="tel" inputmode="tel" maxlength="16" placeholder="+66…" autocomplete="off" data-bc-mobile></div>
      <div class="settings-field"><label>Direct phone <span>Optional</span></label><input type="tel" inputmode="tel" maxlength="64" autocomplete="off" data-bc-direct></div>
      ${selectField({key:'bc-published',label:'Public card',dataAttr:'bc-published',options:[{value:'true',label:'Published'},{value:'false',label:'Unpublished'}]})}
      <div class="settings-field"><label>Permanent URL</label><input data-bc-public-url disabled></div>
      <div class="settings-form-section settings-full"><span>Published fields</span><small>Choose what appears on the public business card.</small></div>
      ${selectField({key:'bc-position-title',label:'Position title',dataAttr:'bc-position-title',options:visibilityOptions})}
      ${selectField({key:'bc-work-email',label:'Work email',dataAttr:'bc-work-email',options:visibilityOptions})}
      ${selectField({key:'bc-business-mobile',label:'Business mobile',dataAttr:'bc-business-mobile',options:visibilityOptions})}
      ${selectField({key:'bc-direct-phone',label:'Direct phone',dataAttr:'bc-direct-phone',options:visibilityOptions})}
      ${selectField({key:'bc-hotel-phone',label:'Hotel telephone',dataAttr:'bc-hotel-phone',options:visibilityOptions})}
      ${selectField({key:'bc-hotel-address',label:'Hotel address',dataAttr:'bc-hotel-address',options:visibilityOptions})}
      ${selectField({key:'bc-hotel-website',label:'Hotel website',dataAttr:'bc-hotel-website',options:visibilityOptions})}
      <div class="settings-field settings-full"><label>Hotel identity</label><input data-bc-hotel-identity disabled></div>
    </div>
    <div class="settings-status" data-bc-edit-status role="status" aria-live="polite"></div>
    <div class="settings-dialog-actions"><button type="button" data-bc-edit-cancel>Cancel</button><button class="settings-primary" type="submit" data-bc-edit-save${disabled(!canManage)}>Save</button></div>
  </form>`;
  route.append(editDialog);

  function setInlineStatus(message){
    const node=route.querySelector('[data-bc-inline-status]');if(!node)return;
    node.textContent=message||'';node.dataset.show=String(Boolean(message));
    clearTimeout(statusTimer);if(message)statusTimer=setTimeout(()=>{if(!disposed)node.dataset.show='false'},1800);
  }
  function setEditStatus(message,tone='neutral'){
    const node=editDialog.querySelector('[data-bc-edit-status]');if(!node)return;
    node.textContent=message||'';node.dataset.show=String(Boolean(message));node.dataset.tone=tone;
  }
  function actionsMarkup(){
    if(!data?.card)return'<div class="business-card-settings-actions is-loading" data-bc-settings-host></div>';
    const published=data.card.published===true;
    return`<div class="business-card-settings-actions" data-bc-settings-host><p>Business card</p><div><button class="settings-quiet-action" type="button" data-bc-present${disabled(!published)}>Present QR</button><button class="settings-quiet-action" type="button" data-bc-share${disabled(!published)}>Share</button>${canManage?'<button class="settings-quiet-action" type="button" data-bc-edit>Edit card</button>':''}</div><span class="business-card-inline-status" data-bc-inline-status role="status" aria-live="polite"></span></div>`;
  }
  function inject(){
    const section=route.querySelector('.settings-account-section'),accountActions=section?.querySelector('.settings-account-actions');
    if(!section||!accountActions)return;
    section.querySelector('[data-bc-settings-host]')?.remove();
    accountActions.insertAdjacentHTML('beforebegin',actionsMarkup());
  }
  function openPresent(){
    if(!data?.card?.published)return;
    const url=businessCardUrl(location.origin,data.card.publicSlug),frame=presentDialog.querySelector('[data-bc-present-frame]');
    if(frame.src!==url)frame.src=url;
    if(!presentDialog.open)presentDialog.showModal();
  }
  function closePresent(){if(presentDialog.open)presentDialog.close()}
  function fillEdit(){
    if(!data?.card)return;
    const card=data.card,hotel=data.hotel,vis=card.fieldVisibility||{},lock=!canManage;
    const mobile=editDialog.querySelector('[data-bc-mobile]'),direct=editDialog.querySelector('[data-bc-direct]');
    mobile.value=card.businessMobile||'';direct.value=card.directPhone||'';mobile.disabled=lock;direct.disabled=lock;
    editDialog.querySelector('[data-bc-public-url]').value=businessCardUrl(location.origin,card.publicSlug);
    editDialog.querySelector('[data-bc-hotel-identity]').value=hotel?.hotelName||HOTEL_NAME;
    setSelect(editDialog,'[data-bc-published]',card.published===true,lock);
    setSelect(editDialog,'[data-bc-position-title]',vis.positionTitle!==false,lock);
    setSelect(editDialog,'[data-bc-work-email]',vis.workEmail!==false,lock);
    setSelect(editDialog,'[data-bc-business-mobile]',vis.businessMobile!==false,lock);
    setSelect(editDialog,'[data-bc-direct-phone]',vis.directPhone!==false,lock);
    setSelect(editDialog,'[data-bc-hotel-phone]',vis.hotelPhone!==false,lock);
    setSelect(editDialog,'[data-bc-hotel-address]',vis.hotelAddress!==false,lock);
    setSelect(editDialog,'[data-bc-hotel-website]',vis.hotelWebsite!==false,lock);
    setEditStatus('');
  }
  function openEdit(){fillEdit();if(!editDialog.open)editDialog.showModal()}
  function closeEdit(){if(editDialog.open)editDialog.close()}
  async function share(){
    if(!data?.card?.published){setInlineStatus('Publish the card before sharing');return}
    const card=data.card,hotel=data.hotel,url=businessCardUrl(location.origin,card.publicSlug),title=`${card.displayName} | ${hotel.hotelName||HOTEL_NAME}`,text=[card.displayName,card.positionTitle,hotel.hotelName||HOTEL_NAME].filter(Boolean).join(' · ');
    if(typeof navigator.share==='function'){try{await navigator.share({title,text,url});return}catch(error){if(error?.name==='AbortError')return}}
    setInlineStatus(await copyText(url)?'Link copied':'Copy link failed');
  }
  async function saveEdit(event){
    event.preventDefault();if(!canManage||!data?.card)return;
    const save=editDialog.querySelector('[data-bc-edit-save]');
    const shown=selector=>editDialog.querySelector(selector)?.value==='true';
    save.disabled=true;setEditStatus('Saving…');
    try{
      const token=getAccessToken();if(!token)throw new Error('authentication_required');
      data=await supabaseRpc('sindhorn_business_card_update_self',{
        p_business_mobile_e164:editDialog.querySelector('[data-bc-mobile]').value.trim()||null,
        p_direct_phone:editDialog.querySelector('[data-bc-direct]').value.trim()||null,
        p_published:shown('[data-bc-published]'),
        p_show_position_title:shown('[data-bc-position-title]'),
        p_show_work_email:shown('[data-bc-work-email]'),
        p_show_business_mobile:shown('[data-bc-business-mobile]'),
        p_show_direct_phone:shown('[data-bc-direct-phone]'),
        p_show_hotel_phone:shown('[data-bc-hotel-phone]'),
        p_show_hotel_address:shown('[data-bc-hotel-address]'),
        p_show_hotel_website:shown('[data-bc-hotel-website]')
      },{accessToken:token});
      inject();closeEdit();setInlineStatus('Business card updated');
    }catch(error){
      const message=String(error?.message||'').toLowerCase();
      setEditStatus(message.includes('invalid business mobile')?'Use an international business mobile such as +66…':'The business card could not be saved.','error');
    }finally{save.disabled=false}
  }

  const clickHandler=event=>{
    if(event.target.closest('[data-bc-present]')){openPresent();return}
    if(event.target.closest('[data-bc-share]')){void share();return}
    if(event.target.closest('[data-bc-edit]')){openEdit();return}
    if(event.target.closest('[data-bc-present-close]')){closePresent();return}
    if(event.target.closest('[data-bc-edit-close],[data-bc-edit-cancel]'))closeEdit();
  };
  const sectionChanged=event=>{if(event?.detail?.section==='account')requestAnimationFrame(inject)};
  on(route,'click',clickHandler);
  on(editDialog.querySelector('[data-bc-edit-form]'),'submit',saveEdit);
  on(document,'sindhorn:settings-section-changed',sectionChanged);

  inject();
  try{
    const token=getAccessToken();if(!token)throw new Error('authentication_required');
    data=await supabaseRpc('sindhorn_business_card_self',{}, {accessToken:token});
    if(!data?.card?.publicSlug)throw new Error('business_card_unavailable');
  }catch(_){data=null}
  if(!disposed)inject();

  return()=>{
    disposed=true;clearTimeout(statusTimer);cleanup.splice(0).forEach(fn=>fn());
    closePresent();closeEdit();presentDialog.remove();editDialog.remove();
    route.querySelector('[data-bc-settings-host]')?.remove();
  };
}

void HOTEL_LOGO;
