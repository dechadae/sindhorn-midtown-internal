/* A public document's bootstrap (/idui, /evidence; r34): the live atmosphere
   in sky mode and nothing else. No service worker, no session, no inbox -
   a document is not the app - and no fish: the sky is the atmosphere a
   reader gets, whatever this device prefers for the app, because the
   document is read, not glanced at, and the fish would be a distraction the
   glass keeps re-sampling. */

/* The runtime's weather probe (api.open-meteo.com) is answered with a
   network error before it leaves the device, as shell.js does; the runtime
   treats the failure as "no weather" and renders exactly as before. */
{
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith('https://api.open-meteo.com/')) return Promise.resolve(Response.error());
    return nativeFetch(input, init);
  };
}

(async () => {
  try {
    // The full WebGL runtime directly: betta-runtime.js is a bootstrap that
    // waits for a startup signal only the app shell sends.
    const betta = await import('/betta-runtime-full.js?v=1');
    await betta.initEnvironment();
    window.SindhornEnvironment?.setBettaMode?.('sky');
    document.getElementById('environmentStage')?.setAttribute('data-ready', 'true');
  } catch (error) {
    console.warn('Atmosphere unavailable; the document renders over the flat ground.', error);
  }
})();
