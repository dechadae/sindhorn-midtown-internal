import {getState} from './auth-client.js';

const STORAGE_KEY='sindhorn-midtown-auth-session-v1';
const copy={
  en:{support:'Enter your Employee ID and receive a fresh one-time code by SMS or personal email.',realtime:'Get a sign-in code',employee:'Employee ID',sms:'SMS',email:'Personal email',phone:'Mobile number',emailLabel:'Personal email',send:'Send code',sending:'Sending code…',sent:'If these details match your employee record, a code is on its way.',code:'One-time code',verify:'Verify & sign in',verifying:'Verifying…',bad:'The code or account details are invalid or expired.',delivery:'We could not complete sign-in. Please try again.',fallback:'Use an invitation code instead'},
  th:{support:'กรอกรหัสพนักงานเพื่อรับรหัสใช้ครั้งเดียวใหม่ทาง SMS หรืออีเมลส่วนตัว',realtime:'รับรหัสเข้าสู่ระบบ',employee:'รหัสพนักงาน',sms:'SMS',email:'อีเมลส่วนตัว',phone:'หมายเลขโทรศัพท์มือถือ',emailLabel:'อีเมลส่วนตัว',send:'ส่งรหัส',sending:'กำลังส่งรหัส…',sent:'หากข้อมูลตรงกับข้อมูลพนักงาน ระบบกำลังส่งรหัสให้คุณ',code:'รหัสใช้ครั้งเดียว',verify:'ตรวจสอบและเข้าสู่ระบบ',verifying:'กำลังตรวจสอบ…',bad:'รหัสหรือข้อมูลบัญชีไม่ถูกต้องหรือหมดอายุ',delivery:'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่',fallback:'ใช้รหัสจากคำเชิญแทน'}
};
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const form=$('#otpRequestForm'),verifyForm=$('#otpVerifyForm'),status=$('#status');
let channel='sms',pending=null;
const language=()=>localStorage.getItem('sindhorn-login-language')==='th'?'th':'en';
function show(message,tone='neutral'){status.textContent=message||'';status.dataset.show=String(Boolean(message));status.dataset.tone=tone}
function setBusy(button,busy,label){button.disabled=busy;if(label)button.textContent=label}
function normalizePhone(value){
  let raw=String(value||'').trim().replace(/[\s().-]/g,'');
  if(raw.startsWith('00'))raw=`+${raw.slice(2)}`;
  const digits=raw.replace(/\D/g,'');
  if(/^0\d{8,9}$/.test(digits))return `+66${digits.slice(1)}`;
  if(/^66\d{8,9}$/.test(digits))return `+${digits}`;
  return raw.startsWith('+')?`+${digits}`:digits;
}
function applyLanguage(){
  const c=copy[language()];
  $('#loginSupport').textContent=c.support;
  $$('[data-otp-i18n]').forEach(node=>{const key=node.dataset.otpI18n;if(c[key])node.textContent=c[key]});
  $('#otpContactLabel').textContent=channel==='sms'?c.phone:c.emailLabel;
  $('#otpContact').type=channel==='sms'?'tel':'email';
  $('#otpContact').inputMode=channel==='sms'?'tel':'email';
  $('#otpContact').autocomplete=channel==='sms'?'tel':'email';
  $('#otpContact').placeholder=channel==='sms'?'082 865 9210':'name@example.com';
}
function setChannel(next){
  channel=next==='email'?'email':'sms';
  $$('[data-otp-channel]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.otpChannel===channel)));
  $('#otpContact').value='';pending=null;verifyForm.hidden=true;applyLanguage();show('');
}
async function workerJson(path,body){
  const worker=getState().authWorker||'https://sindhorn-midtown-auth-preview.decha-dae.workers.dev';
  const response=await fetch(`${worker}${path}`,{method:'POST',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data?.error||`HTTP ${response.status}`);error.payload=data;throw error}
  return data;
}

$$('[data-otp-channel]').forEach(button=>button.addEventListener('click',()=>setChannel(button.dataset.otpChannel)));
$$('[data-lang]').forEach(button=>button.addEventListener('click',()=>queueMicrotask(applyLanguage)));
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const c=copy[language()],button=$('#otpSendButton'),employeeNumber=$('#otpEmployeeNumber').value.trim();
  const raw=$('#otpContact').value.trim(),contact=channel==='sms'?normalizePhone(raw):raw.toLowerCase();
  if(!employeeNumber||!contact)return;
  setBusy(button,true,c.sending);show(c.sending);
  try{
    await workerJson('/otp/request',{employeeNumber,channel,contact});
    pending={employeeNumber,channel,contact};
    verifyForm.hidden=false;$('#otpCode').value='';$('#otpCode').focus();show(c.sent,'success');
  }catch(_){show(c.delivery,'error')}
  finally{setBusy(button,false,c.send)}
});
verifyForm.addEventListener('submit',async event=>{
  event.preventDefault();if(!pending)return;
  const c=copy[language()],button=$('#otpVerifyButton'),code=$('#otpCode').value.replace(/\D/g,'').slice(0,8);
  setBusy(button,true,c.verifying);show(c.verifying);
  try{
    const result=await workerJson('/otp/verify',{...pending,code});
    const session=result?.session;
    if(!result?.ok||!session?.access_token||!session?.refresh_token||!session?.expires_at)throw new Error('invalid_session');
    localStorage.setItem(STORAGE_KEY,JSON.stringify(session));
    if(result.preferredLanguage)localStorage.setItem('sindhorn-login-language',result.preferredLanguage==='th'?'th':'en');
    location.reload();
  }catch(error){show(error?.payload?.error==='otp_invalid'?c.bad:c.delivery,'error')}
  finally{setBusy(button,false,c.verify)}
});
$('#otpCode').addEventListener('input',event=>{event.target.value=event.target.value.replace(/\D/g,'').slice(0,8)});
setChannel('sms');applyLanguage();
