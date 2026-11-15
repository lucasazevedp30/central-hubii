(() => {
window.__centralBM = window.__centralBM || {};
window.__centralBM.verificar = async () => {
if (window.__pendPainel && document.body.contains(window.__pendPainel)) { window.__pendPainel.style.display = 'block'; return; }
const CH_ENTRADA = 'hubii_pend_entrada';
const CH_RES = 'hubii_pend_resultados';
const ROTULOS = ['Coleta', 'Despacho', 'Entrega própria', 'Em trânsito', 'Finalizados'];
const STATUS_RE = /^(Em Tr[âa]nsito|Entregue.*|Cancelad[oa].*|Devolvid[oa].*|Coletad[oa]|Despachad[oa]|Finalizad[oa]|Esperando .+|Aguardando .+|Etiqueta .+|Extraviad[oa].*|Problema.*)$/i;
let relogio = null;
const esperaPend = {};
let seqRel = 0;
try {
relogio = new Worker(URL.createObjectURL(new Blob(['onmessage=function(e){var d=e.data;setTimeout(function(){postMessage(d.id)},d.ms)}'], { type: 'text/javascript' })));
relogio.onmessage = e => { const f = esperaPend[e.data]; if (f) { delete esperaPend[e.data]; f(); } };
relogio.onerror = () => { relogio = null; };
} catch (e) { relogio = null; }
const sleep = ms => new Promise(r => {
if (!relogio) { setTimeout(r, ms); return; }
const id = ++seqRel;
esperaPend[id] = r;
relogio.postMessage({ id, ms });
setTimeout(() => { if (esperaPend[id]) { delete esperaPend[id]; r(); } }, ms + 4000);
});
function manterAcordado() {
try { if (navigator.locks && navigator.locks.request) navigator.locks.request('hubii-pend', () => new Promise(() => {})); } catch (e) {}
try {
const AC = window.AudioContext || window.webkitAudioContext;
const ac = new AC();
const osc = ac.createOscillator();
const gan = ac.createGain();
gan.gain.value = 0.002;
osc.frequency.value = 30;
osc.connect(gan); gan.connect(ac.destination);
osc.start();
if (ac.resume) ac.resume();
window.__acordadoAudio = ac;
} catch (e) {}
try {
Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
document.hasFocus = () => true;
['visibilitychange', 'webkitvisibilitychange', 'blur', 'pagehide', 'freeze'].forEach(t => { document.addEventListener(t, e => e.stopImmediatePropagation(), true); window.addEventListener(t, e => e.stopImmediatePropagation(), true); });
} catch (e) {}
try {
if (!window.__monAtivo) {
window.__monAtivo = true;
(async () => {
for (;;) {
const t0 = performance.now();
await new Promise(r => setTimeout(r, 1000));
const d = (performance.now() - t0 - 1000) / 1000;
if (typeof statusBg !== 'undefined' && statusBg) { statusBg.textContent = d > 1.5 ? 'Segundo plano LIMITADO pelo Chrome (atraso de ' + Math.round(d) + 's). Abra o Chrome pelo Pendencias.bat e deixe os sites "sempre ativos" (Chrome > Desempenho).' : 'Segundo plano: normal'; statusBg.style.color = d > 1.5 ? '#a3261b' : '#0b6a2a'; }
}
})();
}
} catch (e) {}
}
const qs = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const limpaNome = s => { let t = String(s || '').replace(/\(?\s*hubi+\s*\)?/gi, ' ').replace(/\s+/g, ' ').trim(); if (/(\.{2,}|…)\s*$/.test(t)) { t = t.replace(/\s*(\.{2,}|…)\s*$/, '').trim(); const w = t.split(' '); if (w.length > 2) w.pop(); t = w.join(' '); } return t; };
const norm = s => semAcento(s).toLowerCase().replace(/\s+/g, ' ').trim();
const dinheiro = s => {
const t = String(s == null ? '' : s).replace(/R\$/g, '').trim();
const m = t.match(/\d[\d.]*,\d{2}|\d+\.\d{2}$/);
if (!m) return null;
const v = m[0].includes(',') ? m[0].replace(/\./g, '').replace(',', '.') : m[0];
const n = parseFloat(v);
return isNaN(n) ? null : n;
};
const fmt = v => (v == null ? '' : 'R$ ' + v.toFixed(2).replace('.', ','));
const DATA_RE = /(\d{2})\/(\d{2})\/(\d{2,4})/;
const hojeUTC = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
const fmtData = t => { const d = new Date(t); return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear(); };
const lerData = s => {
const txt = String(s || '');
const m = txt.match(DATA_RE);
if (m) {
const a = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
return { txt: m[1] + '/' + m[2] + '/' + a, t: Date.UTC(a, parseInt(m[2], 10) - 1, parseInt(m[1], 10)) };
}
const r = txt.match(/(\d+)\s*dias?\s*atr[aá]s/i);
if (r) { const t = hojeUTC() - parseInt(r[1], 10) * 86400000; return { txt: fmtData(t), t, aprox: true }; }
if (/\bontem\b/i.test(txt)) { const t = hojeUTC() - 86400000; return { txt: fmtData(t), t, aprox: true }; }
if (/\bhoje\b|\d+\s*(horas?|minutos?|min)\s*atr[aá]s/i.test(txt)) { const t = hojeUTC(); return { txt: fmtData(t), t, aprox: true }; }
return null;
};
const PREP = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
const palavras = s => norm(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length > 1 && !PREP.has(w));
const nomeParecido = (a, b) => {
const x = palavras(a), y = palavras(b);
if (!x.length || !y.length) return false;
if (x.join(' ') === y.join(' ')) return true;
if (x[0] === y[0] && x[x.length - 1] === y[y.length - 1]) return true;
const [c, l] = x.length <= y.length ? [x, y] : [y, x];
const com = c.filter(w => l.includes(w)).length;
return com === c.length || (c.length >= 2 && com / c.length >= 0.75);
};
const enderecoParecido = (a, b) => {
const ca = (String(a).match(/\b\d{5}-?\d{3}\b/) || [''])[0].replace('-', '');
const cb = (String(b).match(/\b\d{5}-?\d{3}\b/) || [''])[0].replace('-', '');
if (ca && cb) return ca === cb;
const x = palavras(a).filter(w => w.length > 2), y = palavras(b).filter(w => w.length > 2);
if (!x.length || !y.length) return false;
const c = x.length <= y.length ? x : y, l = x.length <= y.length ? y : x;
return c.filter(w => l.includes(w)).length / c.length >= 0.6;
};
const ocultoReal = () => { try { return Object.getOwnPropertyDescriptor(Document.prototype, 'hidden').get.call(document); } catch (e) { return document.hidden; } };
// com a aba escondida o Chrome pausa as animações da página: o tempo de espera não corre até a aba voltar (limite de 30 min)
const esperar = async (fn, seg = 30) => {
let oculto = 0;
for (let i = 0; i < seg * 2; i++) { const r = fn(); if (r) return r; if (ocultoReal() && oculto < 3600) { oculto++; i--; } await sleep(500); }
return null;
};
const lerJSON = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } };
let painel = null;
const fora = e => !(painel && painel.contains && painel.contains(e));
const h = (tag, a = {}, ...kids) => {
const e = document.createElement(tag);
for (const k in a) { if (k === 'style') e.style.cssText = a[k]; else e[k] = a[k]; }
kids.forEach(c => e.appendChild(c));
return e;
};
function arrastar(box, alca, ignora) {
let ox = 0, oy = 0, mov = false;
try {
const ini = e => {
if (e.button != null && e.button !== 0) return;
if (ignora && ignora(e.target)) return;
mov = true;
const r = box.getBoundingClientRect();
ox = e.clientX - r.left; oy = e.clientY - r.top;
box.style.left = r.left + 'px'; box.style.top = r.top + 'px'; box.style.right = 'auto'; box.style.bottom = 'auto';
e.preventDefault();
};
const mv = e => {
if (!mov) return;
box.style.left = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - ox)) + 'px';
box.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - oy)) + 'px';
};
const fim = () => { mov = false; };
alca.style.cursor = 'move';
alca.style.touchAction = 'none';
alca.addEventListener('pointerdown', ini);
window.addEventListener('pointermove', mv, true);
window.addEventListener('pointerup', fim, true);
window.addEventListener('blur', fim);
} catch (e) {}
}
const naoArrasta = el => { try { return !!(el && el.closest && el.closest('button,textarea,input,select,label,table,a')); } catch (e) { return false; } };
function prepararPainel(box) {
const kids = [...box.children];
const titulo = kids[0];
const corpo = h('div');
kids.slice(1).forEach(k => corpo.appendChild(k));
box.textContent = '';
titulo.style.margin = '0';
titulo.style.flex = '1';
const mini = (t, dica, f) => h('button', { textContent: t, title: dica, onclick: f, style: 'margin-left:4px;padding:0 9px;height:28px;cursor:pointer;border-radius:8px;font-size:14px;font-weight:700;background:#eee9fb;border:1px solid #b9b2dc;color:#3a1f6d' });
const canto = (esq, topo) => () => {
box.style.left = esq ? '12px' : 'auto'; box.style.right = esq ? 'auto' : '12px';
box.style.top = topo ? '12px' : 'auto'; box.style.bottom = topo ? 'auto' : '12px';
};
let aberto = true;
const bMin = mini('–', 'Recolher / expandir', () => { aberto = !aberto; corpo.style.display = aberto ? 'block' : 'none'; bMin.textContent = aberto ? '–' : '+'; });
let opaco = true;
const bOp = mini('◐', 'Deixar o painel transparente / normal', () => { opaco = !opaco; box.style.opacity = opaco ? '1' : '0.5'; });
const barra = h('div', { style: 'display:flex;align-items:center;user-select:none;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #ddd8f2' }, titulo,
mini('↖', 'Mover para o canto superior esquerdo', canto(true, true)), mini('↗', 'Mover para o canto superior direito', canto(false, true)),
mini('↙', 'Mover para o canto inferior esquerdo', canto(true, false)), mini('↘', 'Mover para o canto inferior direito', canto(false, false)), bOp, bMin);
box.style.resize = 'both';
box.style.minWidth = '360px';
box.appendChild(barra);
box.appendChild(corpo);
arrastar(box, box, naoArrasta);
}
const textoPagina = () => document.body.innerText || '';
const textoLimpo = () => { const d = painel ? painel.style.display : ''; try { if (painel) painel.style.display = 'none'; return document.body.innerText || ''; } finally { if (painel) painel.style.display = d; } };
const botao = txt => qsa('button').find(b => fora(b) && b.textContent.trim().toLowerCase().includes(txt));
const idDetalhe = () => (textoPagina().match(/Pedido\s*#(\d+)/) || [])[1];
const noDetalhe = id => !!botao('voltar') && (id ? idDetalhe() === id : !!idDetalhe());
const campoBusca = () => qs('input[placeholder*="uscar"]');
function abas() {
const out = {};
const els = qsa('button, [role="tab"], a, div, span').filter(fora);
for (const rot of ROTULOS) {
const re = new RegExp('^' + rot + '\\s*(\\d+\\+?)?$', 'i');
const m = els.filter(e => re.test((e.textContent || '').replace(/\s+/g, ' ').trim()));
if (!m.length) continue;
const el = m.find(e => e.tagName === 'BUTTON' || (e.getAttribute && e.getAttribute('role') === 'tab')) || m[0];
const mm = (el.textContent || '').replace(/\s+/g, ' ').trim().match(/(\d+)\+?$/);
out[rot] = { el, n: mm ? parseInt(mm[1], 10) : null };
}
return out;
}
const lerIds = () => qsa('body *').filter(e => fora(e) && e.children.length === 0 && /^\d{7,}$/.test((e.textContent || '').trim()))
.map(e => ({ id: e.textContent.trim(), el: e }));
function linhas() {
return lerIds().map(({ id, el }) => {
let n = el;
while (n.parentElement && n.parentElement !== document.body) {
const p = n.parentElement;
const t = p.innerText || '';
const ids = new Set(t.match(/\b\d{7,}\b/g) || []);
if (ids.size > 1 || t.split('\n').length > 10 || /Aceito em/i.test(t)) break;
n = p;
}
const ls = (n.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
const txtl = ls.join(' ');
const dt = lerData((txtl.match(/Aceito em[^\d]{0,12}(\d{2}\/\d{2}\/\d{2,4})/i) || [])[1]) || lerData(txtl);
const stTxt = (txtl.match(/Esperando NFe do Hub|Esperando Expedi[cç][aã]o|Esperando etiqueta[^|\t\n]*|Etiqueta Hub n[aã]o baixou|Aguardando andamento|Aguardando Resposta|Em Tr[aâ]nsito|Entregue|Cancelad[oa]|Extraviad[oa]|Devolvid[oa]/i) || [''])[0];
return { id, el, status: ls.find(s => STATUS_RE.test(s)) || stTxt, bruto: ls.join(' | '), dataH: dt ? dt.txt : '' };
});
}
const snap = () => { const a = abas(); return ROTULOS.map(r => (a[r] ? a[r].n : '-')).join('|') + '#' + linhas().map(l => l.id).join(','); };
async function estavel(min = 1500, max = 24) {
await sleep(min);
let ult = snap(), igual = 0;
for (let i = 0; i < max && igual < 3; i++) { await sleep(400); const s = snap(); if (s === ult) igual++; else { igual = 0; ult = s; } }
}
async function achaBusca() {
let c = campoBusca();
if (!c && noDetalhe()) { await voltar(); c = campoBusca(); }
if (!c) c = await esperar(campoBusca, 15);
if (!c) throw new Error('não achei a caixa de busca (a tela mudou ou saiu da lista de Pedidos)');
return c;
}
function setBusca(c, v) {
const proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
const d = proto && Object.getOwnPropertyDescriptor(proto, 'value');
if (c.focus) c.focus();
if (d && d.set) d.set.call(c, v); else c.value = v;
c.dispatchEvent(new Event('input', { bubbles: true }));
c.dispatchEvent(new Event('change', { bubbles: true }));
}
async function aplicarBusca(termo, limpar = true) {
const c = await achaBusca();
if (limpar && c.value) {
setBusca(c, '');
await sleep(1800);
await estavel(600);
}
const antes = snap();
setBusca(c, termo);
await sleep(2200);
if (snap() === antes) {
['keydown', 'keypress', 'keyup'].forEach(t => c.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })));
await sleep(1500);
}
await estavel(600);
}
async function abrirAba(rot) {
const a = abas()[rot];
if (!a) return false;
a.el.click();
await estavel(1000);
return true;
}
async function voltar() {
const b = botao('voltar');
if (b) b.click();
await esperar(() => !noDetalhe(), 15);
await sleep(900);
}
async function garantirLista(termo, aba) {
if (noDetalhe()) await voltar();
const c = await achaBusca();
if (norm(c.value) !== norm(termo)) await aplicarBusca(termo);
await abrirAba(aba);
}
const classificar = (st, aba) => {
const s = norm(st);
if (/cancel/.test(s)) return 'cancelado';
if (/entregue/.test(s)) return 'entregue';
if (/transito/.test(s)) return 'transito';
if (/devol/.test(s)) return 'devolvido';
if (/extravi/.test(s)) return 'extraviado';
if (/esperando expedicao/.test(s)) return 'expedicao';
if (!s && aba === 'Em trânsito') return 'transito';
return 'outro';
};
const NOMES = { transito: 'Em trânsito', cancelado: 'Cancelado', entregue: 'Entregue', devolvido: 'Devolvido', extraviado: 'Extraviado', expedicao: 'Despacho' };
const nomeStatus = x => NOMES[x.classe] || x.status || ('Status não lido (' + x.aba + ')');
let ultimaAssin = '', ultimoTermo = '';
async function coletarHits(termo) {
await aplicarBusca(termo);
const ab = abas();
const hits = [];
const vistos = new Set();
for (const rot of ROTULOS) {
if (!ab[rot] || ab[rot].n === 0) continue;
await abrirAba(rot);
for (const l of linhas()) {
if (vistos.has(l.id)) continue;
vistos.add(l.id);
hits.push({ id: l.id, aba: rot, status: l.status, bruto: l.bruto, dataH: l.dataH, classe: classificar(l.status, rot) });
}
}
return hits;
}
async function buscarHits(termo) {
let hits = await coletarHits(termo);
let assin = hits.map(x => x.id).sort().join(',');
if (assin && assin === ultimaAssin && norm(termo) !== norm(ultimoTermo) && !norm(termo).includes(norm(ultimoTermo)) && !norm(ultimoTermo).includes(norm(termo))) {
const c = await achaBusca();
setBusca(c, '');
await sleep(2500);
await estavel(800);
hits = await coletarHits(termo);
assin = hits.map(x => x.id).sort().join(',');
}
ultimaAssin = assin;
ultimoTermo = termo;
return { hits, termo };
}
const achar = re => qsa('body *').find(e => fora(e) && e.children.length === 0 && re.test((e.textContent || '').trim()));
const textoModal = () => { const d = qs('[role="dialog"]'); return d ? (d.innerText || '') : textoPagina(); };
const ultimo = (t, re) => { const m = [...t.matchAll(re)]; return m.length ? m[m.length - 1] : null; };
function lerModal() {
const t = textoModal();
const v = ultimo(t, /Valor Total\s*R\$\s*([\d.]*\d,\d{2})/gi);
const cpf = ultimo(t, /CPF\s*([\d.\-\/]{11,18})/gi);
const cli = ultimo(t, /Cliente\s+([^\n\t]+)/gi);
const en = ultimo(t, /Endere[cç]o\s*:?\s*([^\n]+(?:\n(?![A-ZÀ-Ý\/ ]{3,}:)[^\n]+){0,2})/gi);
const cep = ultimo(t, /\b(\d{5}-?\d{3})\b/g);
const end = ((en ? en[1] : '') + ' ' + (cep && !(en && en[1].includes(cep[1])) ? cep[1] : '')).replace(/\s+/g, ' ').trim().slice(0, 160);
const fr = ultimo(t, /Frete\s*R\$\s*([\d.]*\d,\d{2})/gi), ds = ultimo(t, /Desconto\s*R\$\s*([\d.]*\d,\d{2})/gi);
return { frete: fr ? dinheiro(fr[1]) : null, desconto: ds ? dinheiro(ds[1]) : null, valor: v ? dinheiro(v[1]) : null, cpf: cpf ? cpf[1] : '', cliente: cli ? cli[1].trim() : '', endereco: end };
}
async function fecharModal() {
for (let t = 0; t < 3; t++) {
if (!/Valor Total/i.test(textoModal())) return true;
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
await sleep(700);
if (!/Valor Total/i.test(textoModal())) return true;
const d = qs('[role="dialog"]');
const fx = d && [...d.querySelectorAll('button')].find(b => /fechar|close/i.test(b.getAttribute('aria-label') || '') || !b.textContent.trim());
if (fx) fx.click();
await sleep(700);
}
return !/Valor Total/i.test(textoModal());
}
// Valores que podem aparecer na pendência do OnePet para um pedido do Hubii:
// o Valor Total, os valores da tela do pedido e o Valor Total com o frete ou o desconto tirados ou somados
// (ex.: Hubii R$ 128,79 com frete R$ 9,90 e pendência R$ 118,89).
const ajustes = d => { const out = []; if (!d || d.valor == null) return out; [d.frete, d.desconto].forEach(a => { if (a != null && a > 0.004) { out.push(Math.round((d.valor - a) * 100) / 100, Math.round((d.valor + a) * 100) / 100); } }); return out; };
const aceitos = d => !d ? [] : [d.valor].concat(d.extras || [], ajustes(d));
const viaFrete = (d, tot) => tot != null && d && d.valor != null && Math.abs(d.valor - tot) >= 0.015 && !(d.extras || []).some(v => Math.abs(v - tot) < 0.015) && ajustes(d).some(v => Math.abs(v - tot) < 0.015);
async function lerDados(termo, hit) {
await garantirLista(termo, hit.aba);
const alvo = lerIds().find(x => x.id === hit.id);
if (!alvo) return { erro: 'pedido não apareceu na lista' };
alvo.el.click();
if (!await esperar(() => noDetalhe(hit.id), 15)) return { erro: 'não consegui abrir o pedido' };
await sleep(1200);
const dpag = lerData((textoLimpo().match(/Aceito em[^\d]{0,12}(\d{2}\/\d{2}\/\d{2,4})/i) || [])[1]);
const tp = textoLimpo();
const extras = [...new Set([...tp.matchAll(/R\$\s*([\d.]*\d,\d{2})/g)].map(m => dinheiro(m[1])).filter(v => v != null))].slice(0, 60);
const eans = [...new Set([...tp.matchAll(/EAN\s*:?\s*(\d{8,14})/gi)].map(m => m[1]))];
let d = { erro: 'o pedido não tem "Visualizar dados"' };
try {
const lk = await esperar(() => achar(/^visualizar dados/i), 8);
if (lk) {
lk.click();
if (await esperar(() => /Valor Total/i.test(textoModal()), 10)) {
d = lerModal();
if (d.valor == null) d.erro = 'não consegui ler o valor';
} else d = { erro: 'a janela de dados não abriu' };
}
} catch (e) {
d = { erro: e.message };
} finally {
try { await fecharModal(); } catch (e) {}
await voltar();
}
if (dpag) d.data = dpag.txt;
d.extras = extras;
d.eans = eans;
if (d.valor == null && extras.length) { d.valor = extras[extras.length - 1]; delete d.erro; }
return d;
}
let res = lerJSON(CH_RES, {});
let rodando = false;
let parar = false;
const msg = h('div', { style: 'margin:6px 0;font-size:12px;white-space:pre-wrap' });
const ALERTA = '\n⚠ Esta aba está em segundo plano: pode ficar lenta ou parar. Deixe esta janela aberta (pode ficar atrás de outras ou ao lado), sem minimizar e sem trocar de aba.';
const aviso = t => { msg.textContent = t + (document.hidden && /^(Verificando|Consultando|Página|Voltando|Buscando|Lendo)/.test(t) ? ALERTA : ''); };
const salvar = () => localStorage.setItem(CH_RES, JSON.stringify(res));
const autoriza = x => x.classe === 'transito' || x.classe === 'extraviado' || (x.classe === 'expedicao' && chkExp.checked) || (x.classe === 'entregue' && chkEntregue.checked);
const guardar = (p, c) => {
res[p.chave] = Object.assign({ chave: p.chave, codigo: p.codigo, cliente: p.nome, total: p.total, data: p.data, ver: 2 }, c);
const r0 = res[p.chave];
if (!r0.acao) r0.acao = r0.aut === 'Sim' ? 'Dar baixa' : /cancel/i.test(r0.status || '') ? 'Não dar baixa (cancelado)' : r0.status === 'Não localizado' ? 'Consultar no OneHub' : 'Aguardar';
salvar();
return res[p.chave];
};
function parseEntrada(txt) {
const out = [];
String(txt).split(/\r?\n/).forEach((ln, i) => {
if (!ln.trim()) return;
const f = ln.split('\t').map(s => s.trim());
let codigo = '', nome = '', total = null, data = '';
let endereco = '', pedidoOH = '', eans = [], cpf = '';
if (f.length >= 2 && /^\d{6,}$/.test(f[0])) { codigo = f[0]; nome = limpaNome(f[1]); total = dinheiro(f[2]); data = f[3] || ''; endereco = f[4] || ''; pedidoOH = /^\d{7,}$/.test(f[5] || '') ? f[5] : ''; eans = (f[6] || '').match(/\d{8,14}/g) || []; cpf = (f[7] || '').replace(/\D/g, ''); }
else { nome = limpaNome(f[0]); total = dinheiro(f[1]); }
if (!nome || /^(c[oó]digo|cliente)$/i.test(nome)) return;
out.push({ codigo, nome, total, data, endereco, pedidoOH, eans, cpf, chave: codigo ? 'c' + codigo : 'n:' + norm(nome) + '#' + i });
});
return out;
}
async function processarGrupo(g) {
if (noDetalhe()) await voltar();
let r = await buscarHits(g.porNumero ? g.numero : g.nome);
if (!g.porNumero && !r.hits.length && semAcento(g.nome) !== g.nome) r = await buscarHits(semAcento(g.nome));
if (g.porNumero) r.hits = r.hits.filter(x => x.id === g.numero);
const { hits, termo } = r;
if (g.porNumero && !hits.length) {
g.itens.forEach(p => guardar(p, { pedido: g.numero, status: 'Invisível no Painel Hubii', aut: 'Não', acao: 'Cancelar', dataH: '', verif: 'O pedido ' + g.numero + ' (OneHub) não existe no Painel Hubii', obs: 'Pedido invisível: cancelar a pendência' }));
return;
}
if (!hits.length) {
g.itens.forEach(p => guardar(p, { pedido: '', status: 'Não localizado', aut: 'Não', dataH: '', verif: 'Sem resultado pelo nome', obs: 'Pode ser pedido invisível (só existe no OneHub): use "Copiar não localizados" e o favorito Consultar OneHub' }));
return;
}
const conferir = chkValor.checked;
const LIMITE_DIAS = 10 * 86400000;
const perto = (p, x, d) => {
const dp = lerData(p.data), dx = lerData(x.dataH || (d && d.data));
return !dp || !dx || Math.abs(dp.t - dx.t) <= LIMITE_DIAS;
};
const dados = {};
const difMin = x => Math.min(...g.itens.map(p => { const dp = lerData(p.data), dx = lerData(x.dataH); return dp && dx ? Math.abs(dp.t - dx.t) : 9e15; }));
const ordem = hits.slice().sort((a, b) => difMin(a) - difMin(b));
const CAP = 6 + 3 * g.itens.length;
let abertos = 0, cortou = false;
for (const x of ordem) {
if (parar) break;
if (abertos >= CAP) { if (conferir && g.itens.some(p => perto(p, x))) cortou = true; continue; }
const abrir = conferir && g.itens.some(p => perto(p, x)) && (hits.length > 1 || g.itens.length > 1 || x.classe === 'transito' || x.classe === 'extraviado' || x.classe === 'expedicao' || x.classe === 'entregue');
if (abrir) { abertos++; dados[x.id] = await lerDados(termo, x).catch(e => ({ erro: e.message })); }
}
const dv = x => (dados[x.id] ? dados[x.id].valor : null);
const bate = (x, tot) => tot != null && !!dados[x.id] && aceitos(dados[x.id]).some(v => v != null && Math.abs(v - tot) < 0.015);
const desc = x => x.id + ' (' + nomeStatus(x) + (dv(x) != null ? ', ' + fmt(dv(x)) : '') + ')';
const lst = arr => arr.slice(0, 5).map(desc).join('; ') + (arr.length > 5 ? ' e mais ' + (arr.length - 5) : '');
const livres = hits.slice();
const feitos = [];
for (const p of g.itens) {
const lp = livres.filter(x => perto(p, x, dados[x.id]));
const cand = p.total == null ? [] : lp.filter(x => bate(x, p.total));
const dif = x => { const dp = lerData(p.data), dx = lerData(x.dataH || (dados[x.id] || {}).data); return dp && dx ? Math.abs(dp.t - dx.t) : Infinity; };
let esc = null, verif = '', obs = '';
if (cand.length > 1) {
const o = cand.slice().sort((a, b) => dif(a) - dif(b));
if (dif(o[0]) <= 3 * 86400000 && dif(o[1]) > 3 * 86400000) esc = o[0];
}
if (esc) {
} else if (cand.length === 1) {
esc = cand[0];
} else if (cand.length > 1) {
verif = 'Mais de um pedido com o mesmo valor e data próxima'; obs = lst(cand);
} else if (lp.length === 1 && g.itens.length === 1 && (p.total == null || dv(lp[0]) == null)) {
esc = lp[0];
} else if (g.porNumero && livres.length) {
esc = livres[0];
} else {
verif = !livres.length ? 'Sem pedido restante para este nome' : !lp.length ? 'Nenhum pedido deste nome perto da data da pendência' : 'Valor não confere';
obs = lst(lp) + (p.total != null && lp.length ? '; valor da pendência ' + fmt(p.total) + ' x valor no Hubii ' + lp.map(x => dv(x) != null ? fmt(dv(x)) : 'não lido').join(' / ') : '');
}
let sinais = [], dataH = '', endH = '', eanH = '', veto = false;
if (esc) {
const d0 = dados[esc.id] || {};
const dt = lerData(esc.dataH || d0.data);
const dp = lerData(p.data);
dataH = dt ? dt.txt : '';
endH = d0.endereco || '';
eanH = (d0.eans || []).join(', ');
const falta = [], dif = [];
const marca = (nomeC, estado) => { if (estado === true) sinais.push(nomeC); else if (estado === false) dif.push(nomeC); else falta.push(nomeC); };
if (g.porNumero) sinais.push('nº do pedido');
marca('valor', p.total != null && (dv(esc) != null || (d0.extras || []).length) ? bate(esc, p.total) : null);
marca('data', dp && dt ? Math.abs(dp.t - dt.t) <= 3 * 86400000 : null);
marca('produto', (p.eans || []).length && (d0.eans || []).length ? p.eans.some(e => d0.eans.includes(e)) : null);
marca('endereço', p.endereco && endH ? enderecoParecido(p.endereco, endH) : null);
const nomeH0 = d0.cliente;
marca('nome', nomeH0 ? nomeParecido(p.nome, nomeH0) : (!g.porNumero && (palavras(p.nome).every(w => norm(esc.bruto).includes(w)) || palavras(termo).length >= 2) ? true : null));
if (p.cpf && d0.cpf) { if (p.cpf === String(d0.cpf).replace(/\D/g, '')) sinais.push('CPF'); else obs += (obs ? '; ' : '') + 'CPF difere (pode ser compra para outra pessoa)'; }
veto = dif.includes('produto');
verif = (sinais.length ? 'Confirmado (' + sinais.length + '): ' + sinais.join(' + ') : 'Nenhuma confirmação') + (dif.length ? ' | Diverge: ' + dif.join(', ') : '') + (falta.length ? ' | Sem dado: ' + falta.join(', ') : '') + (sinais.length < 3 ? ' | precisa de 3 confirmações' : '') + (veto ? ' | PRODUTO DIFERENTE' : '');
if (viaFrete(d0, p.total)) obs += (obs ? '; ' : '') + 'Valor confere descontando o frete/desconto do Hubii (Valor Total ' + fmt(d0.valor) + (d0.frete ? ', frete ' + fmt(d0.frete) : '') + (d0.desconto ? ', desconto ' + fmt(d0.desconto) : '') + '; pendência ' + fmt(p.total) + ')';
if (conferir && p.total != null && dv(esc) == null && !(d0.extras || []).length) obs += (obs ? '; ' : '') + 'Valor não lido (' + (d0.erro || 'pedido não aberto') + ')';
if (!conferir) obs += (obs ? '; ' : '') + 'Pedido não aberto (modo rápido): menos confirmações';
if (dp && dt && dif.includes('data')) obs += (obs ? '; ' : '') + 'Data difere: pendência ' + dp.txt + ', Hubii ' + dt.txt;
if (dif.includes('endereço')) obs += (obs ? '; ' : '') + 'Endereço difere: Hubii ' + endH;
}
if (cortou) obs += (obs ? '; ' : '') + 'Nome com muitos pedidos (' + hits.length + '): só abri os ' + CAP + ' mais próximos da data';
if (esc) livres.splice(livres.indexOf(esc), 1);
const nomeH = esc && dados[esc.id] && dados[esc.id].cliente;
if (nomeH && norm(nomeH) !== norm(p.nome)) obs += (obs ? '; ' : '') + (g.porNumero ? 'Nome diferente no Painel: ' + nomeH + ' (mesmo nº do pedido, então é o mesmo pedido; comprador e destinatário podem ser pessoas diferentes)' : 'Nome no Hubii: ' + nomeH);
if (esc && esc.classe === 'expedicao') obs = 'Esperando Expedição (conta como OK para dar baixa)' + (obs ? '; ' + obs : '');
feitos.push(guardar(p, {
pedido: esc ? esc.id : '',
status: esc ? nomeStatus(esc) : 'A conferir',
aut: esc && autoriza(esc) && sinais.length >= 3 && !veto ? 'Sim' : 'Não',
eanH,
dataH, endH, sinais: sinais.join(' + '),
verif, obs,
classe: esc ? esc.classe : '',
}));
}
if (livres.length) {
feitos.forEach(f => {
const novos = livres.filter(x => !f.obs.includes(x.id));
if (novos.length) f.obs += (f.obs ? '; ' : '') + 'Outros pedidos com este nome: ' + lst(novos);
});
salvar();
}
}
async function rodar() {
if (rodando) return;
if (!campoBusca() || Object.keys(abas()).length < 3) { aviso('Não encontrei a busca ou as abas. Abra a lista de Pedidos e use "Diagnóstico".'); return; }
const itens = parseEntrada(entrada.value);
if (!itens.length) { aviso('Cole as pendências primeiro.'); return; }
const entradaAnterior = localStorage.getItem(CH_ENTRADA) || '';
localStorage.setItem(CH_ENTRADA, entrada.value);
if (entradaAnterior.trim() !== entrada.value.trim()) { res = {}; salvar(); }
ordemChaves = itens.map(p => p.chave);
localStorage.setItem('hubii_pend_ordem', JSON.stringify(ordemChaves));
rodando = true; parar = false;
manterAcordado();
const T0reg = Date.now(); let nReg = 0;
try {
if (noDetalhe()) await voltar();
const pend = itens.filter(p => chkRefazer.checked || !res[p.chave] || res[p.chave].status === 'Erro' || (chkValor.checked && res[p.chave].verif === 'Valor não confere' && (res[p.chave].ver || 0) < 2) || (res[p.chave].status === 'Despacho' && !res[p.chave].classe) || (chkValor.checked && /pedido não aberto/.test(res[p.chave].obs || '') && (!res[p.chave].classe || res[p.chave].classe !== 'outro' && res[p.chave].classe !== 'cancelado' && res[p.chave].classe !== 'devolvido')));
const grupos = new Map();
pend.forEach(p => {
const k = p.pedidoOH ? 'n#' + p.pedidoOH : norm(p.nome);
if (!grupos.has(k)) grupos.set(k, p.pedidoOH ? { nome: p.nome, numero: p.pedidoOH, porNumero: true, itens: [] } : { nome: p.nome, itens: [] });
grupos.get(k).itens.push(p);
});
const deslogado = () => !!document.querySelector('input[type="password"]') || /login|signin|entrar/i.test(location.pathname);
const aguardarLogin = async () => { while (deslogado() && !parar) { aviso('O Painel Hubii está deslogado. Entre de novo nesta aba; eu continuo sozinho quando a lista de Pedidos voltar.'); await sleep(15000); } await sleep(3000); };
const tentar = async g => { try { await processarGrupo(g); return null; } catch (e) { return e; } };
let i = 0, seguidos = 0, pausas = 0;
for (const g of grupos.values()) {
if (parar) break;
i++;
aviso('Verificando ' + i + ' de ' + grupos.size + ' (' + itens.length + ' pendências coladas): ' + g.nome + (itens.length > pend.length ? '\n(' + (itens.length - pend.length) + ' já verificadas antes foram puladas)' : ''));
let e = await tentar(g);
if (e && deslogado()) { await aguardarLogin(); if (!parar) e = await tentar(g); }
if (!e) { seguidos = 0; nReg += g.itens.length; }
else {
console.error(e);
seguidos++;
g.itens.forEach(p => guardar(p, { pedido: '', status: 'Erro', aut: 'Não', dataH: '', verif: 'Erro ao verificar: ' + e.message, obs: 'Clique em Iniciar de novo para tentar outra vez' }));
if (seguidos >= 3) { pausas++; if (pausas >= 5) { parar = true; aviso('Parei: erros repetidos (' + e.message + '). Volte para a lista de Pedidos e clique em Iniciar para continuar de onde parou.'); } else { aviso('3 erros seguidos (' + e.message + '). Espero 2 minutos e continuo.'); await sleep(120000); try { if (noDetalhe()) await voltar(); } catch (e2) {} seguidos = 0; } }
}
desenhar();
}
const todos = Object.values(res).map(reavaliar);
if (true) aviso((parar ? 'Parado. ' : 'Fim. ') + todos.filter(r => r.aut === 'Sim').length + ' autorizadas para baixa, ' + todos.filter(r => r.acao === 'Cancelar').length + ' para cancelar (invisíveis), ' + todos.filter(r => r.aut === 'Não' && r.status !== 'Não localizado' && r.acao !== 'Cancelar').length + ' não autorizadas, ' + todos.filter(r => r.status === 'Não localizado').length + ' não localizadas.');
} catch (e) {
console.error(e);
aviso('Erro inesperado: ' + e.message);
} finally {
rodando = false;
if (nReg > 0 && window.__centralReg) window.__centralReg.add({ k: 'verificar', t0: T0reg, t: Date.now(), n: nReg });
}
}
async function consultar() {
if (rodando) { aviso('Espere a verificação terminar (ou clique em Parar).'); return; }
const termo0 = campoNome.value.trim();
if (!termo0) { aviso('Digite o nome do cliente no campo "Consultar nome".'); return; }
if (!campoBusca() && !noDetalhe()) { aviso('Abra a lista de Pedidos do Hubii primeiro.'); return; }
rodando = true; parar = false;
manterAcordado();
consultaBox.textContent = '';
try {
aviso('Buscando "' + termo0 + '" no Hubii...');
if (noDetalhe()) await voltar();
let r = await buscarHits(termo0);
if (!r.hits.length && semAcento(termo0) !== termo0) r = await buscarHits(semAcento(termo0));
const pend = parseEntrada(entrada.value).filter(p => norm(p.nome) === norm(termo0) || norm(p.nome).includes(norm(termo0)) || norm(termo0).includes(norm(p.nome)));
if (!r.hits.length) { aviso('Nenhum pedido encontrado para "' + termo0 + '" (nem sem acento).'); return; }
const difP = x => Math.min(...pend.map(p => { const a = lerData(p.data), b = lerData(x.dataH); return a && b ? Math.abs(a.t - b.t) : 9e15; }).concat([9e15]));
const ordem = r.hits.slice().sort((a, b) => difP(a) - difP(b));
const dd = {};
if (chkLer.checked) {
let n = 0;
for (const x of ordem) {
if (parar || n >= 12) break;
n++;
aviso('Lendo o valor do pedido ' + x.id + ' (' + n + ' de ' + Math.min(12, ordem.length) + ')...');
dd[x.id] = await lerDados(r.termo, x).catch(e => ({ erro: e.message }));
}
}
const cab2 = ['Pedido', 'Status', 'Data do pedido', 'Valor', 'Confere com a pendência'];
const t2 = h('table', { style: 'width:100%;border-collapse:collapse;font-size:12px;margin-top:4px' });
t2.appendChild(h('tr', {}, ...cab2.map(t => h('th', { textContent: t, style: 'text-align:left;border-bottom:1px solid #ddd8f2;padding:3px 4px;color:#5a5480' }))));
ordem.forEach(x => {
const v = dd[x.id] ? dd[x.id].valor : null;
const dt = lerData(x.dataH || (dd[x.id] && dd[x.id].data));
const ok = [];
pend.forEach(p => {
const dp = lerData(p.data);
if (dp && dt && Math.abs(dp.t - dt.t) <= 3 * 86400000) ok.push('data');
if (p.total != null && dd[x.id] && aceitos(dd[x.id]).some(w => w != null && Math.abs(w - p.total) < 0.015)) ok.push('valor');
});
const marca = ok.length ? '✔ ' + [...new Set(ok)].join(' + ') : '';
const c = [x.id, nomeStatus(x), dt ? dt.txt : (x.dataH || '-'), v != null ? fmt(v) : '-', marca];
t2.appendChild(h('tr', {}, ...c.map((t, i) => h('td', { textContent: t, style: 'padding:3px 4px;border-bottom:1px solid #ece8f8;color:' + (i === 4 && marca ? '#0b6a2a' : '#1b1740') + ';font-weight:' + (i === 4 ? '700' : '400') }))));
});
const ref = pend.length ? 'Pendência no OnePet: ' + pend.map(p => (p.data || 'sem data') + (p.total != null ? ' / ' + fmt(p.total) : '')).join(' | ') : 'Este nome não está na lista de pendências colada (sem comparação automática).';
consultaBox.appendChild(h('div', { style: 'font-size:12px;color:#1b1740;margin-top:6px', textContent: ref }));
consultaBox.appendChild(t2);
aviso(ordem.length + ' pedido(s) encontrados para "' + termo0 + '"' + (chkLer.checked ? '' : '. Marque "Ler os valores" e consulte de novo para ver o valor de cada um') + '.');
} catch (e) {
console.error(e);
aviso('Erro na consulta: ' + e.message);
} finally {
rodando = false;
}
}
function diagnostico() {
const c = campoBusca();
const ab = abas();
const ls = linhas();
const p = ['Campo de busca: ' + (c ? 'ok' : 'NÃO ENCONTRADO'), 'Abas: ' + ROTULOS.map(r => r + '=' + (ab[r] ? ab[r].n : '?')).join(', '), 'Linhas na tela: ' + ls.length];
if (ls[0]) p.push('1ª linha: ' + ls[0].bruto.slice(0, 180), 'Status lido: ' + (ls[0].status || '(nenhum)'), 'Data lida: ' + (ls[0].dataH || '(nenhuma)'));
aviso(p.join('\n'));
}
let ordemChaves = lerJSON('hubii_pend_ordem', []);
// recalcula a autorização com as caixas marcadas agora (os resultados guardados não ficam presos à escolha de quando foram verificados)
function reavaliar(r) {
const cl = r.classe;
if (!cl || !r.pedido || r.sinais == null || r.acao === 'Cancelar') return r;
const n = String(r.sinais).split(' + ').filter(Boolean).length;
const veto = /PRODUTO DIFERENTE/.test(r.verif || '');
const ok = autoriza({ classe: cl }) && n >= 3 && !veto;
r.aut = ok ? 'Sim' : 'Não';
if (r.acao === 'Dar baixa' || r.acao === 'Aguardar') r.acao = ok ? 'Dar baixa' : 'Aguardar';
return r;
}
const lista = () => { const idx = {}; ordemChaves.forEach((k, i) => { idx[k] = i; }); return Object.values(res).map(reavaliar).map((r, i) => ({ r, o: r.chave in idx ? idx[r.chave] : 1e6 + i })).sort((a, b) => a.o - b.o).map(x => x.r); };
const cols = r => [r.cliente, r.pedido, r.status, r.aut, r.acao, r.dataH, r.codigo, fmt(r.total), r.data, r.endH, r.eanH, r.verif, r.obs].map(x => String(x == null ? '' : x).replace(/[\t\r\n]/g, ' '));
const CAB = ['Cliente', 'Pedido', 'Status', 'Autorizado para baixa', 'Ação', 'Data do pedido (Hubii)', 'Código', 'Total', 'Data da pendência', 'Endereço (Hubii)', 'Produto EAN (Hubii)', 'Verificação', 'Observação'];
const tsv = () => [CAB.join('\t')].concat(lista().map(r => cols(r).join('\t'))).join('\n');
const blocos = () => lista().map(r => 'Cliente: ' + r.cliente + '\nPedido: ' + (r.pedido || '-') + '\nStatus: ' + r.status + (chkData.checked ? '\nData: ' + (r.dataH || '-') : '') + '\nAutorizado para baixa: ' + (r.aut === 'Sim' ? 'Sim' : r.acao === 'Cancelar' ? 'Não: CANCELAR (pedido invisível)' : 'Não') + (chkVerif.checked ? '\nVerificação: ' + r.verif : '')).join('\n\n');
const csv = () => '﻿' + [CAB].concat(lista().map(cols)).map(l => l.map(c => '"' + c.replace(/"/g, '""') + '"').join(';')).join('\r\n');
async function copiar(t) {
try { await navigator.clipboard.writeText(t); }
catch (e) { const ta = h('textarea', { value: t }); document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
aviso('Copiado (' + lista().length + ' registros).');
}
function baixarCsv() {
const a = h('a', { href: URL.createObjectURL(new Blob([csv()], { type: 'text/csv;charset=utf-8' })), download: 'pendencias-hubii.csv' });
document.body.appendChild(a); a.click(); a.remove();
}
const statusBg = h('div', { style: 'font-size:12px;margin-top:4px;color:#5a5480', textContent: 'Segundo plano: será medido quando você clicar em Iniciar' });
const entrada = h('textarea', { placeholder: 'Cole aqui as pendências do Hubii: código, cliente, total e data separados por TAB, uma por linha. Também aceita só o nome do cliente (ou nome e total).', style: 'width:100%;height:80px;font:11px monospace;box-sizing:border-box;background:#f6f5fc;color:#1b1740;border:1px solid #b9b2dc;border-radius:6px;padding:6px' });
entrada.value = localStorage.getItem(CH_ENTRADA) || '';
const chkValor = h('input', { type: 'checkbox' }); chkValor.checked = true;
const chkEntregue = h('input', { type: 'checkbox' }); chkEntregue.checked = true;
const chkExp = h('input', { type: 'checkbox' }); chkExp.checked = true;
chkEntregue.onchange = chkExp.onchange = () => { try { desenhar(); } catch (e) {} };
const chkRefazer = h('input', { type: 'checkbox' }); chkRefazer.checked = false;
const chkData = h('input', { type: 'checkbox' }); chkData.checked = true;
const chkVerif = h('input', { type: 'checkbox' }); chkVerif.checked = false;
const campoNome = h('input', { type: 'text', placeholder: 'Nome do cliente (ex.: Roberta Lima)', style: 'width:260px;box-sizing:border-box;background:#f6f5fc;color:#1b1740;border:1px solid #b9b2dc;border-radius:6px;padding:6px 8px;font-size:12px;margin-right:6px' });
campoNome.onkeydown = e => { if (e.key === 'Enter') consultar(); };
const chkLer = h('input', { type: 'checkbox' }); chkLer.checked = false;
const consultaBox = h('div', { style: 'max-height:26vh;overflow:auto' });
const lab = (c, t) => h('label', { style: 'display:block;font-size:12px;margin:3px 0;color:#1b1740;cursor:pointer' }, c, h('span', { textContent: ' ' + t }));
const ESTILOS = {
primario: 'background:#5b3cc4;border:0;color:#ffffff;font-weight:700',
perigo: 'background:#fff;border:2px solid #a3261b;color:#a3261b;font-weight:700',
normal: 'background:#fff;border:1px solid #b9b2dc;color:#3a1f6d;font-weight:600',
suave: 'background:transparent;border:1px solid #b9b2dc;color:#3a1f6d;font-weight:600',
};
const btn = (t, f, tipo = 'normal') => {
const b = h('button', { textContent: t, onclick: f, style: 'margin:4px 6px 4px 0;padding:8px 14px;cursor:pointer;border-radius:9px;font-size:13px;' + ESTILOS[tipo] });
b.onmouseenter = () => { b.style.filter = 'brightness(1.25)'; };
b.onmouseleave = () => { b.style.filter = ''; };
return b;
};
const tbody = h('tbody');
const cab = h('tr', {}, ...['Cliente', 'Pedido', 'Status', 'Autoriz.', 'Ação', 'Data', 'Verificação'].map(t => h('th', { textContent: t, style: 'text-align:left;border-bottom:1px solid #ddd8f2;padding:3px 4px;color:#5a5480' })));
const tabela = h('table', { style: 'width:100%;border-collapse:collapse;font-size:12px' }, h('thead', {}, cab), tbody);
const rolagem = h('div', { style: 'max-height:34vh;overflow:auto;margin-top:6px;background:#f6f5fc;border-radius:4px' }, tabela);
function desenhar() {
try { if (window.__centralPlan) window.__centralPlan.salvar('hub', csv()); } catch (e) {}
tbody.textContent = '';
lista().forEach(r => {
const cor = r.aut === 'Sim' ? '#0b6a2a' : '#a3261b';
const c = [r.cliente, r.pedido, r.status, r.aut, r.acao, r.dataH, r.verif + (r.obs ? ' | ' + r.obs : '')];
tbody.appendChild(h('tr', {}, ...c.map((t, i) => h('td', { textContent: t == null ? '' : t, style: 'padding:3px 4px;border-bottom:1px solid #ece8f8;vertical-align:top;font-weight:' + (i === 3 || i === 4 ? '700' : '400') + ';color:' + (i === 3 ? cor : i === 4 ? (r.acao === 'Cancelar' ? '#7e5f00' : cor) : '#1b1740') }))));
});
}
painel = h('div', { id: 'hubii-pend', style: 'position:fixed;top:12px;right:12px;width:660px;max-width:96vw;max-height:94vh;overflow:auto;z-index:2147483646;background:#fff;color:#1b1740;font:14px/1.45 Segoe UI,system-ui,Arial,sans-serif;padding:14px 16px;border-radius:14px;box-shadow:0 8px 28px rgba(45,37,77,.35);border:1px solid #ddd8f2' },
h('div', { style: 'font-weight:700;margin-bottom:6px;font-size:14px;color:#1b1740', textContent: 'Verificar pendências no Hubii (só leitura: não dá baixa em nada)' }),
entrada,
lab(chkValor, 'Conferir o valor de cada pedido em "Visualizar dados para emissão" (recomendado; mais lento)'),
lab(chkEntregue, 'Pedidos Entregues também autorizados para baixa (em trânsito e extraviado já contam)'),
lab(chkExp, 'Pedidos em Despacho com status "Esperando Expedição" também autorizados para baixa'),
lab(chkRefazer, 'Refazer todos (ignorar os resultados já guardados)'),
lab(chkData, 'Incluir a data do pedido na "Copiar lista"'),
lab(chkVerif, 'Incluir como foi verificado na "Copiar lista"'),
h('div', { style: 'margin:8px 0 2px;padding:8px;border:1px solid #ddd8f2;border-radius:8px;background:#f6f5fc' },
h('div', { style: 'font-weight:700;font-size:12px;color:#5a5480;margin-bottom:4px', textContent: 'Consultar nome (você confere a data e o valor)' }),
campoNome, btn('Consultar nome', consultar, 'primario'),
lab(chkLer, 'Ler os valores (abre até 12 pedidos; mais lento)'),
consultaBox),
btn('Iniciar', rodar, 'primario'),
btn('Parar', () => { parar = true; aviso('Parando depois do pedido atual...'); }, 'perigo'),
btn('Diagnóstico', diagnostico, 'suave'),
btn('Copiar tabela', () => copiar(tsv())),
btn('Copiar lista', () => copiar(blocos())),
btn('Copiar não localizados', () => { const l = lista().filter(r => !r.pedido); copiar(l.map(r => [r.codigo, r.cliente, fmt(r.total), r.data].join('\t')).join('\n')).then(() => aviso(l.length + ' pendência(s) sem pedido no Painel Hubii copiadas. Cole no favorito "Consultar OneHub".')); }),
btn('Baixar CSV', baixarCsv),
btn('Limpar resultados', () => { res = {}; salvar(); desenhar(); aviso('Resultados apagados.'); }, 'suave'),
btn('Fechar', () => { painel.style.display = 'none'; }, 'suave'),
statusBg, msg, rolagem);
msg.style.color = '#1b1740';
prepararPainel(painel);
document.body.appendChild(painel);
window.__pendPainel = painel;
desenhar();
aviso(lista().length ? lista().length + ' resultado(s) guardado(s) de antes. Cole as pendências e clique em Iniciar para continuar.' : 'Pronto. Cole as pendências e clique em Iniciar. Dica: faça primeiro um teste com 2 ou 3 linhas. Depois de iniciar, pode usar outras abas ou janelas; só não feche esta aba nem deixe o computador dormir.');
};
})();
