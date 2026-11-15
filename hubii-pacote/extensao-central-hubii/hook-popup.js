// roda no mundo da página (MAIN): captura o texto da janelinha aberta por window.open quando a coleta pede
(() => {
  if (window.__centralHookPopup) return; window.__centralHookPopup = true;
  const orig = window.open;
  window.open = function () {
    const w = orig.apply(this, arguments);
    if (w && document.documentElement.getAttribute('data-central-capturar') === '1') {
      (async () => {
        let t = '';
        for (let i = 0; i < 48; i++) {
          await new Promise(r => setTimeout(r, 250));
          try { if (w.document.readyState === 'complete' && (w.document.body.innerText || '').length > 20) break; } catch (e) {}
        }
        try { t = w.document.body.innerText || ''; } catch (e) {}
        try { w.close(); } catch (e) {}
        window.postMessage({ central: 'popup', texto: t }, '*');
      })();
    }
    return w;
  };
})();
