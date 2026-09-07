/* A public document's bootstrap (/idui, /evidence, /origarium): the live
   atmosphere and nothing else. No service worker, no session, no inbox - a
   document is not the app.

   r34 forced sky mode here on the argument that a document is read rather than
   glanced at and the fish would distract. r57 drops that: a document gets the
   same atmosphere the app does, resolved the same way. The mode is no longer
   requested, so the runtime decides it - full Betta by default, and sky where
   the device asks for reduced motion, prefers it, or the frame governor finds
   the hardware cannot hold the rate. A reader on a slow phone still gets sky;
   nobody is now given it on the assumption that reading needs less. */

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
    document.getElementById('environmentStage')?.setAttribute('data-ready', 'true');
  } catch (error) {
    console.warn('Atmosphere unavailable; the document renders over the flat ground.', error);
  }
})();
