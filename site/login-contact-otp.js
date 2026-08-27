import {establishSessionFromBootstrap,getState} from './auth-client.js';
import {getTurnstileSiteKey} from './auth-public-config.js';

const copy={
  en:{support:'Enter your Employee ID and personal email to receive a fresh 6-digit sign-in code.',realtime:'Get a sign-in code',employee:'Employee ID',emailLabel:'Personal email',send:'Send code',sending:'Sending code…',sent:'If these details match your employee record, a code is on its way. Check your inbox.',privacy:'We only send a code when your Employee ID and personal email match the private employee record.',code:'6-digit code',verify:'Verify & sign in',verifying:'Verifying…',bad:'The code or account details are invalid or expired.',delivery:'We could not complete sign-in. Please try again.',fallback:'Use an invitation code instead',change:'Use a different email',security:'Complete the security check first.',emailSetup:'Email delivery is not configured on the preview Worker yet.'},
  th:{support:'กรอกรหัสพนักงานและอีเมลส่วนตัวเพื่อรับรหัสเข้าสู่ระบบ 6 หลักใหม่',realtime:'รับรหัสเข้าสู่ระบบ',employee:'รหัสพนักงาน',emailLabel:'อีเมลส่วนตัว',send:'ส่งรหัส',sending:'กำลังส่งรหัส…',sent:'หากข้อมูลตรงกับข้อมูลพนักงาน ระบบกำลังส่งรหัสให้คุณ โปรดตรวจสอบกล่องจดหมาย',privacy:'ระบบจะส่งรหัสเมื่อรหัสพนักงานและอีเมลส่วนตัวตรงกับข้อมูลพนักงานที่เก็บไว้แบบส่วนตัวเท่านั้น',code:'รหัส 6 หลัก',verify:'ตรวจสอบและเข้าสู่ระบบ',verifying:'กำลังตรวจสอบ…',bad:'รหัสหรือข้อมูลบัญชีไม่ถูกต้องหรือหมดอายุ',delivery:'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่',fallback:'ใช้รหัสจากคำเชิญแทน',change:'ใช้อีเมลอื่น',security:'กรุณาผ่านการตรวจสอบความปลอดภัยก่อน',emailSetup:'ระบบส่งอีเมลของหน้าทดสอบยังไม่ได้ตั้งค่า'}
};
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const form=$('#otpRequestForm'),verifyForm=$('#otpVerifyForm'),status=$('#status');
let pending=null,turnstileToken='',turnstileWidgetId=null;
const language=()=>localStorage.getItem('sindhorn-login-language')==='th'?'th':'en';
function show(message,tone='neutral'){status.textContent=message||'';status.dataset.show=String(Boolean(message));status.dataset.tone=tone}
function setBusy(button,busy,label){button.disabled=busy;if(label)button.textContent=label}
function applyLanguage(){
  const c=copy[language()];
  $('#loginSupport').textContent=c.support;
  $$('[data-otp-i18n]').forEach(node=>{const key=node.dataset.otpI18n;if(c[key])node.textContent=c[key]});
}
async function workerJson(path,body){
  const worker=getState().authWorker||'https://sindhorn-midtown-auth-preview.decha-dae.workers.dev';
  const response=await fetch(`${worker}${path}`,{method:'POST',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data?.error||`HTTP ${response.status}`);error.payload=data;throw error}
  return data;
}
function loadTurnstileApi(){
  if(window.turnstile)return Promise.resolve(window.turnstile);
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-sindhorn-turnstile]');
    if(existing){existing.addEventListener('load',()=>resolve(window.turnstile),{once:true});existing.addEventListener('error',reject,{once:true});return}
    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.dataset.sindhornTurnstile='true';script.onload=()=>resolve(window.turnstile);script.onerror=reject;document.head.appendChild(script);
  });
}
async function initTurnstile(){
  const sitekey=getTurnstileSiteKey();if(!sitekey)return;
  $('#turnstileWrap').hidden=false;
  try{
    const api=await loadTurnstileApi();
    turnstileWidgetId=api.render('#turnstileWidget',{sitekey,theme:'light',size:'flexible',callback:token=>{turnstileToken=token},'expired-callback':()=>{turnstileToken=''},'error-callback':()=>{turnstileToken=''}});
  }catch(_){show(copy[language()].security,'error')}
}
function resetTurnstile(){
  turnstileToken='';
  try{if(turnstileWidgetId!==null&&window.turnstile)window.turnstile.reset(turnstileWidgetId)}catch(_){}
}

$$('[data-lang]').forEach(button=>button.addEventListener('click',()=>queueMicrotask(applyLanguage)));
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const c=copy[language()],button=$('#otpSendButton'),employeeNumber=$('#otpEmployeeNumber').value.trim(),email=$('#otpEmail').value.trim().toLowerCase();
  if(!employeeNumber||!email)return;
  if(!turnstileToken){show(c.security,'error');return}
  setBusy(button,true,c.sending);show(c.sending);
  try{
    const result=await workerJson('/otp/request',{employeeNumber,email,turnstileToken});
    resetTurnstile();
    if(result?.delivery==='not_configured'){show(c.emailSetup,'error');return}
    if(result?.delivery==='provider_error'){show(c.delivery,'error');return}
    pending={employeeNumber,email};
    form.hidden=true;verifyForm.hidden=false;$('#otpCode').value='';$('#otpCode').focus();show(c.sent,'success');
  }catch(error){
    resetTurnstile();
    show(error?.payload?.error?.startsWith('turnstile')?c.security:c.delivery,'error');
  }finally{setBusy(button,false,c.send)}
});
verifyForm.addEventListener('submit',async event=>{
  event.preventDefault();if(!pending)return;
  const c=copy[language()],button=$('#otpVerifyButton'),code=$('#otpCode').value.replace(/\D/g,'').slice(0,6);
  setBusy(button,true,c.verifying);show(c.verifying);
  try{
    const result=await workerJson('/otp/verify',{...pending,code});
    const tokenHash=result?.bootstrap?.tokenHash;if(!result?.ok||!tokenHash)throw new Error('invalid_bootstrap');
    const established=await establishSessionFromBootstrap(tokenHash,{reason:'personal_email',preferredLanguage:result.preferredLanguage});
    if(established?.preferredLanguage)localStorage.setItem('sindhorn-login-language',established.preferredLanguage==='th'?'th':'en');
    location.reload();
  }catch(error){show(error?.payload?.error==='otp_invalid'?c.bad:c.delivery,'error')}
  finally{setBusy(button,false,c.verify)}
});
$('#otpChangeButton').addEventListener('click',()=>{pending=null;verifyForm.hidden=true;form.hidden=false;$('#otpCode').value='';resetTurnstile();show('');$('#otpEmail').focus()});
$('#otpCode').addEventListener('input',event=>{event.target.value=event.target.value.replace(/\D/g,'').slice(0,6)});
applyLanguage();
initTurnstile();
