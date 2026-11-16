// Roda no mundo da página (MAIN) do Hubii. Observa o pedido que a própria tela faz ao servidor para carregar a lista
// (papi.hubii.co/v2/hubs/<loja>/orders) e guarda como ele é feito (endereço e cabeçalhos, inclusive a credencial).
// Quando a Central pede, repete o MESMO pedido mudando só página, quantidade, ordenação e status, e devolve a resposta.
// Só leitura (GET) e só nesse endereço. A resposta não tem dados pessoais (número, status, prazo, transportadora).
(() => {
  if (window.__centralHookLista) return; window.__centralHookLista = true;
  const RX = /^https:\/\/papi\.hubii\.co\/v2\/hubs\/[0-9a-f-]{36}\/orders\?/i;
  let modelo = null;   // { url, headers: {..}, credentials, via: 'fetch' | 'xhr' }
  const oFetch = window.fetch;
  const cabecalhos = h => {
    const o = {};
    try {
      if (!h) return o;
      if (typeof Headers !== 'undefined' && h instanceof Headers) h.forEach((v, k) => { o[k] = v; });
      else if (Array.isArray(h)) h.forEach(([k, v]) => { o[k] = v; });
      else Object.keys(h).forEach(k => { o[k] = h[k]; });
    } catch (e) {}
    return o;
  };
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || String(input);
      if (RX.test(url) && (!init || !init.method || /^get$/i.test(init.method))) {
        const h = Object.assign({}, input && typeof input !== 'string' && input.headers ? cabecalhos(input.headers) : {}, cabecalhos(init && init.headers));
        modelo = { url, headers: h, credentials: (init && init.credentials) || (input && input.credentials) || 'include', via: 'fetch' };
      }
    } catch (e) {}
    return oFetch.apply(this, arguments);
  };
  const X = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
  if (X) {
    const oOpen = X.open, oSet = X.setRequestHeader, oSend = X.send;
    X.open = function (m, url) { try { this.__cl = RX.test(String(url)) && /^get$/i.test(m) ? { url: String(url), headers: {} } : null; } catch (e) {} return oOpen.apply(this, arguments); };
    X.setRequestHeader = function (k, v) { try { if (this.__cl) this.__cl.headers[k] = v; } catch (e) {} return oSet.apply(this, arguments); };
    X.send = function () { try { if (this.__cl) modelo = { url: this.__cl.url, headers: this.__cl.headers, credentials: this.withCredentials ? 'include' : 'same-origin', via: 'xhr' }; } catch (e) {} return oSend.apply(this, arguments); };
  }
  const repetir = async params => {
    if (!modelo) throw new Error('a tela do Hubii ainda não carregou a lista (sem modelo)');
    const u = new URL(modelo.url);
    Object.keys(params || {}).forEach(k => u.searchParams.set(k, String(params[k])));
    if (!RX.test(u.toString())) throw new Error('endereço inesperado');
    if (modelo.via === 'xhr') {
      return await new Promise((ok, falha) => {
        const x = new XMLHttpRequest(); x.__cl = null;
        x.open('GET', u.toString()); x.withCredentials = modelo.credentials === 'include';
        Object.keys(modelo.headers).forEach(k => { try { x.setRequestHeader(k, modelo.headers[k]); } catch (e) {} });
        x.__cl = null;
        x.onload = () => { if (x.status >= 200 && x.status < 300) { try { ok(JSON.parse(x.responseText)); } catch (e) { falha(new Error('resposta não é JSON')); } } else falha(new Error('HTTP ' + x.status)); };
        x.onerror = () => falha(new Error('falha de rede (xhr)'));
        x.timeout = 30000; x.ontimeout = () => falha(new Error('tempo esgotado'));
        x.send();
      });
    }
    const r = await oFetch(u.toString(), { method: 'GET', headers: modelo.headers, credentials: modelo.credentials });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  };
  window.addEventListener('message', async ev => {
    const d = ev.data;
    if (ev.source !== window || !d || d.central !== 'lista-pedir') return;
    try { const json = await repetir(d.params); window.postMessage({ central: 'lista-resp', n: d.n, ok: true, json }, '*'); }
    catch (e) { window.postMessage({ central: 'lista-resp', n: d.n, ok: false, erro: String(e && e.message || e) }, '*'); }
  });
})();
