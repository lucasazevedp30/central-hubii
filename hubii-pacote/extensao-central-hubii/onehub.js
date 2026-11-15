(() => {
window.__centralBM = window.__centralBM || {};
window.__centralBM.onehub = async () => {
if (window.__ohPainel && document.body.contains(window.__ohPainel)) { window.__ohPainel.style.display = 'block'; return; }
const CH_ENTRADA = 'hubii_oh_entrada';
const CH_RES = 'hubii_oh_resultados';
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
try { if (navigator.locks && navigator.locks.request) navigator.locks.request('hubii-oh', () => new Promise(() => {})); } catch (e) {}
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
const norm = s => semAcento(s).toLowerCase().replace(/\s+/g, ' ').trim();
const dinheiro = s => {
const t = String(s == null ? '' : s).replace(/R\$/g, '').trim();
const m = t.match(/\d[\d.]*,\d{2}|\d+\.\d{2}\b/);
if (!m) return null;
const v = m[0].includes(',') ? m[0].replace(/\./g, '').replace(',', '.') : m[0];
const n = parseFloat(v);
return isNaN(n) ? null : n;
};
const fmt = v => (v == null ? '' : 'R$ ' + v.toFixed(2).replace('.', ','));
const lerData = s => {
const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
if (!m) return null;
const a = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
return { txt: m[1] + '/' + m[2] + '/' + a, t: Date.UTC(a, parseInt(m[2], 10) - 1, parseInt(m[1], 10)) };
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
const STATUS_RE = /^(cancelad[oa]|pedido separado|separad[oa]|entregue|em tr[âa]nsito|despachad[oa]|coletad[oa]|finalizad[oa]|devolvid[oa]|extraviad[oa]|aguardando.*|esperando.*|aceit[oa]|novo|pendente|recusad[oa]|expirad[oa]|em separa[çc][ãa]o|pronto.*|faturad[oa]|enviad[oa]|conclu[ií]d[oa])$/i;
const campoBusca = () => {
const todos = qsa('input').filter(i => fora(i) && (!i.type || ['text', 'search'].includes(i.type)) && !i.disabled);
return todos.find(i => /busc|pesquis|nome|pedido|cliente/i.test(i.placeholder || '')) || todos[0] || null;
};
function setBusca(c, v) {
const proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
const d = proto && Object.getOwnPropertyDescriptor(proto, 'value');
if (c.focus) c.focus();
if (d && d.set) d.set.call(c, v); else c.value = v;
c.dispatchEvent(new Event('input', { bubbles: true }));
c.dispatchEvent(new Event('change', { bubbles: true }));
}
const lerIds = () => qsa('body *').filter(e => fora(e) && e.children.length === 0 && (e.getClientRects().length > 0) && /^\d{7,}$/.test((e.textContent || '').trim())).map(e => ({ id: e.textContent.trim(), el: e }));
function linhas() {
const vistos = new Set();
const out = [];
for (const { id, el } of lerIds()) {
if (vistos.has(id)) continue;
vistos.add(id);
let n = null, a = el;
for (let k = 0; k < 10 && a && a !== document.body; k++, a = a.parentElement) {
const t = a.innerText || '';
if (/\d{2}\/\d{2}\/\d{2,4}/.test(t) && /R\$/.test(t)) { n = a; break; }
}
if (!n) {
n = el;
while (n.parentElement && n.parentElement !== document.body) {
const p = n.parentElement;
const t = p.innerText || '';
const ids = new Set(t.match(/\b\d{7,}\b/g) || []);
if (ids.size > 1 || t.split('\n').length > 14) break;
n = p;
}
}
const ls = (n.innerText || '').split(/[\n\t]/).map(s => s.trim()).filter(Boolean);
const dt = lerData(ls.join(' '));
let total = null, repasse = null, proxRep = false;
for (const l of ls) {
if (/^repasse/i.test(l)) { proxRep = true; const v0 = dinheiro(l); if (v0 != null) { repasse = v0; proxRep = false; } continue; }
if (/R\$/.test(l)) { const v = dinheiro(l); if (v != null) { if (proxRep) { repasse = v; proxRep = false; } else if (total == null) total = v; } }
}
const livre = ls.filter(l => l !== id && !/^\d+$/.test(l) && !/\d{2}\/\d{2}\/\d{2,4}/.test(l) && !/^\d{1,2}:\d{2}$/.test(l) && !/R\$/.test(l) && !/^repasse/i.test(l) && (l.match(/[A-Za-zÀ-ÿ]/g) || []).length >= 3);
const stMatch = ls.find(l => STATUS_RE.test(l)) || ((ls.join(' | ').match(/\b(cancelad[oa]|entregue|despachad[oa]|em tr[âa]nsito|pedido separado|extraviad[oa]|devolvid[oa]|coletad[oa]|finalizad[oa]|em separa[çc][ãa]o|recusad[oa]|expirad[oa])\b/i) || [])[1] || '');
const nome = livre.find(l => !STATUS_RE.test(l)) || '';
const status = stMatch || livre.filter(l => l !== nome)[0] || '';
out.push({ id, nome, data: dt ? dt.txt : '', total, repasse, status, bruto: ls.join(' | ') });
}
return out;
}
const snap = () => linhas().map(l => l.id).join(',');
async function estavel(min = 1500, max = 24) {
await sleep(min);
let ult = snap(), igual = 0;
for (let i = 0; i < max && igual < 3; i++) { await sleep(400); const s = snap(); if (s === ult) igual++; else { igual = 0; ult = s; } }
}
async function buscar(termo) {
const c = campoBusca();
if (!c) throw new Error('não achei a caixa de busca do OneHub');
if (c.value) { setBusca(c, ''); await sleep(1800); await estavel(600); }
const antes = snap();
setBusca(c, termo);
await sleep(2200);
if (snap() === antes) {
['keydown', 'keypress', 'keyup'].forEach(t => c.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })));
await sleep(1500);
}
await estavel(600);
return linhas();
}
const textoSemPainel = () => { const d = painel ? painel.style.display : ''; try { if (painel) painel.style.display = 'none'; return document.body.innerText || ''; } finally { if (painel) painel.style.display = d; } };
async function lerDetalhe(id) {
const alvo = lerIds().find(x => x.id === id);
if (!alvo) return null;
const urlAntes = location.href;
const antes = textoSemPainel();
alvo.el.click();
const ok = await esperar(() => { const t = textoSemPainel(); return t !== antes && /EAN/i.test(t); }, 8);
let d = null;
if (ok) {
await sleep(900);
const t = textoSemPainel();
const en = (t.match(/Endere[cç]o\s*:?\s*([^\n]+(?:\n(?![A-ZÀ-Ý\/ ]{3,}:)[^\n]+){0,2})/i) || [])[1] || '';
const cpf = (t.match(/CPF(?:\/CNPJ)?\s*:?\s*([\d.\-\/]{11,18})/i) || [])[1] || '';
d = {
eans: [...new Set([...t.matchAll(/EAN\s*:?\s*(\d{8,14})/gi)].map(m => m[1]))],
valores: [...new Set([...t.matchAll(/R\$\s*([\d.]*\d,\d{2}|\d+\.\d{2})/g)].map(m => dinheiro(m[1])).filter(v => v != null))].slice(0, 60),
endereco: en.replace(/\s+/g, ' ').trim().slice(0, 160),
cpf: cpf.replace(/\D/g, ''),
};
}
try {
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
await sleep(600);
const fx = qsa('button').find(b => fora(b) && (/fechar|close|voltar/i.test((b.getAttribute('aria-label') || '') + ' ' + b.textContent)));
if (fx && !campoBusca()) fx.click();
if (location.href !== urlAntes && history.back) history.back();
await esperar(() => campoBusca() && lerIds().length, 12);
} catch (e) {}
return d;
}
let res = lerJSON(CH_RES, {});
let rodando = false, parar = false;
const msg = h('div', { style: 'margin:6px 0;font-size:12px;white-space:pre-wrap;color:#1b1740' });
const ALERTA = '\n⚠ Esta aba está em segundo plano: pode ficar lenta ou parar. Deixe esta janela aberta (pode ficar atrás de outras ou ao lado), sem minimizar e sem trocar de aba.';
const aviso = t => { msg.textContent = t + (document.hidden && /^(Verificando|Consultando|Página|Voltando|Buscando|Lendo)/.test(t) ? ALERTA : ''); };
const salvar = () => localStorage.setItem(CH_RES, JSON.stringify(res));
const guardar = (p, c) => { res[p.chave] = Object.assign({ chave: p.chave, codigo: p.codigo, cliente: p.nome, totalPend: p.total, dataPend: p.data }, c); salvar(); return res[p.chave]; };
function parseEntrada(txt) {
const limpaNome = s => { let t = String(s || '').replace(/\(?\s*hubi+\s*\)?/gi, ' ').replace(/\s+/g, ' ').trim(); if (/(\.{2,}|…)\s*$/.test(t)) { t = t.replace(/\s*(\.{2,}|…)\s*$/, '').trim(); const w = t.split(' '); if (w.length > 2) w.pop(); t = w.join(' '); } return t; };
const out = [];
String(txt).split(/\r?\n/).forEach((ln, i) => {
if (!ln.trim()) return;
const f = ln.split('\t').map(s => s.trim());
let codigo = '', nome = '', total = null, data = '', endereco = '', eans = [], cpf = '';
if (f.length >= 2 && /^\d{6,}$/.test(f[0])) { codigo = f[0]; nome = limpaNome(f[1]); total = dinheiro(f[2]); data = f[3] || ''; endereco = f[4] || ''; eans = (f[6] || '').match(/\d{8,14}/g) || []; cpf = (f[7] || '').replace(/\D/g, ''); }
else { nome = limpaNome(f[0]); total = dinheiro(f[1]); data = f[2] || ''; }
if (!nome || /^(c[oó]digo|cliente)$/i.test(nome)) return;
out.push({ codigo, nome, total, data, endereco, eans, cpf, chave: codigo ? 'c' + codigo : 'n:' + norm(nome) + '#' + i });
});
return out;
}
async function processar(p) {
let rows = await buscar(p.nome);
if (!rows.length && semAcento(p.nome) !== p.nome) rows = await buscar(semAcento(p.nome));
if (!rows.length) {
guardar(p, { pedido: '', status: 'Não encontrado no OneHub', situacao: 'Sem resultado no OneHub', verif: '', obs: 'Confira o filtro de datas do OneHub (precisa incluir ' + (p.data || 'a data da pendência') + ') e o nome digitado' });
return;
}
const dp = lerData(p.data);
const perto = r => { const d = lerData(r.data); return !dp || !d || Math.abs(dp.t - d.t) <= 10 * 86400000; };
const bateV = r => p.total != null && [r.total, r.repasse].some(v => v != null && Math.abs(v - p.total) < 0.015);
const lp = rows.filter(perto);
const cand = lp.filter(bateV);
let esc = null, obs = '';
if (cand.length === 1) esc = cand[0];
else if (cand.length > 1) {
const o = cand.slice().sort((a, b) => Math.abs((lerData(a.data) || { t: 9e15 }).t - (dp ? dp.t : 0)) - Math.abs((lerData(b.data) || { t: 9e15 }).t - (dp ? dp.t : 0)));
esc = o[0]; obs = 'Mais de um pedido com este valor: ' + o.map(x => x.id).join(', ');
} else if (lp.length === 1) esc = lp[0];
const lista = a => a.slice(0, 5).map(x => x.id + ' (' + (x.status || '?') + ', ' + (x.data || '?') + ', ' + fmt(x.total) + ')').join('; ') + (a.length > 5 ? ' e mais ' + (a.length - 5) : '');
if (!esc) {
guardar(p, { pedido: '', status: 'A conferir', situacao: 'OneHub tem pedido(s) deste nome, mas nenhum perto da data/valor', verif: '', obs: lista(rows) });
return;
}
let det = null;
if (chkDet.checked) { try { det = await lerDetalhe(esc.id); } catch (e) { det = null; } }
const sinais = [], dif = [], falta = [];
const marca = (n, e) => { if (e === true) sinais.push(n); else if (e === false) dif.push(n); else falta.push(n); };
const temV = esc.total != null || esc.repasse != null || (det && det.valores.length);
marca('valor', p.total != null && temV ? (bateV(esc) || !!(det && det.valores.some(v => Math.abs(v - p.total) < 0.015))) : null);
const de = lerData(esc.data);
marca('data', dp && de ? Math.abs(dp.t - de.t) <= 3 * 86400000 : null);
marca('produto', p.eans.length && det && det.eans.length ? p.eans.some(e => det.eans.includes(e)) : null);
marca('endereço', p.endereco && det && det.endereco ? enderecoParecido(p.endereco, det.endereco) : null);
marca('nome', esc.nome ? nomeParecido(p.nome, esc.nome) : (esc.bruto && palavras(p.nome).length >= 2 ? palavras(p.nome).every(w => norm(esc.bruto).includes(w)) || null : null));
const veto = dif.includes('produto');
const outros = rows.filter(x => x.id !== esc.id);
if (outros.length) obs += (obs ? '; ' : '') + 'Outros pedidos deste nome: ' + lista(outros);
if (esc.nome && !nomeParecido(p.nome, esc.nome)) obs += (obs ? '; ' : '') + 'Nome no OneHub: ' + esc.nome;
if (chkDet.checked && !det) obs += (obs ? '; ' : '') + 'Não consegui abrir o pedido para ler produto/endereço';
guardar(p, {
pedido: esc.id, status: esc.status || 'Sem status lido', dataH: esc.data, totalH: esc.total, repasseH: esc.repasse,
situacao: 'Existe no OneHub. Falta conferir o número no Painel Hubii (se não existir lá, é invisível: cancelar)',
verif: (sinais.length ? 'Confirmado (' + sinais.length + '): ' + sinais.join(' + ') : 'Nenhuma confirmação') + (dif.length ? ' | Diverge: ' + dif.join(', ') : '') + (falta.length ? ' | Sem dado: ' + falta.join(', ') : '') + (sinais.length < 3 ? ' | precisa de 3 confirmações' : '') + (veto ? ' | PRODUTO DIFERENTE' : ''),
obs, endereco: p.endereco, eans: p.eans, cpf: p.cpf,
});
}
async function rodar() {
if (rodando) return;
if (!campoBusca()) { aviso('Não achei a caixa de busca. Abra a lista de Pedidos do OneHub.'); return; }
const itens = parseEntrada(entrada.value);
if (!itens.length) { aviso('Cole as pendências primeiro.'); return; }
manterAcordado();
localStorage.setItem(CH_ENTRADA, entrada.value);
ordemChaves = itens.map(p => p.chave);
localStorage.setItem('hubii_oh_ordem', JSON.stringify(ordemChaves));
rodando = true; parar = false;
const T0reg = Date.now(); let nReg = 0;
try {
const pend = itens.filter(p => !res[p.chave]);
let i = 0;
for (const p of pend) {
if (parar) break;
i++;
aviso('Consultando ' + i + ' de ' + pend.length + ': ' + p.nome);
try { await processar(p); } catch (e) { console.error(e); guardar(p, { pedido: '', status: 'Erro', situacao: 'Erro: ' + e.message, verif: '', obs: '' }); }
nReg++;
desenhar();
}
aviso((parar ? 'Parado. ' : 'Fim. ') + Object.values(res).filter(r => r.pedido).length + ' encontrados no OneHub, ' + Object.values(res).filter(r => !r.pedido).length + ' sem pedido.');
} catch (e) {
aviso('Erro inesperado: ' + e.message);
} finally { rodando = false; if (nReg > 0 && window.__centralReg) window.__centralReg.add({ k: 'onehub', t0: T0reg, t: Date.now(), n: nReg }); }
}
function diagnostico() {
const c = campoBusca();
const ls = linhas();
const p = ['Caixa de busca: ' + (c ? 'ok (' + (c.placeholder || 'sem texto') + ')' : 'NÃO ENCONTRADA'), 'Linhas na tela: ' + ls.length];
if (ls[0]) p.push('1ª linha: ' + ls[0].bruto.slice(0, 200), 'Lido: pedido ' + ls[0].id + ' | nome ' + (ls[0].nome || '(nenhum)') + ' | data ' + (ls[0].data || '(nenhuma)') + ' | total ' + fmt(ls[0].total) + ' | repasse ' + fmt(ls[0].repasse) + ' | status ' + (ls[0].status || '(nenhum)'));
aviso(p.join('\n'));
}
let ordemChaves = lerJSON('hubii_oh_ordem', []);
const lista = () => { const idx = {}; ordemChaves.forEach((k, i) => { idx[k] = i; }); return Object.values(res).map((r, i) => ({ r, o: r.chave in idx ? idx[r.chave] : 1e6 + i })).sort((a, b) => a.o - b.o).map(x => x.r); };
const CAB = ['Cliente', 'Pedido (OneHub)', 'Status (OneHub)', 'Situação', 'Data do pedido (OneHub)', 'Total (OneHub)', 'Repasse (OneHub)', 'Código', 'Total da pendência', 'Data da pendência', 'Verificação', 'Observação'];
const cols = r => [r.cliente, r.pedido, r.status, r.situacao, r.dataH, fmt(r.totalH), fmt(r.repasseH), r.codigo, fmt(r.totalPend), r.dataPend, r.verif, r.obs].map(x => String(x == null ? '' : x).replace(/[\t\r\n]/g, ' '));
const tsv = () => [CAB.join('\t')].concat(lista().map(r => cols(r).join('\t'))).join('\n');
const blocos = () => lista().map(r => 'Cliente: ' + r.cliente + '\nPedido: ' + (r.pedido || '-') + '\nStatus no OneHub: ' + r.status + '\nData: ' + (r.dataH || '-') + '\nSituação: ' + r.situacao).join('\n\n');
const csv = () => '﻿' + [CAB].concat(lista().map(cols)).map(l => l.map(c => '"' + c.replace(/"/g, '""') + '"').join(';')).join('\r\n');
async function copiar(t) {
try { await navigator.clipboard.writeText(t); }
catch (e) { const ta = h('textarea', { value: t }); document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
aviso('Copiado (' + lista().length + ' registros).');
}
function baixarCsv() {
const a = h('a', { href: URL.createObjectURL(new Blob([csv()], { type: 'text/csv;charset=utf-8' })), download: 'pendencias-onehub.csv' });
document.body.appendChild(a); a.click(); a.remove();
}
const statusBg = h('div', { style: 'font-size:12px;margin-top:4px;color:#5a5480', textContent: 'Segundo plano: será medido quando você clicar em Iniciar' });
const entrada = h('textarea', { placeholder: 'Cole aqui as pendências que o Painel Hubii não encontrou (use o botão "Copiar não localizados" do painel Hubii): código, cliente, total e data separados por TAB.', style: 'width:100%;height:80px;font:11px monospace;box-sizing:border-box;background:#f6f5fc;color:#1b1740;border:1px solid #b9b2dc;border-radius:6px;padding:6px' });
entrada.value = localStorage.getItem(CH_ENTRADA) || '';
const chkDet = h('input', { type: 'checkbox' }); chkDet.checked = true;
const labDet = h('label', { style: 'display:block;font-size:12px;margin:3px 0;color:#1b1740;cursor:pointer' }, chkDet, h('span', { textContent: ' Abrir cada pedido para ler produto (EAN) e valores (mais lento; melhora a confirmação)' }));
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
const cab = h('tr', {}, ...['Cliente', 'Pedido', 'Status OneHub', 'Data', 'Situação'].map(t => h('th', { textContent: t, style: 'text-align:left;border-bottom:1px solid #ddd8f2;padding:3px 4px;color:#5a5480' })));
const rolagem = h('div', { style: 'max-height:40vh;overflow:auto;margin-top:6px;background:#f6f5fc;border-radius:4px' }, h('table', { style: 'width:100%;border-collapse:collapse;font-size:12px' }, h('thead', {}, cab), tbody));
function desenhar() {
try { if (window.__centralPlan) window.__centralPlan.salvar('oh', csv()); } catch (e) {}
tbody.textContent = '';
lista().forEach(r => {
const c = [r.cliente, r.pedido, r.status, r.dataH, r.situacao + (r.verif ? ' | ' + r.verif : '') + (r.obs ? ' | ' + r.obs : '')];
tbody.appendChild(h('tr', {}, ...c.map(t => h('td', { textContent: t, style: 'padding:3px 4px;border-bottom:1px solid #ece8f8;vertical-align:top;color:#1b1740' }))));
});
}
painel = h('div', { id: 'hubii-oh', style: 'position:fixed;top:12px;right:12px;width:660px;max-width:96vw;max-height:94vh;overflow:auto;z-index:2147483646;background:#fff;color:#1b1740;font:14px/1.45 Segoe UI,system-ui,Arial,sans-serif;padding:14px 16px;border-radius:14px;box-shadow:0 8px 28px rgba(45,37,77,.35);border:1px solid #ddd8f2' },
h('div', { style: 'font-weight:700;margin-bottom:6px;font-size:14px;color:#1b1740', textContent: 'Consultar no OneHub (só leitura)' }),
entrada,
labDet,
btn('Iniciar', rodar, 'primario'),
btn('Parar', () => { parar = true; aviso('Parando depois do pedido atual...'); }, 'perigo'),
btn('Diagnóstico', diagnostico, 'suave'),
btn('Copiar tabela', () => copiar(tsv())),
btn('Copiar para o Painel Hubii', () => { const l = lista().filter(r => r.pedido); copiar(l.map(r => [r.codigo, r.cliente, fmt(r.totalPend), r.dataPend, r.endereco || '', r.pedido, (r.eans || []).join(','), r.cpf || ''].join('\t')).join('\n')).then(() => aviso(l.length + ' pendência(s) com número do pedido copiadas. Cole no painel Verificar pendências do Painel Hubii.')); }, 'primario'),
btn('Copiar lista', () => copiar(blocos())),
btn('Baixar CSV', baixarCsv),
btn('Limpar resultados', () => { res = {}; salvar(); desenhar(); aviso('Resultados apagados.'); }, 'suave'),
btn('Fechar', () => { painel.style.display = 'none'; }, 'suave'),
statusBg, msg, rolagem);
prepararPainel(painel);
document.body.appendChild(painel);
window.__ohPainel = painel;
desenhar();
aviso('Pronto. Cole as pendências não localizadas e clique em Iniciar. Dica: o filtro de datas do OneHub precisa incluir as datas das pendências.');
};
})();
