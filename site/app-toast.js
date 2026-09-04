/* One toast, asked from code.

   The library's 17 Toast is markup: a .app-toast.app-overlay above the
   navbar that shows and gets out of the way on its own. A page that has just
   copied a link or saved a card should not each keep its own element and
   timer. showToast() keeps one element on the body, sets its text, shows it,
   and hides it again after a beat; a second call restarts the beat with the
   new text. It is a status region, so a screen reader hears it once. */

let element=null,timer=0;

export function showToast(message,{duration=2200}={}){
  if(!element){
    element=document.createElement('div');
    element.className='app-toast app-overlay';
    element.setAttribute('role','status');
    element.setAttribute('aria-live','polite');
    element.hidden=true;
    document.body.append(element);
  }
  element.textContent=String(message??'');
  element.hidden=false;
  clearTimeout(timer);
  timer=setTimeout(()=>{element.hidden=true},duration);
}

export function hideToast(){clearTimeout(timer);if(element)element.hidden=true}
