// Ponte com o painel local da Central (http://localhost:8765).
// A cada poucos segundos lê o que esta página sabe (rotina rodando, conferência, pendências coletadas, últimas mensagens)
// e manda para o background.js, que repassa ao painel. Também recebe o pedido de "Parar" vindo do painel.
// Só lê; não clica em nada nem muda a página.
(() => {
  if (window.top !== window || window.__centralPonte) return;
  window.__centralPonte = true;
  const lj = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const noHubii = location.host === 'hub.hubii.co';

  const coletar = () => {
    const d = { host: location.host };
    if (noHubii) {
      const P = window.__centralPainel;
      if (P) { try { d.rotina = P.estado(); } catch (e) {} }
      const S = lj('hubii_conferencia');
      if (S && Array.isArray(S.lista)) {
        const lista = S.lista.map(String); const conf = Object.keys(S.conf || {}).filter(id => lista.includes(String(id)));
        d.conf = { conf: conf.length, total: lista.length, t0: S.t0 || 0 };
      }
      if (window.__centralPrazo) d.prazo = window.__centralPrazo;
      const L = lj('hubii_central_log');
      if (Array.isArray(L)) d.log = L.slice(-8).map(x => ({ t: x.t, m: String(x.m || '').slice(0, 200) }));
    } else {
      const t = localStorage.getItem('hubii_pend_coletadas');
      if (t != null) d.pend = { n: t.split('\n').filter(x => x.trim()).length };
    }
    return d;
  };

  let morta = false;
  const enviar = () => {
    if (morta) return;
    try { chrome.runtime.sendMessage({ central: 'painel', d: coletar() }).catch(() => {}); }
    catch (e) { morta = true; } // extensão recarregada: esta cópia antiga para de enviar
  };
  try {
    chrome.runtime.onMessage.addListener(m => {
      if (m && m.central === 'painel-parar' && window.__centralPainel) window.__centralPainel.parar();
    });
  } catch (e) {}
  setTimeout(enviar, 1500);
  setInterval(enviar, 4000);
})();
