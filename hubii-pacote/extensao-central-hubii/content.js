(() => {
'use strict';
if (window.top !== window) return;
if (window.__centralHubii) return;
window.__centralHubii = true;

const K_FILA = 'hubii_fila_etiquetas';
const K_HIST = 'hubii_etiquetas_historico';
const K_FAT = 'hubii_faturados';
const K_INT = 'central_hubii_intencao';
const ESPERA_MIN = 2;
const ESPERA_ABA_SEG = 180;

const MODOS = {
  descritivos: { chave: 'descritivos', titulo: 'Imprimir Descritivos', status: 'esperando nfe do hub', marcar: 'esperando nfe do hub', desmarcar: 'esperando expedicao', rotulo: 'Esperando NFe do Hub' },
  reimprimir: { chave: 'reimprimir', titulo: 'Reimprimir descritivos', status: '', marcar: '', desmarcar: '', rotulo: 'sem filtro' },
  etiquetas: { chave: 'etiquetas', titulo: 'Imprimir Etiquetas', status: 'esperando expedicao', marcar: 'esperando expedicao', desmarcar: 'esperando nfe do hub', rotulo: 'Esperando Expedição' }
};

/* ---------- utilitários ---------- */
// relógio em Worker: o Chrome não atrasa os temporizadores quando a aba fica em segundo plano
let relogio = null, seqRel = 0; const espRel = {};
try {
  relogio = new Worker(URL.createObjectURL(new Blob(['onmessage=function(e){var d=e.data;setTimeout(function(){postMessage(d.id)},d.ms)}'], { type: 'text/javascript' })));
  relogio.onmessage = e => { const f = espRel[e.data]; if (f) { delete espRel[e.data]; f(); } };
  relogio.onerror = () => { relogio = null; };
} catch (e) { relogio = null; }
const sleep = ms => new Promise(r => {
  if (!relogio) { setTimeout(r, ms); return; }
  const id = ++seqRel; espRel[id] = r; relogio.postMessage({ id, ms });
  setTimeout(() => { if (espRel[id]) { delete espRel[id]; r(); } }, ms + 4000);
});
const manterAcordado = () => {
  try { if (navigator.locks && navigator.locks.request) navigator.locks.request('central-hubii-rotina', () => new Promise(() => {})); } catch (e) {}
  try {
    if (!window.__acordadoAudio) {
      const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC();
      const osc = ac.createOscillator(); const gan = ac.createGain(); gan.gain.value = 0.002; osc.frequency.value = 30;
      osc.connect(gan); gan.connect(ac.destination); osc.start(); if (ac.resume) ac.resume(); window.__acordadoAudio = ac;
    }
  } catch (e) {}
};
const reg = (k, t0, x) => { try { if (window.__centralReg) window.__centralReg.add(Object.assign({ k, t0, t: Date.now() }, x || {})); } catch (e) {} };
// histórico por pedido: lê os produtos da tela do pedido aberto (EAN, nome e quantidade) e grava com as horas
const regPed = (id, campos) => { try { if (window.__centralReg && window.__centralReg.pedido) window.__centralReg.pedido(id, campos); } catch (e) {} };
const lerItensTela = () => {
  try {
    const raizPag = document.querySelector('main') || document.body;
    const t = [...raizPag.children].filter(c => !c.closest('#central-hubii-raiz')).map(c => c.innerText || '').join('\n');
    const itens = [...t.matchAll(/EAN\s*:?\s*(\d{8,14})\s*\n+\s*([^\n]+?)\s*\n+\s*x\s*(\d{1,4})\b/gi)].map(m => ({ e: m[1], n: m[2].trim().slice(0, 160), q: parseInt(m[3], 10) }));
    if (itens.length) return itens;
    return [...new Set([...t.matchAll(/EAN\s*:?\s*(\d{8,14})/gi)].map(m => m[1]))].map(e => ({ e, n: '', q: null }));
  } catch (e) { return []; }
};
const durTxt = ms => (window.__centralReg ? window.__centralReg.dur(ms) : Math.round(ms / 1000) + ' s');
// com a aba escondida o Chrome pausa as animações da página: a espera não corre até a aba voltar (limite 30 min).
// contarOculto = true só nas esperas que dependem da aba ficar escondida de propósito (aba da etiqueta).
const esperar = async (fn, seg = 30, contarOculto = false) => {
  let oculto = 0, avisou = false;
  for (let i = 0; i < seg * 2; i++) {
    const r = fn(); if (r) return r;
    if (!contarOculto && document.hidden && oculto < 3600) { oculto++; i--; if (!avisou) { avisou = true; try { log('Esta aba ficou em segundo plano: o Chrome pausa a tela. Volte para esta aba que eu continuo sozinho.'); } catch (e) {} } }
    await sleep(500);
  }
  return null;
};
const nt = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const vis = e => !!(e && e.getClientRects().length);
const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim();
const botao = t => [...document.querySelectorAll('button')].filter(b => !b.closest('#central-hubii-raiz')).find(b => b.textContent.trim().toLowerCase().includes(t));
const lerJson = (k, pad) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? pad : v; } catch (e) { return pad; } };
// As memórias (descritivos, etiquetas, códigos BR) ficam no site e também numa cópia no armazenamento da extensão.
// Se o site apagar os dados dele (ex.: ao sair e entrar de novo no Hubii), a cópia devolve a memória.
const ESPELHO = ['hubii_fila_etiquetas', 'hubii_etiquetas_historico', 'hubii_etq_br', 'hubii_faturados'];
const espelhar = (k, v) => { try { if (ESPELHO.includes(k)) chrome.storage.local.set({ ['espelho_' + k]: { t: Date.now(), v } }); } catch (e) {} };
const gravar = (k, v) => { const j = JSON.stringify(v); localStorage.setItem(k, j); espelhar(k, j); };
const espelhoPronto = new Promise(res => {
  try {
    chrome.storage.local.get(ESPELHO.map(k => 'espelho_' + k), o => {
      try {
        ESPELHO.forEach(k => {
          const e = o && o['espelho_' + k]; if (!e || !e.v) return;
          const atual = localStorage.getItem(k);
          if (atual == null || atual === '[]' || atual === '{}') { if (e.v !== '[]' && e.v !== '{}') { localStorage.setItem(k, e.v); try { console.log('[Central Hubii] memória restaurada da cópia: ' + k); } catch (x) {} } }
        });
      } catch (e) {}
      res();
    });
  } catch (e) { res(); }
});
const hora = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const MS14 = 14 * 86400000;
const recente = x => { if (x.t) return Date.now() - x.t < 72 * 3600000; const m = String(x.dia || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return !!m && Date.now() - new Date(+m[3], +m[2] - 1, +m[1]).getTime() < 4 * 86400000; };
const filaLer = () => lerJson(K_FILA, []).filter(recente);
const histLer = () => lerJson(K_HIST, []).filter(x => x.t && Date.now() - x.t < MS14);
const histSet = () => new Set(histLer().map(x => x.id));
const fatLer = () => { const r = lerJson(K_FAT, {}); for (const k in r) if (Date.now() - r[k] > 3600000) delete r[k]; return r; };
const HOJE = () => new Date().toLocaleDateString('pt-BR');

const idAtual = () => (document.body.innerText.match(/Pedido\s*#(\d+)/) || [])[1];
const estaNoDetalhe = () => !!idAtual() && !!botao('voltar');
// memória pedido -> código BR da etiqueta (vem do hook-etiqueta.js, que lê o PDF da etiqueta quando ele é aberto)
const K_BR = 'hubii_etq_br';
const brLer = () => { const m = lerJson(K_BR, {}); const lim = Date.now() - MS14; Object.keys(m).forEach(k => { if (!m[k] || !m[k].t || m[k].t < lim) delete m[k]; }); return m; };
const brGuardar = (id, br) => { if (!/^\d{5,9}$/.test(String(id)) || !/^BR\d{8,16}[A-Z]?$/.test(String(br))) return false; const m = brLer(); m[id] = { br, t: Date.now() }; gravar(K_BR, m); regPed(id, { br }); return true; };
window.addEventListener('message', ev => {
  try {
    const d = ev.data; if (ev.source !== window || !d || d.central !== 'etiqueta' || !Array.isArray(d.brs) || d.brs.length !== 1) return;
    const id = d.peds && d.peds.length === 1 ? d.peds[0] : idAtual();
    if (id) brGuardar(id, d.brs[0]);
  } catch (e) {}
});

/* ---------- leitura da tela do Hubii (por texto) ---------- */
const todasFolhas = () => [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && vis(e) && !e.closest('#central-hubii-raiz'));
const regiaoTabela = () => {
  const fo = todasFolhas();
  const h = fo.find(e => /^id pedido/.test(nt(txt(e))));
  if (!h) return null;
  const hr = h.getBoundingClientRect();
  const ac = fo.find(e => nt(txt(e)) === 'aceito em');
  return { esq: hr.left - 12, dir: ac ? ac.getBoundingClientRect().left : hr.left + 300, topo: hr.bottom - 4, cab: h };
};
const linhasBrutas = () => {
  const reg = regiaoTabela();
  let f = todasFolhas().filter(e => /^#?\d{7}$/.test(e.textContent.trim()));
  if (reg) f = f.filter(e => { const r = e.getBoundingClientRect(); return r.left >= reg.esq && r.left < reg.dir && r.top >= reg.topo; });
  return f.map(el => {
    let r = el;
    // sobe até a linha inteira do pedido (de qualquer altura: pedidos com vários produtos têm linhas altas),
    // parando antes de juntar outro pedido ou o cabeçalho da tabela
    while (r.parentElement && r.parentElement !== document.body && !(reg && r.parentElement.contains(reg.cab)) && r.parentElement.getBoundingClientRect().height <= 1500 && f.filter(x => r.parentElement.contains(x)).length === 1) r = r.parentElement;
    return { id: el.textContent.trim().replace('#', ''), el, status: nt(txt(r)) };
  });
};
let MODO = MODOS.descritivos;
let TODOS = false;
// leitura de estado para o relatório de suporte (sem nomes de clientes)
window.__centralDiag = () => {
  const l = linhasBrutas(); const st = {};
  ['esperando nfe do hub', 'aguardando andamento', 'esperando etiqueta da transportadora', 'etiqueta hub nao baixou', 'esperando expedicao', 'aguardando resposta'].forEach(k => { const n = l.filter(p => p.status.includes(k)).length; if (n) st[k] = n; });
  const p = pagInfo();
  return { tabela: !!regiaoTabela(), linhas: l.length, status: st, pag: p ? txt(p).replace(/\s+/g, ' ').slice(0, 60) : null, aba: !!abaDespacho(), badge: badgeDespacho(), detalhe: !!estaNoDetalhe(), ocupado: !!ocupado, fila: filaLer().length, hist: histLer().length, fat: Object.keys(fatLer()).length };
};
const lerLista = () => TODOS ? linhasBrutas() : linhasBrutas().filter(p => p.status.includes(MODO.status));
const listaOk = () => { const l = linhasBrutas(); return l.length > 0 && l.every(p => p.status.includes(MODO.status)); };
const pagInfo = () => [...document.querySelectorAll('body *')].find(e => e.children.length === 0 && vis(e) && !e.closest('#central-hubii-raiz') && /mostrando\s+\d+\s+a\s+\d+/i.test(txt(e)));
const totalNaTela = () => { const m = pagInfo(); const x = m && txt(m).match(/de\s+(\d+)\s+pedidos/i); return x ? parseInt(x[1], 10) : null; };
const pagControles = () => {
  const m = pagInfo(); if (!m) return [];
  let c = m.parentElement;
  for (let k = 0; k < 5 && c; k++, c = c.parentElement) {
    let nums = [...c.querySelectorAll('button, a, [role="button"]')].filter(e => vis(e) && /^\d{1,3}$/.test(txt(e)));
    if (!nums.length) nums = [...c.querySelectorAll('li')].filter(e => vis(e) && /^\d{1,3}$/.test(txt(e)));
    if (nums.length) return nums.sort((a, b) => parseInt(txt(a), 10) - parseInt(txt(b), 10));
  }
  return [];
};
const abaDespacho = () => [...document.querySelectorAll('button, [role="tab"], a')].find(b => vis(b) && !b.closest('#central-hubii-raiz') && /^despacho(\s|\d|$)/.test(nt(txt(b))));
const abaAtiva = b => { const m = (getComputedStyle(b).backgroundColor.match(/[\d.]+/g) || []).map(Number); if (m.length >= 4 && m[3] === 0) return false; return m.length >= 3 && !(m[0] > 235 && m[1] > 235 && m[2] > 235); };
const botaoFiltros = () => [...document.querySelectorAll('button')].find(b => vis(b) && !b.closest('#central-hubii-raiz') && nt(txt(b)) === 'filtros');
const clicavelPai = e => e.closest('label, button, [role="checkbox"], [role="button"]') || e;
const marcado = leaf => {
  const linha = leaf.closest('label') || leaf.parentElement;
  const cb = linha && (linha.querySelector('input[type="checkbox"]') || linha.querySelector('[role="checkbox"]'));
  if (!cb) return null;
  if (typeof cb.checked === 'boolean' && cb.tagName === 'INPUT') return cb.checked;
  const a = cb.getAttribute('aria-checked') || cb.getAttribute('data-state');
  return a === 'true' || a === 'checked';
};
const prepararTela = async () => {
  const ab = abaDespacho();
  if (ab && !abaAtiva(ab)) { ab.click(); await sleep(2500); }
  if (listaOk()) return true;
  const fb = botaoFiltros();
  if (!fb) return false;
  fb.click(); await sleep(900);
  const painel = await esperar(() => todasFolhas().find(e => nt(txt(e)).includes('configure os filtros')), 6);
  const raiz = painel ? (() => { let r = painel; while (r.parentElement && !nt(txt(r)).includes('status do pedido')) r = r.parentElement; return r; })() : document.body;
  const opc = nome => todasFolhas().find(e => raiz.contains(e) && nt(txt(e)) === nome);
  const alvo = opc(MODO.marcar);
  if (!alvo) { fb.click(); return false; }
  if (marcado(alvo) !== true) { clicavelPai(alvo).click(); await sleep(1500); }
  const outro = opc(MODO.desmarcar);
  if (outro && marcado(outro) === true) { clicavelPai(outro).click(); await sleep(1500); }
  fb.click(); await sleep(1800);
  await esperar(listaOk, 8);
  return listaOk();
};
const primeiroDaLista = () => (lerLista()[0] || {}).id;
const primeiroBruto = () => (linhasBrutas()[0] || {}).id;
const pagTexto = () => { const m = pagInfo(); return m ? txt(m).replace(/\s+/g, ' ') : ''; };
const pagFaixa = () => { const x = pagTexto().match(/mostrando\s+(\d+)\s+a\s+(\d+)/i); return x ? [parseInt(x[1], 10), parseInt(x[2], 10)] : null; };
const ctrlPagina = n => pagControles().find(c => txt(c) === String(n));
// troca de página e espera o "Mostrando X a Y" e a primeira linha mudarem (até 15 s; o Hubii fica lento com listas grandes)
const irParaPagina = async ctrl => {
  const a1 = primeiroBruto(), pa = pagTexto();
  ctrl.click();
  await esperar(() => pagTexto() !== pa && primeiroBruto() && primeiroBruto() !== a1, 15);
  await sleep(1200);
};
const paraPrimeira = async () => { const f = pagFaixa(); if (f && f[0] === 1) return; const c = ctrlPagina(1); if (c) await irParaPagina(c); };
// Percorre as páginas em ordem (1, 2, 3...). A cada passo procura de novo o botão da próxima página:
// com muitas páginas o Hubii esconde algumas atrás de "..." e redesenha os botões. Confere pelo "Mostrando X a Y"
// se a página mudou mesmo (até 3 tentativas). fn(n) é chamada em cada página; se devolver algo, para ali.
const percorrer = async fn => {
  if (pagControles().length < 2) return fn(1);
  await paraPrimeira();
  const f1 = pagFaixa(); const tam = f1 && f1[0] === 1 ? f1[1] : 0;
  for (let n = 1; n <= 300; n++) {
    const r = fn(n); if (r) return r;
    let foi = false;
    for (let t = 0; t < 3 && !foi; t++) {
      const prox = ctrlPagina(n + 1); if (!prox) return null;
      await irParaPagina(prox);
      const f = pagFaixa();
      foi = !tam || !f || f[0] === n * tam + 1;
      if (!foi) log('A página ' + (n + 1) + ' não abriu direito; tentando de novo...');
    }
    if (!foi) { log('Não consegui abrir a página ' + (n + 1) + ' da lista.'); return null; }
  }
  return null;
};
let ignoradasStatus = [];   // linhas lidas na última varredura cujo status não bateu com o filtro (para o aviso)
const varrerPaginas = async () => {
  const ids = []; ignoradasStatus = [];
  await percorrer(() => {
    lerLista().forEach(p => { if (!ids.includes(p.id)) ids.push(p.id); });
    if (!TODOS && MODO.status) linhasBrutas().forEach(p => { if (!p.status.includes(MODO.status) && !ignoradasStatus.includes(p.id)) ignoradasStatus.push(p.id); });
    return null;
  });
  if (pagControles().length >= 2) await paraPrimeira();
  return ids;
};
let paginaDaVez = null;
const naLista = async id => {
  let p = lerLista().find(x => x.id === id); if (p) return p;
  if (pagControles().length < 2) return null;
  // tenta primeiro a página onde achou o último pedido; depois percorre todas em ordem
  const c = paginaDaVez && ctrlPagina(paginaDaVez);
  if (c) { await irParaPagina(c); p = lerLista().find(x => x.id === id); if (p) return p; }
  let pag = null;
  p = await percorrer(n => { const a = lerLista().find(x => x.id === id); if (a) pag = n; return a || null; });
  if (p) paginaDaVez = pag;
  return p;
};

// ---------- lista completa direto do servidor do Hubii ----------
// A tela do Hubii pede a lista a papi.hubii.co/v2/hubs/<loja>/orders ordenada por prazo (next_sla). Com prazos iguais,
// a paginação da tela repete uns pedidos e esconde outros. Aqui a Central pede a mesma lista (com o login do navegador),
// tenta ordenações estáveis e só aceita o resultado se o número de pedidos diferentes bater com o total do servidor.
// o pedido ao servidor é feito pelo hook-lista.js, dentro da página, repetindo o pedido da própria tela (mesmas credenciais)
let nPedido = 0;
const pedirLista = params => new Promise((ok, falha) => {
  const n = ++nPedido;
  const fim = setTimeout(() => { window.removeEventListener('message', ouvir); falha(new Error('sem resposta do Hubii em 40 s')); }, 40000);
  function ouvir(ev) {
    const d = ev.data; if (ev.source !== window || !d || d.central !== 'lista-resp' || d.n !== n) return;
    clearTimeout(fim); window.removeEventListener('message', ouvir);
    if (d.ok) ok(d.json); else falha(new Error(d.erro || 'erro'));
  }
  window.addEventListener('message', ouvir);
  window.postMessage({ central: 'lista-pedir', n, params }, '*');
});
async function lerApi(statusRotulo) {
  // statusRotulo vazio = todos os status da aba Despacho
  const pedir = (ordem, pag, por) => pedirLista({ expedition_type: 'drop_off', delivery_status_str: statusRotulo ? JSON.stringify([statusRotulo]) : null, order_by: ordem, order_direction: 'asc', page: pag, per_page: por });
  const alvo = statusRotulo ? nt(statusRotulo) : null; let ultimo = '';
  for (const [ordem, por] of [['next_sla', 500], ['order_id', 100], ['accepted_at', 100], ['next_sla', 100]]) {
    try {
      const ids = []; let total = null, paginas = 1;
      for (let pag = 1; pag <= paginas && pag <= 60; pag++) {
        const j = await pedir(ordem, pag, por);
        if (!j || !Array.isArray(j.data)) throw new Error('resposta sem lista');
        total = Number(j.total); paginas = Number(j.total_pages) || 1;
        j.data.forEach(o => {
          const id = String(o.order_id || '');
          if (/^\d{5,9}$/.test(id) && (!alvo || nt(o.delivery_status_str) === alvo) && (!o.expedition_type || o.expedition_type === 'drop_off') && !ids.includes(id)) ids.push(id);
        });
      }
      if (Number.isFinite(total) && ids.length === total) return { ok: true, ids, total, ordem };
      ultimo = 'li ' + ids.length + ' de ' + total + ' (ordem ' + ordem + ')';
    } catch (e) { ultimo = e.message + ' (ordem ' + ordem + ')'; }
  }
  return { ok: false, motivo: ultimo };
}
let usouApi = null;
let achadosNaBusca = [];   // pedidos da memória achados só pela busca (o Hubii escondia das páginas)   // resultado da última leitura (para o aviso na conferência)
// lista de pedidos: primeiro pelo servidor; se não der, lê a tela página por página
async function lerPedidosDoStatus() {
  const r = await lerApi(MODO.marcar === 'esperando expedicao' ? 'Esperando Expedição' : 'Esperando NFe do Hub');
  usouApi = r;
  if (r.ok) { log('Lista lida direto do Hubii: ' + r.ids.length + ' pedido(s).'); return { ids: r.ids, total: r.total }; }
  log('Não deu para ler a lista direto do Hubii (' + r.motivo + '); lendo a tela página por página.');
  const ids = await varrerPaginas();
  return { ids, total: totalNaTela() };
}
// acha a linha do pedido na lista; se o Hubii esconder o pedido das páginas, procura pelo número na busca
const fonteLista = () => usouApi && usouApi.ok ? 'Lista lida direto do servidor do Hubii (todos os ' + usouApi.total + ' pedidos, sem depender das páginas da tela).' : 'Lista lida da tela, página por página' + (usouApi ? ' (o servidor do Hubii não respondeu: ' + usouApi.motivo + ')' : '') + '.';
// Sem a lista do servidor: procura um a um, pela busca do Hubii, os pedidos conhecidos (memória) que não apareceram
// nas páginas da tela; os achados no status certo entram em ids.
async function completarPelaBusca(ids, conhecidos) {
  achadosNaBusca = [];
  if (usouApi && usouApi.ok) return;
  const sumidos = conhecidos.filter((id, i, a) => !ids.includes(id) && a.indexOf(id) === i);
  if (!sumidos.length || sumidos.length > 80 || !await esperar(campoBuscaH, 5)) return;
  for (let i = 0; i < sumidos.length; i++) {
    const id = sumidos[i]; log('Procurando pela busca os que não apareceram nas páginas: ' + (i + 1) + ' de ' + sumidos.length + ' (#' + id + ')...');
    setBuscaH(campoBuscaH(), id); await sleep(1800);
    if (await esperar(() => lerLista().find(x => x.id === id), 6)) { ids.push(id); achadosNaBusca.push(id); }
  }
  limparBusca(); await sleep(1500); await esperar(() => lerLista().length > 0, 10);
}
async function acharPedido(id) {
  let p = lerLista().find(x => x.id === id); if (p) return p;
  const c = campoBuscaH();
  if (c && c.value) { setBuscaH(c, ''); await sleep(1500); await esperar(() => lerLista().length > 0, 10); }
  p = await naLista(id); if (p) return p;
  const c2 = await esperar(campoBuscaH, 10); if (!c2) return null;
  log('#' + id + ': não aparece nas páginas da lista; procurando pelo número na busca do Hubii...');
  setBuscaH(c2, id); await sleep(2200);
  return await esperar(() => lerLista().find(x => x.id === id), 8);
}
const limparBusca = () => { try { const c = campoBuscaH(); if (c && c.value) setBuscaH(c, ''); } catch (e) {} };

// abre o pedido clicando na linha; se abrir outro pedido ou nada, volta para a lista e tenta de novo (até 3 vezes)
const abrirPedido = async (id, alvo) => {
  for (let t = 1; t <= 3; t++) {
    if (t > 1) {
      if (estaNoDetalhe()) { const v = botao('voltar'); if (v) v.click(); await esperar(() => !estaNoDetalhe(), 15); }
      await esperar(() => lerLista().length > 0, 20); await sleep(1500);
      alvo = await acharPedido(id);
      if (!alvo) { log('#' + id + ': não achei mais na lista ao tentar de novo.'); return false; }
    }
    alvo.el.click();
    if (await esperar(() => idAtual() === id, 12)) return true;
    const visto = idAtual();
    log('#' + id + ': o clique ' + (visto ? 'abriu outro pedido (#' + visto + ')' : 'não abriu o pedido') + '; tentativa ' + t + ' de 3.');
  }
  return false;
};

/* ---------- interface ---------- */
const CSS = `
#central-hubii-raiz, #central-hubii-raiz * { box-sizing: border-box; font-family: Segoe UI, Arial, sans-serif; }
#central-hubii-raiz .ch-fundo { position: fixed; inset: 0; background: rgba(15,10,40,.62); z-index: 2147483646; display: flex; align-items: center; justify-content: center; }
#central-hubii-raiz .ch-janela { background: #fff; color: #1b1740; width: min(780px, 94vw); max-height: 90vh; border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.45); }
#central-hubii-raiz .ch-topo { background: #3a1f6d; color: #fff; padding: 16px 22px; }
#central-hubii-raiz .ch-topo h2 { margin: 0; font-size: 18px; font-weight: 700; }
#central-hubii-raiz .ch-topo p { margin: 4px 0 0; font-size: 13px; color: #d9d2f3; }
#central-hubii-raiz .ch-corpo { padding: 14px 22px; overflow: auto; flex: 1; font-size: 14px; }
#central-hubii-raiz .ch-aviso { padding: 10px 14px; border-radius: 10px; margin-bottom: 8px; font-size: 14px; line-height: 1.45; }
#central-hubii-raiz .ch-ok { background: #e2f3e6; color: #0b3d1a; }
#central-hubii-raiz .ch-atencao { background: #fff1cc; color: #5e4700; }
#central-hubii-raiz .ch-erro { background: #fdf1ef; color: #5e140e; }
#central-hubii-raiz .ch-info { background: #ece9fb; color: #2d254d; }
#central-hubii-raiz table { width: 100%; border-collapse: collapse; margin-top: 6px; }
#central-hubii-raiz th { text-align: left; font-size: 12px; color: #5a5480; padding: 6px 8px; border-bottom: 1px solid #ddd; position: sticky; top: 0; background: #fff; }
#central-hubii-raiz td { padding: 6px 8px; border-bottom: 1px solid #ece8f8; font-size: 14px; }
#central-hubii-raiz tr.cinza td { color: #8c88a3; }
#central-hubii-raiz tr.fora td { color: #8a5a00; }
#central-hubii-raiz .ch-rodape { padding: 14px 22px; border-top: 1px solid #ddd8f2; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; background: #f6f5fc; }
#central-hubii-raiz button.ch-b { background: #5b3cc4; color: #fff; border: 0; border-radius: 10px; height: 46px; padding: 0 24px; font-size: 15px; font-weight: 700; cursor: pointer; }
#central-hubii-raiz button.ch-b:disabled { background: #b9b2dc; cursor: not-allowed; }
#central-hubii-raiz button.ch-s { background: #fff; color: #3a1f6d; border: 1px solid #b9b2dc; border-radius: 9px; height: 42px; padding: 0 18px; font-size: 14px; font-weight: 600; cursor: pointer; }
#central-hubii-raiz input[type=number] { width: 68px; padding: 5px; border: 1px solid #b9b2dc; border-radius: 4px; color: #000; background: #fff; }
`;
let raiz = null;
const garantirRaiz = () => {
  if (raiz && raiz.isConnected) return raiz;
  raiz = document.createElement('div'); raiz.id = 'central-hubii-raiz';
  const st = document.createElement('style'); st.textContent = CSS; raiz.appendChild(st);
  document.body.appendChild(raiz);
  return raiz;
};
const limparRaiz = (classe) => { garantirRaiz(); [...raiz.children].forEach(c => { if (c.tagName !== 'STYLE' && (!classe || c.classList.contains(classe))) c.remove(); }); };
const h = (tag, cls, texto, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; if (attrs) Object.assign(e, attrs); return e; };
const esc = s => String(s);

let rodando = false;
let ocupado = false;
let parar = false;
const UI = () => window.__centralUI;
const caixaProgresso = (titulo) => {
  limparRaiz('ch-fundo'); limparRaiz('ch-caixa'); limparRaiz('ch-lanc');
  if (caixaProgresso.f) caixaProgresso.f.remover();
  const f = UI().faixa({ titulo: titulo || caixaProgresso.titulo || 'Central Hubii', onParar: () => { parar = true; log('Parada pedida: termino o pedido atual e paro.'); } });
  raiz.appendChild(f.el); caixaProgresso.f = f;
  return f.el;
};
const log = m => { console.log('[Central Hubii] ' + m); try { const L = JSON.parse(localStorage.getItem('hubii_central_log') || '[]'); L.push({ t: Date.now(), m: String(m).slice(0, 300) }); localStorage.setItem('hubii_central_log', JSON.stringify(L.slice(-30))); } catch (e) {} if (caixaProgresso.f) caixaProgresso.f.set({ msg: m }); };
let PROG = null;
const prog = (n, total, atual, titulo) => { PROG = { n, total, atual: atual || '', titulo: titulo || (PROG && PROG.titulo) || '' }; if (caixaProgresso.f) caixaProgresso.f.set({ n, total, atual: atual || '', titulo }); };
// Painel local da Central: o painel-ponte.js lê o estado daqui e pode pedir para parar (termina o pedido atual).
window.__centralPainel = {
  estado: () => { if (!rodando) PROG = null; return estadoPainel(); }
};
const estadoPainel = () => ({ rodando: !!rodando, modo: rodando && MODO ? MODO.chave : null, titulo: rodando ? ((PROG && PROG.titulo) || (MODO && MODO.titulo) || '') : '', n: rodando && PROG ? PROG.n : 0, total: rodando && PROG ? PROG.total : 0, atual: rodando && PROG ? PROG.atual : '' });
window.__centralPainel.parar = () => { if (rodando && !parar) { parar = true; log('Parada pedida pelo painel: termino o pedido atual e paro.'); } };
// extra: { estado: 'ok'|'parou'|'atencao', stats: [[rótulo, valor]], acoes: [{t, f, tipo}] }
const fimCaixa = (m, relatorio, extra) => {
  console.log('[Central Hubii] ' + m);
  extra = extra || {};
  const f = caixaProgresso.f; if (!f) return;
  const acoes = (extra.acoes || []).slice();
  if (relatorio) acoes.push({ t: 'Copiar relatório', tipo: 'sec', f: ev => { const bc = ev && ev.currentTarget; navigator.clipboard.writeText(relatorio).then(() => { if (bc) bc.textContent = 'Copiado'; }); } });
  f.fim(extra.estado || (/^Fim/.test(m) ? 'ok' : 'parou'), m, { stats: extra.stats, acoes, aoFechar: () => lancador() });
};

/* ---------- lista de conferência (o "SO_LISTAR = true") ---------- */
// itens: [{id, nota, estado:'ok'|'cinza'|'fora', marcado, desabilitado}]
function janelaLista(cfg) {
  return new Promise(resolve => {
    limparRaiz();
    const fundo = h('div', 'ch-fundo'); const jan = h('div', 'ch-janela');
    const topo = h('div', 'ch-topo'); topo.appendChild(h('h2', null, cfg.titulo)); topo.appendChild(h('p', null, cfg.subtitulo));
    const corpo = h('div', 'ch-corpo');
    const rod = h('div', 'ch-rodape');
    jan.append(topo, corpo, rod); fundo.appendChild(jan); raiz.appendChild(fundo);
    const estado = { tela: cfg.tela, total: cfg.totalTela, itens: cfg.itens, ciente: false };
    const semTela = !!cfg.semConferenciaTela;
    const inputQtd = h('input', null, null, { type: 'number', min: 1, value: 1 });
    const chkCiente = h('input', null, null, { type: 'checkbox' });
    const lblCiente = h('label', null, null); lblCiente.style.cssText = 'font-size:12.5px;color:#8a1111;display:none'; lblCiente.append(chkCiente, document.createTextNode(' A tela e a lista diferem; seguir mesmo assim'));
    const bOk = h('button', 'ch-b', 'Confirmar'); const bCan = h('button', 'ch-s', 'Cancelar'); const bRel = h('button', 'ch-s', 'Ler de novo');
    const lQtd = h('label', null, 'Quantos agora: '); lQtd.style.fontSize = '13px'; lQtd.appendChild(inputQtd);
    rod.append(lQtd, lblCiente, bRel, bCan, bOk);
    if (semTela) bRel.style.display = 'none';
    const selecionados = () => estado.itens.filter(i => i.marcado && !i.desabilitado);
    const diverge = () => estado.total !== null && estado.total !== estado.tela;
    const atualizarBotao = () => {
      const n = selecionados().length;
      const q = Math.max(1, Math.min(parseInt(inputQtd.value, 10) || 0, n));
      bOk.textContent = cfg.verbo(Math.min(q, n));
      bOk.disabled = !n || (diverge() && !chkCiente.checked);
      inputQtd.max = n;
    };
    const desenhar = () => {
      corpo.textContent = '';
      const ok = !diverge();
      if (!semTela) {
        const av = h('div', 'ch-aviso ' + (ok ? 'ch-ok' : 'ch-erro'),
          (ok ? '✔ Bate com a tela: ' : '✖ NÃO bate com a tela: ') + 'a tela diz ' + (estado.total === null ? '(não consegui ler)' : estado.total) + ' pedido(s) e eu li ' + estado.tela + ' na aba Despacho, filtro "' + cfg.rotulo + '".');
        corpo.appendChild(av);
      }
      lblCiente.style.display = ok || semTela ? 'none' : 'inline';
      if (cfg.permiteAdicionar) {
        const bx = h('div'); bx.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0 8px';
        const inp = h('input', null, null, { type: 'text', placeholder: 'Cole aqui os números dos pedidos (separados por espaço); a ordem colada vale' }); inp.style.cssText = 'flex:1;min-width:260px;padding:8px;border:1px solid #b9b2dc;border-radius:8px;font-size:13px;color:#000;background:#fff';
        const bAdd = h('button', 'ch-s', 'Adicionar'); bAdd.onclick = () => {
          // a ordem colada vira a ordem de impressão: os pedidos colados vão para o topo, marcados, na ordem em que foram colados
          const ids = [...new Set(inp.value.match(/\d{7}/g) || [])];
          if (!ids.length) return;
          const novos = ids.map(id => { const ja = estado.itens.find(x => x.id === id); return ja ? Object.assign(ja, { marcado: true }) : { id, nota: cfg.notaAdicionado || 'adicionado por você', estado: 'fora', marcado: true }; });
          estado.itens = novos.concat(estado.itens.filter(x => !ids.includes(x.id)));
          inp.value = ''; desenhar();
        };
        const bTodos = h('button', 'ch-s', 'Marcar todos'); bTodos.onclick = () => { estado.itens.forEach(x => { if (!x.desabilitado) x.marcado = true; }); desenhar(); };
        const bNada = h('button', 'ch-s', 'Desmarcar todos'); bNada.onclick = () => { estado.itens.forEach(x => { x.marcado = false; }); desenhar(); };
        bx.append(inp, bAdd, bTodos, bNada); corpo.appendChild(bx);
      }
      cfg.infos.forEach(t => corpo.appendChild(h('div', 'ch-aviso ch-info', t)));
      const tb = h('table'); const th = h('tr');
      ['', '#', 'Pedido', 'Situação'].concat(cfg.aPartirDaqui ? [''] : []).forEach(t => th.appendChild(h('th', null, t))); tb.appendChild(th);
      estado.itens.forEach((it, i) => {
        const tr = h('tr', it.estado === 'cinza' ? 'cinza' : it.estado === 'fora' ? 'fora' : '');
        const td0 = h('td'); const cb = h('input', null, null, { type: 'checkbox', checked: !!it.marcado && !it.desabilitado, disabled: !!it.desabilitado });
        cb.onchange = () => { it.marcado = cb.checked; atualizarBotao(); }; td0.appendChild(cb);
        tr.append(td0, h('td', null, String(i + 1)), h('td', null, '#' + it.id), h('td', null, it.nota));
        if (cfg.aPartirDaqui) { const td5 = h('td'); const ba = h('button', 'ch-s', 'daqui até o fim'); ba.style.cssText = 'height:30px;padding:0 10px;font-size:12px'; ba.onclick = () => { estado.itens.forEach((x, j) => { if (j >= i && !x.desabilitado) x.marcado = true; }); desenhar(); }; td5.appendChild(ba); tr.appendChild(td5); }
        tb.appendChild(tr);
      });
      corpo.appendChild(tb);
      inputQtd.value = Math.max(1, selecionados().length);
      atualizarBotao();
    };
    inputQtd.oninput = atualizarBotao; chkCiente.onchange = atualizarBotao;
    bCan.onclick = () => { limparRaiz(); resolve(null); };
    bRel.onclick = async () => { bRel.disabled = true; bRel.textContent = 'Lendo...'; const novo = await cfg.reler(); if (novo) { estado.tela = novo.tela; estado.total = novo.totalTela; estado.itens = novo.itens; chkCiente.checked = false; } bRel.disabled = false; bRel.textContent = 'Ler de novo'; desenhar(); };
    bOk.onclick = () => {
      const sel = selecionados(); const q = Math.max(1, Math.min(parseInt(inputQtd.value, 10) || 0, sel.length));
      if (!confirm(cfg.verbo(q) + '?\n\n' + (cfg.aviso || ''))) return;
      limparRaiz(); resolve({ ids: sel.slice(0, q).map(i => i.id), itens: estado.itens });
    };
    desenhar();
  });
}

/* ---------- Descritivos ---------- */
async function levantarDescritivos() {
  const lp = await lerPedidosDoStatus(); const tela = lp.ids;
  const total = lp.total;
  const fat = fatLer(); const fila = filaLer(); const filaIds = new Set(fila.map(x => x.id));
  const itens = tela.map(id => {
    if (id in fat) return { id, nota: 'faturado há pouco (ainda aguardando a NFe do Hub): não repetir', estado: 'cinza', marcado: false };
    return { id, nota: filaIds.has(id) ? 'já está na memória (sem etiqueta ainda)' : 'novo', estado: 'ok', marcado: true };
  });
  return { tela: tela.length, totalTela: total, itens };
}
async function rodarDescritivos() {
  MODO = MODOS.descritivos;
  const cx = caixaProgresso('Descritivos: preparando a tela'); log('Preparando a tela: aba Despacho, filtro "Esperando NFe do Hub"...');
  if (estaNoDetalhe()) { botao('voltar').click(); await esperar(() => !estaNoDetalhe(), 15); }
  if (!await prepararTela()) { fimCaixa('Não consegui deixar a tela em DESPACHO com o filtro "Esperando NFe do Hub". Aplique à mão (Despacho > Filtros) e clique de novo em Descritivos. Nada foi faturado.'); return; }
  await esperar(() => lerLista().length > 0, 20); await sleep(800);
  log('Lendo todas as páginas da lista...');
  let dados = await levantarDescritivos();
  if (!dados.itens.length) { fimCaixa('Não li nenhum pedido em "Esperando NFe do Hub". Nada a fazer.'); return; }
  gravar('central_hubii_ultima_lista_desc', { t: Date.now(), ids: dados.itens.map(i => i.id) });
  limparRaiz('ch-caixa');
  const r = await janelaLista({
    titulo: 'Descritivos: conferir antes de faturar', rotulo: MODO.rotulo,
    subtitulo: 'Nada foi faturado ainda. Confira se esta lista é igual à da tela; ao confirmar, cada pedido é faturado e o descritivo sai na MP-4200 TH, nesta ordem.',
    tela: dados.tela, totalTela: dados.totalTela, itens: dados.itens,
    infos: [fonteLista(), 'Faturar emite nota fiscal e não dá para desfazer. Ao confirmar, estes pedidos entram na memória que a rotina de Etiquetas vai usar, na mesma ordem.'],
    verbo: n => 'Confirmar e faturar ' + n + ' pedido(s)', aviso: 'Faturar emite nota fiscal e não dá para desfazer.',
    reler: async () => { try { return await levantarDescritivos(); } catch (e) { return null; } }
  });
  if (!r) { lancador(); return; }
  rodando = true; parar = false; caixaProgresso('Descritivos: faturando e imprimindo');
  const T0 = Date.now(); const evit = dados.itens.filter(i => i.estado === 'cinza').length;
  const ids = r.ids; const feitos = []; const pulados = [];
  const fat = fatLer();
  const marcarFat = id => { fat[id] = Date.now(); gravar(K_FAT, fat); };
  const entrarFila = id => { const q = filaLer(); if (!q.some(x => x.id === id)) { q.push({ id, etiqueta: false, dia: HOJE(), t: Date.now(), hora: new Date().toLocaleTimeString('pt-BR') }); gravar(K_FILA, q); } };
  // zera a memória antiga se todos já tiveram etiqueta impressa
  { const imp = histSet(); const q0 = filaLer(); gravar(K_FILA, q0.length && q0.every(x => x.etiqueta || imp.has(x.id)) ? [] : q0); }
  try {
    for (let i = 0; i < ids.length && !parar; i++) {
      const id = ids[i];
      prog(feitos.length + pulados.length, ids.length, '#' + id, 'Descritivos: faturando e imprimindo');
      log('Abrindo #' + id + '...');
      const alvo = await acharPedido(id);
      if (!alvo) { pulados.push(id); prog(feitos.length + pulados.length, ids.length, '#' + id); log('#' + id + ' não está mais na lista; pulei.'); continue; }
            if (!await abrirPedido(id, alvo)) { log('Não consegui abrir #' + id + '. Parando.'); break; }
      await sleep(1500);
      const f = await esperar(() => { const b = botao('faturar'); return b && !b.disabled ? b : null; }, 15);
      if (!f) { pulados.push(id); log('#' + id + ': botão Faturar não liberou em 15s (ou já faturado), pulei.'); }
      else {
        f.click(); marcarFat(id); entrarFila(id);
        await esperar(() => { const b = botao('faturar'); return !b || b.disabled; }, 30);
        const imp = await esperar(() => { const b = botao('imprimir descritivo'); return b && !b.disabled ? b : null; }, 30);
        if (!imp) { log('#' + id + ': faturou, mas o botão de imprimir não liberou (imprima à mão). Parando.'); feitos.push(id); regPed(id, { itens: lerItensTela() }); break; }
        imp.click(); feitos.push(id); regPed(id, { desc: Date.now(), itens: lerItensTela() }); prog(feitos.length + pulados.length, ids.length, '#' + id); log('#' + id + ': faturado e descritivo enviado.');
        await sleep(5000);
      }
      const v = botao('voltar'); if (!v) { log('Botão Voltar não encontrado. Parando.'); break; }
      v.click(); await esperar(() => !estaNoDetalhe(), 15); await esperar(() => lerLista().length > 0 || linhasBrutas().length === 0, 20); await sleep(1500);
    }
  } catch (e) { console.error(e); log('Erro inesperado: ' + e.message); }
  rodando = false; limparBusca();
  const dTot = Date.now() - T0;
  if (feitos.length || pulados.length) reg('descritivos', T0, { n: feitos.length, pul: pulados.length, evit, parado: parar });
  const rel = 'Descritivos faturados e enviados (' + feitos.length + '): ' + feitos.join(' ') + (pulados.length ? '\nPulados: ' + pulados.join(' ') : '');
  const completo = !parar && feitos.length + pulados.length >= ids.length;
  fimCaixa((completo ? 'Concluído: ' : 'Parou: ') + feitos.length + ' pedido(s) faturado(s) e descritivo enviado' + (pulados.length ? '; ' + pulados.length + ' pulado(s)' : '') + '. Tempo: ' + durTxt(dTot) + (feitos.length ? ' (média de ' + durTxt(dTot / feitos.length) + ' por pedido)' : '') + (completo ? '. Agora use Imprimir Etiquetas.' : '. Confira o que faltou antes de continuar.'), rel, { estado: completo ? 'ok' : 'parou', stats: [['Tempo total', durTxt(dTot)], ['Média por pedido', feitos.length ? durTxt(dTot / feitos.length) : '-'], ['Repetições evitadas', String(evit)]] });
}

/* ---------- Etiquetas ---------- */
async function levantarEtiquetas(reimprimir) {
  const lp = await lerPedidosDoStatus(); const tela = lp.ids;
  const total = lp.total;
  const fila = filaLer(); const filaIds = fila.map(x => x.id); const hs = histSet();
  // sem a lista do servidor: os pedidos da memória que não apareceram nas páginas são procurados um a um pela busca
  await completarPelaBusca(tela, filaIds.filter(id => !hs.has(id)));
  const noFila = filaIds.filter(id => tela.includes(id));
  const fora = tela.filter(id => !filaIds.includes(id));
  const horaDe = id => { const x = fila.find(f => f.id === id); return x && x.t ? hora(x.t) : '?'; };
  const itens = noFila.map(id => hs.has(id)
    ? { id, nota: 'na memória (descritivo ' + horaDe(id) + ') · JÁ IMPRESSA', estado: 'cinza', marcado: false }
    : { id, nota: 'na memória (descritivo ' + horaDe(id) + ') · falta imprimir', estado: 'ok', marcado: true });
  fora.forEach(id => itens.push({ id, nota: 'FORA da memória dos descritivos (ex.: impresso à mão): só imprime se você marcar', estado: 'fora', marcado: false }));
  const naoApareceu = filaIds.filter(id => !tela.includes(id) && !hs.has(id));
  return { tela: tela.length, totalTela: total, itens, memoria: fila.length, naoApareceu };
}
async function rodarEtiquetas() {
  MODO = MODOS.etiquetas;
  caixaProgresso('Etiquetas: preparando a tela'); log('Preparando a tela: aba Despacho, filtro "Esperando Expedição"...');
  if (estaNoDetalhe()) { botao('voltar').click(); await esperar(() => !estaNoDetalhe(), 15); }
  if (!await prepararTela()) { fimCaixa('Não consegui deixar a tela em DESPACHO com o filtro "Esperando Expedição". Aplique à mão (Despacho > Filtros) e clique de novo em Etiquetas. Nada foi impresso.'); return; }
  await esperar(() => lerLista().length > 0, 20); await sleep(800);
  log('Lendo todas as páginas da lista...');
  const dados = await levantarEtiquetas();
  if (!dados.itens.length) { fimCaixa('Não li nenhum pedido em "Esperando Expedição". Nada a fazer.'); return; }
  const infosDe = d => {
    const i = [fonteLista()];
    if (achadosNaBusca.length) i.push('Achados pela busca do Hubii (estavam escondidos das páginas): ' + achadosNaBusca.length + ' pedido(s). Eles entram na ordem normal dos descritivos.');
    i.push('Memória dos descritivos: ' + d.memoria + ' pedido(s) gravados nas últimas 72h.');
    if (!d.memoria) i.push('ATENÇÃO: não há memória de descritivos. Nenhum pedido está marcado; marque à mão os que quiser imprimir.');
    if (ignoradasStatus.length) i.push('Linhas da tela que eu NÃO reconheci como "Esperando Expedição" (ficaram de fora): ' + ignoradasStatus.length + ' (' + ignoradasStatus.slice(0, 6).map(x => '#' + x).join(', ') + (ignoradasStatus.length > 6 ? '...' : '') + '). Se elas estão em Esperando Expedição no Hubii, me mande um print de uma dessas linhas.');
    if (d.naoApareceu.length) i.push('Na memória, mas ainda NÃO estão em "Esperando Expedição" (aguardando a NFe): ' + d.naoApareceu.length + ' (' + d.naoApareceu.slice(0, 6).map(x => '#' + x).join(', ') + (d.naoApareceu.length > 6 ? '...' : '') + '). Quando liberarem, rode de novo.');
    return i;
  };
  limparRaiz('ch-caixa');
  const cfg = {
    titulo: 'Etiquetas: conferir antes de imprimir', rotulo: MODO.rotulo,
    subtitulo: 'Nada foi impresso ainda. A ordem abaixo é a dos descritivos. Desmarque o que não quiser e confirme; as etiquetas saem na Argox, uma por vez.',
    tela: dados.tela, totalTela: dados.totalTela, itens: dados.itens, infos: infosDe(dados),
    permiteAdicionar: true, notaAdicionado: 'adicionado por você (precisa estar em Esperando Expedição)',
    verbo: n => 'Confirmar e imprimir ' + n + ' etiqueta(s)', aviso: 'Confirme que a Argox é a impressora padrão e que o ajudante do PowerShell está aberto.',
    reler: async () => { try { const d = await levantarEtiquetas(); cfg.infos.length = 0; infosDe(d).forEach(x => cfg.infos.push(x)); return d; } catch (e) { return null; } }
  };
  const r = await janelaLista(cfg);
  if (!r) { lancador(); return; }
  rodando = true; parar = false; caixaProgresso('Etiquetas: imprimindo em ordem');
  const T0 = Date.now(); const evit = dados.itens.filter(i => i.estado === 'cinza').length;
  const ids = r.ids; const feitos = [];
  const marcarImpressa = id => { const hh = histLer(); hh.push({ id, dia: HOJE(), t: Date.now(), hora: new Date().toLocaleTimeString('pt-BR') }); gravar(K_HIST, hh); };
  try {
    for (let i = 0; i < ids.length && !parar; i++) {
      const id = ids[i];
      prog(feitos.length, ids.length, '#' + id, 'Etiquetas: imprimindo em ordem');
      log('Procurando #' + id + ' nas páginas...');
      const alvo = await acharPedido(id);
      if (!alvo) { log('#' + id + ' (próximo da ordem) não está na lista nem na busca do Hubii. Parei para manter a ordem.'); break; }
            if (!await abrirPedido(id, alvo)) { log('Não consegui abrir #' + id + '. Parando.'); break; }
      await sleep(1500);
      const et = await esperar(() => { const b = botao('imprimir etiqueta'); return b && !b.disabled ? b : null; }, ESPERA_MIN * 60);
      if (!et) { log('#' + id + ': botão "Imprimir etiqueta" não liberou em ' + ESPERA_MIN + ' min. Parei para manter a ordem.'); break; }
      et.click(); log('#' + id + ': cliquei em "Imprimir etiqueta"; aguardando a aba abrir...');
      let abriu = await esperar(() => document.visibilityState === 'hidden', 10, true);
      for (let t = 2; !abriu && t <= 3; t++) {
        log('#' + id + ': a aba da etiqueta não abriu; clicando de novo (tentativa ' + t + ' de 3)...');
        const b2 = botao('imprimir etiqueta'); if (!b2) break;
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(tp => b2.dispatchEvent(new MouseEvent(tp, { bubbles: true, cancelable: true, view: window })));
        abriu = await esperar(() => document.visibilityState === 'hidden', 10, true);
      }
      if (!abriu) { log('#' + id + ': a aba da etiqueta NÃO abriu depois de 3 cliques (provável pop-up bloqueado). Não marquei como impressa. Libere pop-ups para hub.hubii.co.'); break; }
      if (!await esperar(() => document.visibilityState === 'visible', ESPERA_ABA_SEG, true)) { log('#' + id + ': a aba da etiqueta não foi fechada em ' + ESPERA_ABA_SEG + 's. Não marquei como impressa; confira a impressão e o ajudante.'); break; }
      marcarImpressa(id); feitos.push(id); regPed(id, { etq: Date.now(), itens: lerItensTela() }); prog(feitos.length, ids.length, '#' + id);
      log('#' + id + ': etiqueta impressa e aba fechada. Últimas: ' + feitos.slice(-4).map(x => '#' + x).join(', '));
      await sleep(1500);
      const v = botao('voltar'); if (!v) { log('Botão Voltar não encontrado. Parando.'); break; }
      v.click(); await esperar(() => !estaNoDetalhe(), 15); await esperar(() => lerLista().length > 0, 20); await sleep(1500);
    }
  } catch (e) { console.error(e); log('Erro inesperado: ' + e.message); }
  rodando = false; limparBusca();
  const dTot = Date.now() - T0;
  if (feitos.length) reg('etiquetas', T0, { n: feitos.length, pul: 0, evit, parado: parar || ids.length > feitos.length });
  const faltam = ids.filter(x => !feitos.includes(x));
  const rel = 'Etiquetas impressas (' + feitos.length + '), em ordem: ' + feitos.join(' ') + (faltam.length ? '\nNão impressas desta rodada: ' + faltam.join(' ') : '');
  const completo = !parar && feitos.length >= ids.length;
  fimCaixa((completo ? 'Concluído: ' : 'Parou: ') + feitos.length + ' etiqueta(s) confirmada(s)' + (feitos.length ? ' (de #' + feitos[0] + ' a #' + feitos[feitos.length - 1] + ')' : '') + (faltam.length ? '. Faltaram ' + faltam.length + ' da seleção.' : '.') + ' Ao terminar, feche a janela do ajudante: a MP-4200 volta a ser a impressora padrão. Tempo: ' + durTxt(dTot) + (feitos.length ? ' (média de ' + durTxt(dTot / feitos.length) + ' por etiqueta)' : '') + '.', rel, { estado: completo ? 'ok' : 'parou', stats: [['Tempo total', durTxt(dTot)], ['Média por etiqueta', feitos.length ? durTxt(dTot / feitos.length) : '-'], ['Repetições evitadas', String(evit)]] });
}


/* ---------- Ler códigos BR (sem imprimir) ---------- */
// Para pedidos cuja memória do código BR se perdeu: abre cada um, clica em "Imprimir etiqueta" só para o Hubii montar o PDF,
// a Central lê o código dele e a aba da etiqueta é fechada (pelo background.js) sem imprimir nada.
const avisarFechar = ativo => { try { chrome.runtime.sendMessage({ central: 'fechar-abas', ativo }); } catch (e) {} };
async function rodarLerBR() {
  MODO = MODOS.etiquetas;
  caixaProgresso('Ler códigos BR: preparando a tela'); log('Preparando a tela: aba Despacho, filtro "Esperando Expedição"...');
  if (estaNoDetalhe()) { botao('voltar').click(); await esperar(() => !estaNoDetalhe(), 15); }
  if (!await prepararTela()) { fimCaixa('Não consegui deixar a tela em DESPACHO com o filtro "Esperando Expedição". Aplique à mão (Despacho > Filtros) e tente de novo. Nada foi aberto.'); return; }
  await esperar(() => lerLista().length > 0, 20); await sleep(800);
  log('Lendo a lista completa...');
  const ids = (await lerPedidosDoStatus()).ids;
  if (!ids.length) { fimCaixa('Não li nenhum pedido em "Esperando Expedição". Nada a fazer.'); return; }
  const m0 = brLer(); const falta = ids.filter(id => !m0[id]);
  if (!falta.length) { fimCaixa('Os ' + ids.length + ' pedidos da tela já têm o código BR na memória. Nada a fazer.'); return; }
  if (!confirm(falta.length + ' de ' + ids.length + ' pedidos estão sem o código BR na memória.\n\nVou abrir cada um, clicar em "Imprimir etiqueta" só para ler o código e fechar a aba da etiqueta, SEM imprimir. Leva cerca de ' + Math.max(1, Math.round(falta.length * 8 / 60)) + ' min.\n\nContinuar?')) { fimCaixa('Cancelado. Nada foi aberto.'); return; }
  rodando = true; parar = false; caixaProgresso('Ler códigos BR: lendo');
  const T0 = Date.now(); const lidos = []; const semBR = [];
  try {
    for (let i = 0; i < falta.length && !parar; i++) {
      const id = falta[i];
      prog(lidos.length + semBR.length, falta.length, '#' + id, 'Ler códigos BR: lendo');
      const alvo = await acharPedido(id);
      if (!alvo) { semBR.push(id); log('#' + id + ' não está mais na lista; pulei.'); continue; }
      if (!await abrirPedido(id, alvo)) { log('Não consegui abrir #' + id + '. Parando.'); break; }
      await sleep(1500);
      const et = await esperar(() => { const b = botao('imprimir etiqueta'); return b && !b.disabled ? b : null; }, 20);
      if (!et) { semBR.push(id); log('#' + id + ': o botão "Imprimir etiqueta" não liberou; pulei.'); }
      else {
        avisarFechar(true); await sleep(200);
        et.click();
        const ok = await esperar(() => { const x = brLer()[id]; return x && x.t >= T0 ? x : null; }, 20, true);
        if (ok) { lidos.push(id); regPed(id, { itens: lerItensTela() }); log('#' + id + ': código ' + ok.br + ' guardado.'); } else { semBR.push(id); log('#' + id + ': não consegui ler o código BR do PDF.'); }
        await esperar(() => document.visibilityState === 'visible', 15, true);
      }
      await sleep(500);
      const v = botao('voltar'); if (!v) { log('Botão Voltar não encontrado. Parando.'); break; }
      v.click(); await esperar(() => !estaNoDetalhe(), 15); await esperar(() => lerLista().length > 0, 20); await sleep(1200);
    }
  } catch (e) { console.error(e); log('Erro inesperado: ' + e.message); }
  avisarFechar(false);
  rodando = false; limparBusca();
  const restam = falta.filter(x => !lidos.includes(x) && !semBR.includes(x));
  const rel = 'Códigos BR lidos (' + lidos.length + '): ' + lidos.join(' ') + (semBR.length ? '\nNão consegui ler: ' + semBR.join(' ') : '') + (restam.length ? '\nFaltou rodar: ' + restam.join(' ') : '');
  const completo = !parar && !restam.length;
  fimCaixa((completo ? 'Concluído: ' : 'Parou: ') + lidos.length + ' código(s) BR guardado(s)' + (semBR.length ? '; ' + semBR.length + ' sem leitura' : '') + (restam.length ? '; faltaram ' + restam.length : '') + '. Nada foi impresso. Tempo: ' + durTxt(Date.now() - T0) + '.', rel);
}

/* ---------- Reimprimir descritivos (sem faturar) ---------- */
const campoBuscaH = () => [...document.querySelectorAll('input')].find(i => vis(i) && !i.closest('#central-hubii-raiz') && /uscar/i.test(i.placeholder || ''));
const setBuscaH = (c, v) => {
  const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  if (c.focus) c.focus();
  if (d && d.set) d.set.call(c, v); else c.value = v;
  c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true }));
};
const ROT_ABAS = ['coleta', 'despacho', 'entrega propria', 'em transito', 'finalizados'];
const abasComPedido = () => [...document.querySelectorAll('button, [role="tab"], a')].filter(b => vis(b) && !b.closest('#central-hubii-raiz'))
  .map(b => { const t = nt(txt(b)); const m = t.match(/^(coleta|despacho|entrega propria|em transito|finalizados)\s*(\d+)?$/); return m ? { b, n: m[2] ? parseInt(m[2], 10) : null } : null; }).filter(Boolean);
async function buscarPedido(id) {
  const c = await esperar(campoBuscaH, 15); if (!c) return null;
  if (c.value) { setBuscaH(c, ''); await sleep(1500); }
  setBuscaH(c, id); await sleep(2200);
  let p = await esperar(() => linhasBrutas().find(x => x.id === id), 6); if (p) return p;
  for (const a of abasComPedido()) {
    if (!a.n) continue;
    a.b.click(); await sleep(1500);
    p = await esperar(() => linhasBrutas().find(x => x.id === id), 4); if (p) return p;
  }
  return null;
}
async function levantarReimpressao() {
  const fila = filaLer();
  const itens = fila.map(f => ({ id: f.id, nota: 'descritivo de ' + (f.t ? hora(f.t) : '?') + (f.etiqueta ? ' · etiqueta já impressa' : ''), estado: 'ok', marcado: false }));
  return { tela: itens.length, totalTela: null, itens };
}
async function rodarReimprimir() {
  MODO = MODOS.reimprimir;
  caixaProgresso('Reimprimir descritivos: preparando'); log('Preparando a lista dos últimos descritivos...');
  if (estaNoDetalhe()) { botao('voltar').click(); await esperar(() => !estaNoDetalhe(), 15); }
  const dados = await levantarReimpressao();
  limparRaiz('ch-caixa');
  const r = await janelaLista({
    titulo: 'Reimprimir descritivos (sem faturar)', rotulo: '',
    subtitulo: 'Nada será faturado. Marque os pedidos cujo descritivo você quer imprimir de novo; cada um é aberto e só o botão "Imprimir Descritivo" é clicado.',
    tela: dados.tela, totalTela: null, itens: dados.itens, semConferenciaTela: true, permiteAdicionar: true, aPartirDaqui: true,
    infos: ['Lista = os pedidos dos descritivos das últimas 72 horas, na ordem em que saíram. Se o papel acabou no meio, use "daqui até o fim" no primeiro que não saiu. Pedidos que não estão na lista podem ser adicionados pelo número.', 'Confirme que a MP-4200 TH é a impressora padrão (o jeito mais seguro é abrir pelo botão "Reimprimir descritivos" da janela da Central no Windows) e que a impressora tem papel.'],
    verbo: n => 'Confirmar e reimprimir ' + n + ' descritivo(s)', aviso: 'Não fatura nada. Só imprime o descritivo de cada pedido marcado, na MP-4200 TH.',
    reler: async () => levantarReimpressao()
  });
  if (!r) { lancador(); return; }
  TODOS = true; rodando = true; parar = false; caixaProgresso('Reimprimir descritivos: imprimindo');
  const T0 = Date.now(); const ids = r.ids; const feitos = []; const falhas = [];
  try {
    for (let i = 0; i < ids.length && !parar; i++) {
      const id = ids[i];
      prog(feitos.length + falhas.length, ids.length, '#' + id, 'Reimprimir descritivos: imprimindo');
      log('Procurando #' + id + '...');
      const alvo = await buscarPedido(id);
      if (!alvo) { falhas.push(id); log('#' + id + ': não encontrei o pedido na busca do Hubii; pulei.'); continue; }
            if (!await abrirPedido(id, alvo)) { falhas.push(id); log('Não consegui abrir #' + id + '. Parando.'); break; }
      await sleep(1500);
      const imp = await esperar(() => { const b = botao('imprimir descritivo'); return b && !b.disabled ? b : null; }, 30);
      if (!imp) { falhas.push(id); log('#' + id + ': o botão "Imprimir Descritivo" não liberou (o pedido foi faturado?). Pulei.'); }
      else { imp.click(); feitos.push(id); regPed(id, { reimp: Date.now(), itens: lerItensTela() }); prog(feitos.length + falhas.length, ids.length, '#' + id); log('#' + id + ': descritivo enviado de novo.'); await sleep(5000); }
      const v = botao('voltar'); if (!v) { log('Botão Voltar não encontrado. Parando.'); break; }
      v.click(); await esperar(() => !estaNoDetalhe(), 15); await sleep(1500);
    }
  } catch (e) { console.error(e); log('Erro inesperado: ' + e.message); }
  try { const c = campoBuscaH(); if (c && c.value) setBuscaH(c, ''); } catch (e) {}
  TODOS = false; rodando = false;
  const dTot = Date.now() - T0;
  const completo = !parar && feitos.length + falhas.length >= ids.length;
  const rel = 'Descritivos reimpressos (' + feitos.length + '): ' + feitos.join(' ') + (falhas.length ? '\nNão reimpressos: ' + falhas.join(' ') : '');
  fimCaixa((completo ? 'Concluído: ' : 'Parou: ') + feitos.length + ' descritivo(s) reimpresso(s)' + (falhas.length ? '; ' + falhas.length + ' não reimpresso(s) (veja o relatório)' : '') + '. Nada foi faturado. Tempo: ' + durTxt(dTot) + '.', rel, { estado: completo && !falhas.length ? 'ok' : 'atencao', stats: [['Tempo total', durTxt(dTot)], ['Reimpressos', String(feitos.length)], ['Não reimpressos', String(falhas.length)]] });
}

/* ---------- Procurar pedido pelo produto (EAN) ---------- */
const K_PROD = 'hubii_produtos_leitura';
const prodLer = () => { const r = lerJson(K_PROD, {}); for (const k in r) if (!r[k] || Date.now() - r[k].t > 7 * 86400000) delete r[k]; return r; };
const soDig = s => String(s || '').replace(/\D/g, '');
const semZeros = s => s.replace(/^0+/, '');
const eanBate = (lista, ean) => (lista || []).some(e => e === ean || (e.length >= 8 && ean.length >= 8 && semZeros(e) === semZeros(ean)));
const textoDaPagina = () => [...document.body.children].filter(c => c !== raiz && !/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(c.tagName) && !c.closest('#central-hubii-raiz')).map(c => c.innerText || '').join('\n');
const eansDaTela = () => [...new Set([...textoDaPagina().matchAll(/EAN\s*:?\s*(\d{8,14})/gi)].map(m => m[1]))];
const badgeDespacho = () => { const b = abaDespacho(); const m = b && nt(txt(b)).match(/despacho\s+(\d+)/); return m ? parseInt(m[1], 10) : null; };
let buscandoProd = false;
function procurarProduto() {
  limparRaiz();
  const fundo = h('div', 'ch-fundo'); const jan = h('div', 'ch-janela');
  const topo = h('div', 'ch-topo'); topo.append(h('h2', null, 'Procurar pedido pelo produto'), h('p', null, 'Digite o EAN do produto. A busca olha todos os pedidos da aba Despacho e diz em quais deles o produto aparece.'));
  const corpo = h('div', 'ch-corpo'); const rod = h('div', 'ch-rodape');
  const inp = h('input', null, null, { type: 'text', placeholder: 'EAN (ex.: 7896181213147)' });
  inp.style.cssText = 'width:260px;padding:8px;border:1px solid #b9b2dc;border-radius:4px;color:#000;background:#fff;font-size:14px';
  const chkAtu = h('input', null, null, { type: 'checkbox' }); const labAtu = h('label'); labAtu.style.cssText = 'font-size:12.5px;cursor:pointer'; labAtu.append(chkAtu, document.createTextNode(' reler todos os pedidos (ignorar leitura guardada)'));
  const linha1 = h('div'); linha1.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px'; linha1.append(inp, labAtu);
  const st = h('div', 'ch-aviso ch-info', 'Pronto. Digite o EAN e clique em Buscar.');
  const res = h('div');
  corpo.append(linha1, st, res);
  const bBusca = h('button', 'ch-b', 'Buscar'); const bParar = h('button', 'ch-s', 'Parar'); bParar.style.display = 'none';
  const bCopia = h('button', 'ch-s', 'Copiar resultado'); bCopia.style.display = 'none';
  const bFecha = h('button', 'ch-s', 'Fechar');
  rod.append(bBusca, bParar, bCopia, bFecha);
  jan.append(topo, corpo, rod); fundo.appendChild(jan); raiz.appendChild(fundo);
  let pararBusca = false, ultimoTexto = '';
  const msg = (t, cls) => { st.className = 'ch-aviso ' + (cls || 'ch-info'); st.textContent = t; };
  bParar.onclick = () => { pararBusca = true; msg('Parada pedida: termino o pedido atual e mostro o que já li.'); };
  bFecha.onclick = () => { if (buscandoProd) { pararBusca = true; } limparRaiz(); lancador(); };
  bCopia.onclick = () => navigator.clipboard.writeText(ultimoTexto).then(() => { bCopia.textContent = 'Copiado'; setTimeout(() => { bCopia.textContent = 'Copiar resultado'; }, 1500); });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') bBusca.click(); });
  const mostrar = (ean, ids, cache, extra) => {
    res.innerHTML = '';
    const ach = ids.filter(id => cache[id] && eanBate(cache[id].eans, ean));
    const n = ach.length;
    const cab = n === 0 ? 'Nenhum pedido do Despacho tem o EAN ' + ean + ' (' + ids.length + ' pedidos conferidos).'
      : n + (n === 1 ? ' pedido foi encontrado' : ' pedidos foram encontrados') + ' com o EAN ' + ean + ', segue a lista abaixo:';
    const t = h('div', 'ch-aviso ' + (n ? 'ch-ok' : 'ch-erro'), cab); t.style.fontWeight = '600'; res.appendChild(t);
    let copia = cab;
    if (n) {
      const tb = h('table'); const th = h('tr'); ['Pedido', 'Todos os EANs do pedido'].forEach(x => th.appendChild(h('th', null, x))); tb.appendChild(th);
      ach.forEach(id => { const tr = h('tr'); tr.append(h('td', null, '#' + id), h('td', null, cache[id].eans.join(', '))); tb.appendChild(tr); copia += '\n#' + id + '  (' + cache[id].eans.join(', ') + ')'; });
      res.appendChild(tb);
    }
    (extra || []).forEach(x => { res.appendChild(h('div', 'ch-aviso ch-erro', x)); copia += '\n' + x; });
    ultimoTexto = copia; bCopia.style.display = '';
  };
  bBusca.onclick = async () => {
    if (buscandoProd) return;
    if (ocupado) { msg('Outra rotina está rodando nesta aba. Espere terminar.', 'ch-erro'); return; }
    const ean = soDig(inp.value);
    if (ean.length < 8) { msg('Digite o EAN completo (somente números, pelo menos 8 dígitos).', 'ch-erro'); return; }
    buscandoProd = true; ocupado = true; manterAcordado(); pararBusca = false; res.innerHTML = ''; bCopia.style.display = 'none';
    bBusca.disabled = true; bParar.style.display = '';
    const extra = [];
    try {
      msg('Preparando: aba Despacho...');
      if (estaNoDetalhe()) { botao('voltar').click(); await esperar(() => !estaNoDetalhe(), 15); }
      const ab = abaDespacho();
      if (!ab) { msg('Não achei a aba Despacho nesta tela. Abra a página de Pedidos do Hubii.', 'ch-erro'); return; }
      if (!abaAtiva(ab)) { ab.click(); await sleep(2500); }
      TODOS = true;
      await esperar(() => linhasBrutas().length > 0, 20); await sleep(800);
      // 1) lista de pedidos da aba Despacho: pelo servidor do Hubii (todos os status); senão, pela tela
      msg('Lendo a lista de pedidos da aba Despacho...');
      let ids, total; const api = await lerApi(null);
      if (api.ok) { ids = api.ids; total = api.total; }
      else {
        msg('Lendo a lista de pedidos pela tela (todas as páginas)...');
        ids = await varrerPaginas(); total = totalNaTela();
        extra.push('A lista veio da tela, página por página (o servidor do Hubii não respondeu: ' + api.motivo + '). Em dias com mais de 100 pedidos, alguns podem ter ficado de fora.');
      }
      if (!ids.length) { msg('Não li nenhum pedido na aba Despacho.', 'ch-erro'); return; }
      const badge = badgeDespacho();
      if ((total != null && total !== ids.length) || (badge != null && badge !== ids.length))
        extra.push('Atenção: li ' + ids.length + ' pedidos, mas ' + (total != null ? 'a lista indica ' + total : '') + (badge != null ? (total != null ? ' e ' : '') + 'a aba Despacho indica ' + badge : '') + '. Se houver filtro ativo (botão Filtros), limpe e busque de novo.');
      // 2) produtos: primeiro a leitura guardada e o Histórico de pedidos; só abre no Hubii os que faltam
      const cache = prodLer();
      let doHist = 0;
      if (!chkAtu.checked && window.__centralReg && window.__centralReg.eansDe) {
        const hist = await window.__centralReg.eansDe(ids.filter(id => !cache[id]));
        Object.keys(hist).forEach(id => { cache[id] = { eans: hist[id], t: Date.now() }; doHist++; });
        if (doHist) gravar(K_PROD, cache);
      }
      const falta = ids.filter(id => chkAtu.checked || !cache[id]);
      if (falta.length) msg((ids.length - falta.length) + ' pedido(s) já com produtos anotados' + (doHist ? ' (' + doHist + ' pelo Histórico)' : '') + '; abrindo ' + falta.length + ' no Hubii...');
      const semEan = [], falhou = [];
      for (let i = 0; i < falta.length && !pararBusca; i++) {
        const id = falta[i];
        msg('Lendo produtos: #' + id + ' (' + (i + 1) + ' de ' + falta.length + ')...' + (document.hidden ? ' Deixe esta aba à vista, sem trocar de aba.' : ''));
        const alvo = await acharPedido(id);
        if (!alvo) { falhou.push(id); continue; }
                if (!await abrirPedido(id, alvo)) { falhou.push(id); extra.push('Não consegui abrir #' + id + '. Parei a leitura.'); break; }
        await sleep(1500);
        let eans = eansDaTela();
        if (!eans.length) { await sleep(2000); eans = eansDaTela(); }
        if (eans.length) { cache[id] = { eans, t: Date.now() }; gravar(K_PROD, cache); regPed(id, { itens: lerItensTela() }); } else semEan.push(id);
        const v = botao('voltar'); if (!v) { extra.push('Botão Voltar não encontrado. Parei a leitura.'); break; }
        v.click(); await esperar(() => !estaNoDetalhe(), 15);
        await esperar(() => lerLista().length > 0, 20); await sleep(1200);
      }
      if (pararBusca) extra.push('Busca interrompida: o resultado abaixo considera só os pedidos já lidos.');
      if (falhou.length) extra.push('Pedidos que não apareceram na lista (não conferidos): ' + falhou.map(x => '#' + x).join(' '));
      if (semEan.length) extra.push('Pedidos sem EAN visível na tela (não conferidos): ' + semEan.map(x => '#' + x).join(' '));
      const lidos = ids.filter(id => cache[id]).length;
      mostrar(ean, ids, cache, extra);
      msg('Pronto. ' + lidos + ' de ' + ids.length + ' pedidos do Despacho conferidos. Pode digitar outro EAN: a leitura fica guardada e a próxima busca é bem mais rápida.', 'ch-ok');
    } catch (e) { console.error(e); msg('Erro: ' + e.message, 'ch-erro'); }
    finally { limparBusca(); TODOS = false; buscandoProd = false; ocupado = false; bBusca.disabled = false; bParar.style.display = 'none'; }
  };
  inp.focus();
}

/* ---------- dados para a conferência de despacho (conferir.js) ---------- */
window.__centralConfDados = {
  brs: brLer, vincular: brGuardar,
  impressasHoje: () => { const v = []; histLer().filter(x => x.dia === HOJE()).forEach(x => { if (!v.includes(x.id)) v.push(x.id); }); return v; },
  lerExpedicao: async () => {
    if (ocupado) throw new Error('Já há uma rotina rodando nesta aba. Espere terminar ou aperte F5.');
    ocupado = true; manterAcordado();
    try {
      MODO = MODOS.etiquetas;
      if (estaNoDetalhe()) { botao('voltar').click(); await esperar(() => !estaNoDetalhe(), 15); }
      if (!await prepararTela()) throw new Error('Não consegui deixar a tela em Despacho com o filtro "Esperando Expedição". Aplique à mão (Despacho > Filtros) e tente de novo.');
      await esperar(() => lerLista().length > 0, 20); await sleep(800);
      const lp = await lerPedidosDoStatus(); const ids = lp.ids;
      // conhecidos: memória dos descritivos + etiquetas impressas nos últimos 3 dias
      const lim = Date.now() - 3 * 864e5;
      await completarPelaBusca(ids, filaLer().map(x => x.id).concat(histLer().filter(x => !x.t || x.t >= lim).map(x => x.id)));
      return { ids, total: lp.total, fonte: fonteLista(), achados: achadosNaBusca.length };
    } finally { ocupado = false; }
  }
};

/* ---------- lançador e partida ---------- */
function iniciar(chave) {
  if (ocupado) { alert('Já há uma rotina rodando nesta aba. Aperte F5 para reiniciar.'); return; }
  ocupado = true; manterAcordado();
  const f0 = chave === 'etiquetas' ? rodarEtiquetas : chave === 'reimprimir' ? rodarReimprimir : chave === 'lerbr' ? rodarLerBR : rodarDescritivos;
  const f = () => espelhoPronto.then(() => f0());
  limparRaiz('ch-lanc');
  f().catch(e => { console.error(e); caixaProgresso(); fimCaixa('Erro inesperado: ' + e.message); }).finally(() => { ocupado = false; });
}
function lancador() {
  garantirRaiz(); limparRaiz('ch-lanc');
  const U = window.__centralUI; if (!U) return;
  const chamar = nome => () => { const f = window.__centralBM && window.__centralBM[nome]; if (!f) { alert('Esta rotina não carregou. Recarregue a página (F5).'); return; } f().catch(e => alert('Erro: ' + e.message)); };
  const usa = (g, nome) => () => { if (window[g]) window[g][nome](); else alert('Esta função não carregou. Recarregue a página (F5).'); };
  const l = U.lancador([
    { nome: 'Impressão', itens: [
      { nome: 'Imprimir descritivos', dica: 'Fatura e imprime na MP-4200 TH', icone: 'imprimir', f: () => iniciar('descritivos') },
      { nome: 'Imprimir etiquetas', dica: 'Na mesma ordem, na Argox', icone: 'etiqueta', f: () => iniciar('etiquetas') },
      { nome: 'Reimprimir descritivos', dica: 'Escolha os pedidos; não fatura nada', icone: 'imprimir', f: () => iniciar('reimprimir') },
      { nome: 'Ler códigos BR (sem imprimir)', dica: 'Recupera o BR dos pedidos sem memória', icone: 'etiqueta', f: () => iniciar('lerbr') },
      { nome: 'Conferir despacho (bipar)', dica: 'Bipe as etiquetas e veja o que falta', icone: 'conferir', f: usa('__centralConf', 'abrir') } ] },
    { nome: 'Pendências', itens: [
      { nome: 'Verificar pendências (Painel)', dica: 'Só leitura, não dá baixa', icone: 'conferir', f: chamar('verificar') },
      { nome: 'Planilha de pendências', dica: 'Gera o .xlsx com a confiabilidade', icone: 'planilha', f: usa('__centralPlan', 'abrir') },
      { nome: 'Procurar pedido pelo produto', dica: 'Digite o EAN', icone: 'buscar', f: () => { if (ocupado) { alert('Já há uma rotina rodando nesta aba. Aperte F5 para reiniciar.'); return; } procurarProduto(); } } ] },
    { nome: 'Acompanhamento', itens: [
      { nome: 'Relatório de desempenho', dica: 'Tempo poupado, fechamento do mês', icone: 'grafico', f: () => { if (window.__centralReg) window.__centralReg.abrirRelatorio(); else alert('O relatório não carregou. Recarregue a página (F5).'); } },
      { nome: 'Suporte', dica: 'Copia um relatório sem dados de clientes', icone: 'ajuda', f: usa('__centralSup', 'abrir') } ] }
  ]);
  raiz.appendChild(l);
}
try {
  const p = new URLSearchParams(location.search).get('central');
  if (p && MODOS[p]) {
    sessionStorage.setItem(K_INT, JSON.stringify({ modo: p, t: Date.now() }));
    const u = new URL(location.href); u.searchParams.delete('central'); history.replaceState(null, '', u.pathname + u.search + u.hash);
  }
} catch (e) {}
// Preenche o histórico com o que a Central já sabia antes da 2.12 (últimos 14 dias): hora do descritivo (memória das
// etiquetas), etiquetas impressas, códigos BR e a conferência guardada. Não lê produtos (isso só com o pedido aberto).
// Pode rodar sempre: só grava o que estiver faltando.
const migrarHistorico = () => {
  try {
    if (!window.__centralReg || !window.__centralReg.pedido) return;
    const P = window.__centralReg.pedido;
    filaLer().forEach(x => { if (x && x.id && x.t) P(x.id, { desc: x.t }); });
    histLer().forEach(x => { if (x && x.id && x.t) P(x.id, { etq: x.t }); });
    const b = brLer(); Object.keys(b).forEach(id => P(id, { br: b[id].br }));
    const S = lerJson('hubii_conferencia', null);
    if (S && S.conf && S.t0 > Date.now() - MS14) Object.keys(S.conf).forEach(id => { const c = S.conf[id]; if (c && c.t) P(id, { conf: c.t }); });
  } catch (e) {}
};
const pronto = async () => {
  setTimeout(migrarHistorico, 4000);
  garantirRaiz(); lancador();
  let it = null; try { it = JSON.parse(sessionStorage.getItem(K_INT) || 'null'); } catch (e) {}
  if (!it || Date.now() - it.t > 10 * 60000 || !MODOS[it.modo]) return;
  sessionStorage.removeItem(K_INT);
  const ok = await esperar(() => botaoFiltros() || abaDespacho(), 60);
  if (!ok) { caixaProgresso(); fimCaixa('A página de pedidos não carregou (talvez falte entrar no Hubii). Entre e clique em "Central Hubii" no canto inferior esquerdo.'); return; }
  await sleep(1500);
  iniciar(it.modo);
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pronto); else pronto();
})();
