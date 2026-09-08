/* A public document's bootstrap (/idui, /evidence, /origarium, /betta): the
   live atmosphere, and since r67 the footer's tabs swapping the document in
   place. No service worker, no session, no inbox - a document is not the app.

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

/* The footer's tabs swap the document the way the shell's tabs swap a page
   (shell.js route()): a cut, not a transition - the old document goes, the
   new one is there, at the top. The masthead, the navbar and the atmosphere
   are outside the document and stay put, so the fish keep swimming across
   the change. Each tab is still a plain link, and stays one when a fetch
   fails or the reader asks for a new tab.

   The neighbouring document is fetched as its .html file under the release
   stamp the page carries: the app's service worker, where it controls the
   origin, judges a cached document by that extension and keys it by URL, so
   each release's copy lives under its own key and a redeploy is never
   answered from the last one. The host answers the .html address with the
   clean one; fetch follows. */
{
  const DOCUMENT = 'main.app-page';
  const NAVBAR = 'nav.app-navbar';
  const release = document.querySelector('meta[name="release"]')?.content || '';
  const pages = new Map();
  let shown = location.pathname;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const routes = () => new Set([location.pathname, ...[...document.querySelectorAll(`${NAVBAR} a[href]`)].map(a => new URL(a.href).pathname)]);

  const load = pathname => {
    if (!pages.has(pathname)) {
      pages.set(pathname, fetch(`${pathname}.html?v=${encodeURIComponent(release)}`, { headers: { accept: 'text/html' } })
        .then(response => { if (!response.ok) throw new Error(`${response.status} for ${pathname}`); return response.text(); })
        .catch(error => { pages.delete(pathname); throw error; }));
    }
    return pages.get(pathname);
  };

  /* A tab or a link cuts to the top of the next document (or to the section
     its hash names). Back and forward return to where the reader left the
     document, as a full load would have: the position is kept on the history
     entry as it is left, because the browser's own restoration cannot see a
     document that is still being fetched. */
  const swap = async (url, { push }) => {
    const html = await load(url.pathname);
    const next = new DOMParser().parseFromString(html, 'text/html');
    const main = next.querySelector(DOCUMENT), navbar = next.querySelector(NAVBAR);
    if (!main || !navbar) throw new Error(`${url.pathname} is not a document page`);
    if (push) history.replaceState({ ...history.state, scrollY }, '');
    document.querySelector(DOCUMENT).replaceWith(main);
    document.querySelector(NAVBAR).replaceWith(navbar);
    document.title = next.title;
    for (const selector of ['meta[name="description"]', 'link[rel="canonical"]', 'meta[property="og:title"]', 'meta[property="og:url"]', 'meta[property="og:description"]']) {
      const from = next.querySelector(selector), to = document.querySelector(selector);
      if (from && to) for (const name of ['content', 'href']) if (from.hasAttribute(name)) to.setAttribute(name, from.getAttribute(name));
    }
    if (push) history.pushState({ document: url.pathname }, '', url.pathname + url.search + url.hash);
    shown = url.pathname;
    const kept = push ? null : history.state?.scrollY;
    const target = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (typeof kept === 'number') scrollTo(0, kept); else if (target) target.scrollIntoView(); else scrollTo(0, 0);
  };

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const current = event.target.closest(`${NAVBAR} [aria-current="page"]`);
    if (current) { scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); return; }
    const link = event.target.closest('a[href]');
    if (!link || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname === location.pathname || !routes().has(url.pathname)) return;
    event.preventDefault();
    swap(url, { push: true }).catch(error => { console.warn('In-place swap unavailable; following the link.', error); location.href = link.href; });
  });

  /* Back and forward re-cut to the document the entry names; a hash-only
     move within one document is the browser's to handle. */
  addEventListener('popstate', () => {
    if (location.pathname === shown) return;
    swap(new URL(location.href), { push: false }).catch(() => location.reload());
  });

  /* A tab warms its document as the pointer arrives, so the cut lands on the
     press rather than a network round trip later. */
  const warm = event => { const link = event.target.closest?.(`${NAVBAR} a[href]`); if (link) load(new URL(link.href).pathname).catch(() => {}); };
  document.addEventListener('pointerover', warm, { passive: true });
  document.addEventListener('touchstart', warm, { passive: true });
  document.addEventListener('focusin', warm);
}
