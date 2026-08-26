import { PUSH_API_BASE } from './push-config.js';

const API=String(PUSH_API_BASE||'').replace(/\/+$/,'');
let busy=false,prepared=false,registration=null,publicKey='',subscription=null,preparePromise=null;
const byId=id=>document.getElementById(id);
function capable(){return Boolean(API&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window)}
function base64urlBytes(value){const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes}
async function request(path,options={}){const response=await fetch(API+path,{credentials:'omit',cache:'no-store',...options,headers:{'content-type':'application/json',...(options.headers||{})}});let body={};try{body=await response.json()}catch(_){ }if(!response.ok)throw new Error(body?.error||('Push API '+response.status));return body}
function statusNodes(){return{button:byId('alertsBtn'),status:byId('alertsStatus'),en:byId('alertsStatusEn'),th:byId('alertsStatusTh')}}
function writeStatus(en,th,state='idle'){const nodes=statusNodes();if(nodes.status)nodes.status.dataset.state=state;if(nodes.en)nodes.en.textContent=en;if(nodes.th)nodes.th.textContent=th}
function writeButton(label,disabled=false){const button=byId('alertsBtn');if(!button)return;const labelNode=button.querySelector('.action-label')||button;labelNode.textContent=label;button.disabled=disabled}
async function prepare(){
  if(prepared)return true;if(preparePromise)return preparePromise;
  preparePromise=(async()=>{
    if(!capable())return false;
    registration=await navigator.serviceWorker.ready;
    subscription=await registration.pushManager.getSubscription();
    if(!subscription){const value=await request('/vapid-public-key',{method:'GET',headers:{}});publicKey=String(value?.publicKey||'');if(!publicKey)throw new Error('Missing VAPID public key')}
    prepared=true;return true;
  })().finally(()=>{preparePromise=null});
  return preparePromise;
}
async function render(){
  const {button}=statusNodes();if(!button)return;
  if(!API){writeButton('Alerts unavailable',true);writeStatus('Alert service is not configured yet.','ระบบแจ้งเตือนยังไม่พร้อมใช้งาน','unavailable');return}
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){writeButton('Alerts unavailable',true);writeStatus('This browser does not support Web Push. Install the PWA if your platform requires it.','เบราว์เซอร์นี้ไม่รองรับ Web Push โปรดติดตั้ง PWA หากอุปกรณ์ของคุณกำหนดให้ติดตั้งก่อน','unavailable');return}
  if(Notification.permission==='denied'){writeButton('Alerts blocked',true);writeStatus('Notifications are blocked in browser or system settings.','การแจ้งเตือนถูกปิดในการตั้งค่าเบราว์เซอร์หรือระบบ','blocked');return}
  if(!prepared){writeButton('Preparing alerts…',true);writeStatus('Preparing secure notification support.','กำลังเตรียมระบบแจ้งเตือนที่ปลอดภัย','working');try{await prepare()}catch(error){console.warn('Push preparation failed',error);writeButton('Alerts unavailable',true);writeStatus('Alert service could not be reached. Please try again later.','ไม่สามารถเชื่อมต่อระบบแจ้งเตือนได้ โปรดลองอีกครั้งภายหลัง','unavailable');return}}
  if(subscription){writeButton('Turn alerts off',busy);writeStatus('Air-quality and severe-weather alerts are on.','เปิดการแจ้งเตือนคุณภาพอากาศและสภาพอากาศรุนแรงแล้ว','on')}else{writeButton('Turn alerts on',busy);writeStatus('Enable alerts only when you want lock-screen updates.','เปิดการแจ้งเตือนเมื่อคุณต้องการรับข้อมูลบนหน้าจอล็อก','off')}
}
async function enableFromGesture(){
  if(!capable()||busy||!prepared||!registration||!publicKey||subscription)return;
  busy=true;writeButton('Enabling alerts…',true);writeStatus('Waiting for notification permission.','กำลังรอสิทธิ์การแจ้งเตือน','working');let created=null;
  try{
    const subscribePromise=registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64urlBytes(publicKey).buffer});
    created=await subscribePromise;subscription=created;
    const payload=subscription.toJSON();await request('/subscribe',{method:'POST',body:JSON.stringify({endpoint:payload.endpoint,expirationTime:payload.expirationTime??null,keys:payload.keys})});writeStatus('Environmental alerts are enabled.','เปิดการแจ้งเตือนสภาพแวดล้อมแล้ว','on');
  }catch(error){console.warn('Push enable failed',error);if(created)try{await created.unsubscribe()}catch(_){ }subscription=null;prepared=false;publicKey='';writeStatus(Notification.permission==='denied'?'Notifications were blocked.':'Could not enable alerts. Please try again.',Notification.permission==='denied'?'การแจ้งเตือนถูกปิด':'ไม่สามารถเปิดการแจ้งเตือนได้ โปรดลองอีกครั้ง',Notification.permission==='denied'?'blocked':'error')}
  finally{busy=false;await render()}
}
async function disable(){
  if(!capable()||busy||!prepared)return;busy=true;writeButton('Turning alerts off…',true);writeStatus('Removing this device from environmental alerts.','กำลังยกเลิกการแจ้งเตือนสำหรับอุปกรณ์นี้','working');
  try{if(subscription){const endpoint=subscription.endpoint;try{await request('/subscribe',{method:'DELETE',body:JSON.stringify({endpoint})})}catch(error){console.warn('Push backend removal failed',error)}await subscription.unsubscribe()}subscription=null;prepared=false;publicKey='';writeStatus('Alerts are off for this device.','ปิดการแจ้งเตือนสำหรับอุปกรณ์นี้แล้ว','off')}catch(error){console.warn('Push disable failed',error);writeStatus('Could not turn alerts off. Please try again.','ไม่สามารถปิดการแจ้งเตือนได้ โปรดลองอีกครั้ง','error')}finally{busy=false;await render()}
}
function toggleFromGesture(){if(busy||!capable()||!prepared)return;if(subscription)disable().catch(error=>console.warn('Push disable failed',error));else enableFromGesture().catch(error=>console.warn('Push enable failed',error))}

document.addEventListener('click',event=>{if(event.target.closest('#alertsBtn')){event.preventDefault();toggleFromGesture()}});
document.addEventListener('sindhorn:route-mounted',()=>render().catch(()=>{}));document.addEventListener('visibilitychange',()=>{if(!document.hidden){prepared=false;registration=null;publicKey='';subscription=null;render().catch(()=>{})}});
window.SindhornPushAlerts={refresh:()=>{prepared=false;registration=null;publicKey='';subscription=null;return render()}};
render().catch(()=>{});
