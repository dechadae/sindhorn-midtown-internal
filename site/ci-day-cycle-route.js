import {mountCiRoute as mountCanonicalCiRoute} from './ci.js?v=1';
import {mountBettaDayCycleControls} from './ci-betta-day-cycle.js?v=2';
import {mountCiGlassAudit} from './ci-glass-audit.js?v=1';

export async function mountCiRoute(host){
  const cleanupCanonical=await mountCanonicalCiRoute(host);
  const route=host.querySelector('.ci-route');
  const cleanupGlass=mountCiGlassAudit(route);
  const cleanupBetta=mountBettaDayCycleControls(route);
  return()=>{cleanupBetta?.();cleanupGlass?.();cleanupCanonical?.()};
}
