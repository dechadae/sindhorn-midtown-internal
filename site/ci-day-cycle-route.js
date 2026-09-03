import {mountCiRoute as mountCanonicalCiRoute} from './ci.js?v=1';
import {mountBettaDayCycleControls} from './ci-betta-day-cycle.js?v=2';
import {mountCiGlassAudit} from './ci-glass-audit.js?v=2';

function standardizeUtilityActions(route){
  if(!route)return;
  route.querySelectorAll('[data-ci-top],.ci-top button').forEach(button=>{
    button.classList.remove('app-quiet-action');
    button.classList.add('app-utility-action');
  });
  route.querySelector('.ci-end-actions')?.classList.add('app-utility-actions');
  route.querySelector('.ci-top')?.classList.add('app-utility-actions');
}

export async function mountCiRoute(host){
  const cleanupCanonical=await mountCanonicalCiRoute(host);
  const route=host.querySelector('.ci-route');
  standardizeUtilityActions(route);
  const cleanupGlass=mountCiGlassAudit(route);
  const cleanupBetta=mountBettaDayCycleControls(route);
  return()=>{cleanupBetta?.();cleanupGlass?.();cleanupCanonical?.()};
}
