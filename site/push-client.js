import { PUSH_API_BASE } from './push-config.js';

const API=String(PUSH_API_BASE||'').replace(/\/+$/,'');
const PREPARE_TIMEOUT_MS=12000;
let busy=false,prepared=false,registration=null,publicKey='',subscription=null,preparePromise=null;
const byId=id=>document.getElementById(id);
function capable(){return Boolean(API&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window)}
function base64urlBytes(value){const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes}
function timeout(promise,ms,label){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(label)),ms);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)})})}
async function request(path,options={}){const response=await timeout(fetch(API+path,{credentials:'omit',cache:'no-store',...options,headers:{'content-type':'application/json',...(options.headers||{})}}),PREPARE_TIMEOUT_MS,'Push API timed out');let body={};try{body=await response.json()}catch(_){ }if(!response.ok)throw new Error(body?.error||('Push API '+response.status));return body}
function statusNodes(){return{button:byId('alertsBtn'),status:byId('alertsStatus'),en:byId('alertsStatusEn')}}
function writeStatus(en,state='idle'){const nodes=statusNodes();if(nodes.status)nodes.status.dataset.state=state;if(nodes.en)nodes.en.textContent=en}
function writeButton(label,disabled=false){const button=byId('alertsBtn');if(!button)return;const labelNode=button.querySelector('.action-label')||button;labelNode.textContent=label;button.disabled=disabled}
async function ensureServiceWorker(){
  const candidate=await timeout(navigator.serviceWorker.register('/sw.js',{scope:'/'}),PREPARE_TIMEOUT_MS,'Service worker registration timed out');
  if(candidate?.active)return candidate;
  return timeout(navigator.serviceWorker.ready,PREPARE_TIMEOUT_MS,'Service worker did not become ready');
}
async function prepare(){
  if(prepared)return true;if(preparePromise)return preparePromise;
  preparePromise=(async()=>{
    if(!capable())return false;
    registration=await ensureServiceWorker();
    subscription=await registration.pushManager.getSubscription();
    if(!subscription){const value=await request('/vapid-public-key',{method:'GET',headers:{}});publicKey=String(value?.publicKey||'');if(!publicKey)throw new Error('Missing VAPID public key')}
    prepared=true;return true;
  })().finally(()=>{preparePromise=null});
  return preparePromise;
}
async function render(){
  const {button}=statusNodes();if(!button)return;
  if(!API){writeButton('Alerts unavailable',true);writeStatus('Alert service is not configured yet.','unavailable');return}
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){writeButton('Alerts unavailable',true);writeStatus('This browser does not support Web Push. Install the PWA if your platform requires it.','unavailable');return}
  if(Notification.permission==='denied'){writeButton('Alerts blocked',true);writeStatus('Notifications are blocked in browser or system settings.','blocked');return}
  if(!prepared){writeButton('Preparing alerts…',true);writeStatus('Preparing secure notification support.','working');try{await prepare()}catch(error){console.warn('Push preparation failed',error);prepared=false;registration=null;publicKey='';subscription=null;writeButton('Retry alerts',false);writeStatus('Alert setup did not finish. Tap Retry alerts to try again.','error');return}}
  if(subscription){writeButton('Turn alerts off',busy);writeStatus('Air-quality and severe-weather alerts are on.','on')}else{writeButton('Turn alerts on',busy);writeStatus('Enable alerts only when you want lock-screen updates.','off')}
}
async function enableFromGesture(){
  if(!capable()||busy||!prepared||!registration||!publicKey||subscription)return;
  busy=true;writeButton('Enabling alerts…',true);writeStatus('Waiting for notification permission.','working');let created=null;
  try{
    const subscribePromise=registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64urlBytes(publicKey).buffer});
    created=await subscribePromise;subscription=created;
    const payload=subscription.toJSON();await request('/subscribe',{method:'POST',body:JSON.stringify({endpoint:payload.endpoint,expirationTime:payload.expirationTime??null,keys:payload.keys})});writeStatus('Environmental alerts are enabled.','on');
  }catch(error){console.warn('Push enable failed',error);if(created)try{await created.unsubscribe()}catch(_){ }subscription=null;prepared=false;publicKey='';writeStatus(Notification.permission==='denied'?'Notifications were blocked.':'Could not enable alerts. Please try again.',Notification.permission==='denied'?'blocked':'error')}
  finally{busy=false;await render()}
}
async function disable(){
  if(!capable()||busy||!prepared)return;busy=true;writeButton('Turning alerts off…',true);writeStatus('Removing this device from environmental alerts.','working');
  try{if(subscription){const endpoint=subscription.endpoint;try{await request('/subscribe',{method:'DELETE',body:JSON.stringify({endpoint})})}catch(error){console.warn('Push backend removal failed',error)}await subscription.unsubscribe()}subscription=null;prepared=false;publicKey='';writeStatus('Alerts are off for this device.','off')}catch(error){console.warn('Push disable failed',error);writeStatus('Could not turn alerts off. Please try again.','error')}finally{busy=false;await render()}
}
async function toggleFromGesture(){
  if(busy||!capable())return;
  if(!prepared){await render();return}
  if(subscription)await disable();else await enableFromGesture();
}

document.addEventListener('click',event=>{if(event.target.closest('#alertsBtn')){event.preventDefault();toggleFromGesture().catch(error=>console.warn('Push toggle failed',error))}});
document.addEventListener('sindhorn:route-mounted',()=>render().catch(()=>{}));document.addEventListener('visibilitychange',()=>{if(!document.hidden){prepared=false;registration=null;publicKey='';subscription=null;render().catch(()=>{})}});
window.SindhornPushAlerts={refresh:()=>{prepared=false;registration=null;publicKey='';subscription=null;return render()}};
render().catch(()=>{});
