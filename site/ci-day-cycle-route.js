import {mountCiRoute as mountCanonicalCiRoute} from './ci.js?v=1';
import {mountBettaDayCycleControls} from './ci-betta-day-cycle.js';

export async function mountCiRoute(host){
  const cleanupCanonical=await mountCanonicalCiRoute(host);
  const route=host.querySelector('.ci-route');
  const cleanupBetta=mountBettaDayCycleControls(route);
  return()=>{cleanupBetta?.();cleanupCanonical?.()};
}
