import { PUSH_API_BASE } from './push-config.js';

const API=String(PUSH_API_BASE||'').replace(/\/+$/,'');
let busy=false;
const byId=id=>document.getElementById(id);
function supported(){return Boolean(API&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window)}
function base64urlBytes(value){const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes}
async function request(path,options={}){const response=await fetch(API+path,{credentials:'omit',cache:'no-store',...options,headers:{'content-type':'application/json',...(options.headers||{})}});let body={};try{body=await response.json()}catch(_){ }if(!response.ok)throw new Error(body?.error||('Push API '+response.status));return body}
function statusNodes(){return{button:byId('alertsBtn'),status:byId('alertsStatus'),en:byId('alertsStatusEn'),th:byId('alertsStatusTh')}}
function writeStatus(en,th,state='idle'){const nodes=statusNodes();if(nodes.status)nodes.status.dataset.state=state;if(nodes.en)nodes.en.textContent=en;if(nodes.th)nodes.th.textContent=th}
function writeButton(label,disabled=false){const button=byId('alertsBtn');if(!button)return;const labelNode=button.querySelector('.action-label')||button;labelNode.textContent=label;button.disabled=disabled}
async function currentSubscription(){if(!('serviceWorker'in navigator))return null;const registration=await navigator.serviceWorker.ready;return registration.pushManager?.getSubscription?.()||null}
async function render(){
  const {button}=statusNodes();if(!button)return;
  if(!API){writeButton('Alerts unavailable',true);writeStatus('Alert service is not configured yet.','ระบบแจ้งเตือนยังไม่พร้อมใช้งาน','unavailable');return}
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){writeButton('Alerts unavailable',true);writeStatus('This browser does not support Web Push. Install the PWA if your platform requires it.','เบราว์เซอร์นี้ไม่รองรับ Web Push โปรดติดตั้ง PWA หากอุปกรณ์ของคุณกำหนดให้ติดตั้งก่อน','unavailable');return}
  if(Notification.permission==='denied'){writeButton('Alerts blocked',true);writeStatus('Notifications are blocked in browser or system settings.','การแจ้งเตือนถูกปิดในการตั้งค่าเบราว์เซอร์หรือระบบ','blocked');return}
  try{const subscription=await currentSubscription();if(subscription){writeButton('Turn alerts off',busy);writeStatus('Air-quality and severe-weather alerts are on.','เปิดการแจ้งเตือนคุณภาพอากาศและสภาพอากาศรุนแรงแล้ว','on')}else{writeButton('Turn alerts on',busy);writeStatus(Notification.permission==='granted'?'Ready to enable environmental alerts.':'Enable alerts only when you want lock-screen updates.','เปิดการแจ้งเตือนเมื่อคุณต้องการรับข้อมูลบนหน้าจอล็อก','off')}}catch(_){writeButton('Alerts unavailable',true);writeStatus('Push subscription state could not be read.','ไม่สามารถตรวจสอบสถานะการแจ้งเตือนได้','unavailable')}
}
async function enable(){
  if(!supported()||busy)return;busy=true;writeButton('Enabling alerts…',true);writeStatus('Requesting notification permission.','กำลังขอสิทธิ์การแจ้งเตือน','working');let created=null;
  try{
    const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();if(permission!=='granted'){await render();return}
    const registration=await navigator.serviceWorker.ready,{publicKey}=await request('/vapid-public-key',{method:'GET',headers:{}});let subscription=await registration.pushManager.getSubscription();if(!subscription){subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64urlBytes(String(publicKey)).buffer});created=subscription}
    const payload=subscription.toJSON();await request('/subscribe',{method:'POST',body:JSON.stringify({endpoint:payload.endpoint,expirationTime:payload.expirationTime??null,keys:payload.keys})});writeStatus('Environmental alerts are enabled.','เปิดการแจ้งเตือนสภาพแวดล้อมแล้ว','on');
  }catch(error){console.warn('Push enable failed',error);if(created)try{await created.unsubscribe()}catch(_){ }writeStatus('Could not enable alerts. Please try again.','ไม่สามารถเปิดการแจ้งเตือนได้ โปรดลองอีกครั้ง','error')}
  finally{busy=false;await render()}
}
async function disable(){
  if(!supported()||busy)return;busy=true;writeButton('Turning alerts off…',true);writeStatus('Removing this device from environmental alerts.','กำลังยกเลิกการแจ้งเตือนสำหรับอุปกรณ์นี้','working');
  try{const subscription=await currentSubscription();if(subscription){const endpoint=subscription.endpoint;try{await request('/subscribe',{method:'DELETE',body:JSON.stringify({endpoint})})}catch(error){console.warn('Push backend removal failed',error)}await subscription.unsubscribe()}writeStatus('Alerts are off for this device.','ปิดการแจ้งเตือนสำหรับอุปกรณ์นี้แล้ว','off')}catch(error){console.warn('Push disable failed',error);writeStatus('Could not turn alerts off. Please try again.','ไม่สามารถปิดการแจ้งเตือนได้ โปรดลองอีกครั้ง','error')}finally{busy=false;await render()}
}
async function toggle(){if(busy||!supported())return;const subscription=await currentSubscription();if(subscription)await disable();else await enable()}

document.addEventListener('click',event=>{if(event.target.closest('#alertsBtn')){event.preventDefault();toggle().catch(error=>console.warn('Push toggle failed',error))}});
document.addEventListener('sindhorn:route-mounted',()=>render().catch(()=>{}));document.addEventListener('visibilitychange',()=>{if(!document.hidden)render().catch(()=>{})});
window.SindhornPushAlerts={refresh:()=>render()};
render().catch(()=>{});
