export const TURNSTILE_TEST_SITE_KEY='1x00000000000000000000AA';
export const TURNSTILE_PRODUCTION_SITE_KEY='';

export function getTurnstileSiteKey(){
  if(typeof location==='undefined')return TURNSTILE_TEST_SITE_KEY;
  const production=location.hostname==='sindhorn-midtown-internal.pages.dev';
  return production?TURNSTILE_PRODUCTION_SITE_KEY:TURNSTILE_TEST_SITE_KEY;
}
