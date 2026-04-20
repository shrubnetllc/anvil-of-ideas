let gtmLoaded = false;

export function loadGTM() {
    const gtmId = import.meta.env.VITE_GTM_ID;
    const enableGTM = import.meta.env.VITE_ENABLE_GTM;

    if (!enableGTM) return;
    if (!gtmId) return;
    if (gtmLoaded) return;

    gtmLoaded = true;

    // dataLayer setup
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push({
        'gtm.start': new Date().getTime(),
        event: 'gtm.js',
    });

    // script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
    document.head.appendChild(script);

    // noscript fallback iframe
    const noscript = document.createElement('noscript');
    noscript.innerHTML = `
    <iframe
      src="https://www.googletagmanager.com/ns.html?id=${gtmId}"
      height="0"
      width="0"
      style="display:none;visibility:hidden"
    ></iframe>
  `;
    document.body.prepend(noscript);
}