(() => {
window.__centralBM = window.__centralBM || {};
window.__centralBM.coletar = async () => {
if (window.__pendColeta) { alert('A coleta já está rodando nesta aba. Aperte F5 para reiniciar.'); return; }
window.__pendColeta = true;
let parar = false;
let T0reg = Date.now();
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
(function manterAcordado() {
try { if (navigator.locks && navigator.locks.request) navigator.locks.request('hubii-coleta', () => new Promise(() => {})); } catch (e) {}
try {
const AC = window.AudioContext || window.webkitAudioContext;
const ac = new AC();
const osc = ac.createOscillator();
const gan = ac.createGain();
gan.gain.value = 0.00001;
osc.frequency.value = 30;
osc.connect(gan); gan.connect(ac.destination);
osc.start();
window.__coletaAudio = ac;
} catch (e) {}
})();
const qsa = s => [...document.querySelectorAll(s)];
const esperar = async (fn, seg = 10) => {
let oculto = 0;
for (let i = 0; i < seg * 5; i++) { const r = fn(); if (r) return r; if (document.hidden && oculto < 9000) { oculto++; i--; } await sleep(200); }
return null;
};
const h = (tag, a = {}, ...kids) => {
const e = document.createElement(tag);
for (const k in a) { if (k === 'style') e.style.cssText = a[k]; else e[k] = a[k]; }
kids.forEach(c => e.appendChild(c));
return e;
};
const antigo = document.getElementById('hubii-coleta');
if (antigo) antigo.remove();
const msg = h('div', { style: 'font-size:13px;line-height:1.45;margin-bottom:8px;white-space:pre-wrap;color:#3a3560' });
const saida = h('textarea', { style: 'width:100%;height:110px;font:11px monospace;box-sizing:border-box;display:none;color:#1b1740;background:#f6f5fc;border:1px solid #b9b2dc;border-radius:8px;padding:6px' });
const btParar = h('button', { textContent: 'Parar', style: 'padding:8px 14px;cursor:pointer;border-radius:9px;font-size:13px;color:#a3261b;margin-right:6px;background:#fff;border:2px solid #a3261b;font-weight:700', onclick: () => { parar = true; msg.textContent = 'Parando...'; } });
const btCopiar = h('button', { textContent: 'Copiar', style: 'padding:8px 14px;cursor:pointer;border-radius:9px;font-size:13px;color:#fff;margin-right:6px;background:#5b3cc4;border:0;font-weight:700;display:none' });
const btFechar = h('button', { textContent: 'Fechar', style: 'padding:8px 14px;cursor:pointer;border-radius:9px;font-size:13px;color:#3a1f6d;margin-right:6px;background:#fff;border:1px solid #b9b2dc;font-weight:600' });
const caixa = h('div', { id: 'hubii-coleta', style: 'position:fixed;right:16px;bottom:16px;z-index:2147483646;width:420px;max-width:94vw;background:#fff;color:#1b1740;font:14px/1.45 Segoe UI,system-ui,Arial,sans-serif;padding:14px 16px;border-radius:14px;border:1px solid #ddd8f2;box-shadow:0 8px 28px rgba(45,37,77,.35)' }, msg, saida, btParar, btCopiar, btFechar);
btFechar.onclick = () => { caixa.remove(); window.__pendColeta = false; };
document.body.appendChild(caixa);
try {
let ox = 0, oy = 0, mov = false;
caixa.style.cursor = 'grab';
caixa.addEventListener('pointerdown', e => {
if (/^(BUTTON|TEXTAREA|INPUT)$/.test(e.target.tagName) || (e.target.closest && e.target.closest('button,textarea'))) return;
mov = true;
const r = caixa.getBoundingClientRect();
ox = e.clientX - r.left; oy = e.clientY - r.top;
caixa.style.left = r.left + 'px'; caixa.style.top = r.top + 'px'; caixa.style.right = 'auto'; caixa.style.bottom = 'auto';
try { caixa.setPointerCapture(e.pointerId); } catch (x) {}
e.preventDefault();
});
caixa.addEventListener('pointermove', e => {
if (!mov) return;
caixa.style.left = Math.max(-caixa.offsetWidth + 80, Math.min(window.innerWidth - 80, e.clientX - ox)) + 'px';
caixa.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - oy)) + 'px';
});
caixa.addEventListener('pointerup', () => { mov = false; });
caixa.addEventListener('pointercancel', () => { mov = false; });
} catch (e) {}
const ALERTA = '\n⚠ Esta aba está em segundo plano: pode ficar lenta ou parar. Deixe esta janela aberta (pode ficar atrás de outras ou ao lado), sem minimizar e sem trocar de aba.';
const aviso = t => { msg.textContent = t + (document.hidden && /^(Verificando|Consultando|Página|Voltando|Buscando|Lendo)/.test(t) ? ALERTA : ''); };
const linhasPagina = () => qsa('table tbody tr').filter(tr => tr.cells && tr.cells.length >= 4 && /^\d{6,}$/.test((tr.cells[0].textContent || '').trim()));
const celulasIcone = tr => [...tr.cells].slice(4);
const textoHubii = tr => celulasIcone(tr).map(c => c.innerHTML || '').join(' ');
const iconeDe = tr => { for (const c of celulasIcone(tr)) { const e = c.querySelector('img, svg'); if (e) return e; } return null; };
const assinatura = e => !e ? '' : (e.tagName.toLowerCase() === 'img' ? (e.getAttribute('src') || '') + '|' + (e.getAttribute('alt') || '') : (e.outerHTML || '').replace(/\s+/g, ' ').slice(0, 400));
const achaBotao = txt => {
const c = qsa('a, button, li, span').filter(e => (e.textContent || '').trim() === txt);
return c.find(e => e.tagName === 'A' || e.tagName === 'BUTTON') || c[0];
};
const desab = e => { let n = e; for (let i = 0; i < 3 && n; i++, n = n.parentElement) { if (/disabled/i.test(n.className || '') || (n.getAttribute && n.getAttribute('aria-disabled') === 'true')) return true; } return false; };
const primeiraCod = () => { const r = linhasPagina(); return r.length ? r[0].cells[0].textContent.trim() : ''; };
const extrairEnd = txt => {
const t = String(txt || '').replace(/\r/g, '');
const m = t.match(/Endere[cç]o\s*:?\s*([^\n]+(?:\n(?![A-ZÀ-Ý\/ ]{3,}:)[^\n]+){0,2})/i);
const c = t.match(/\b\d{5}-?\d{3}\b/);
let sol = '';
if (!m) { const l = t.split('\n').map(x => x.trim()).find(x => /^(R\.?|Rua|Av\.?|Avenida|Travessa|Tv\.?|Alameda|Estrada|Rodovia|Pra[cç]a|Largo|Beco|Quadra|Q[ND]?)\s+\S+/i.test(x) && /\d/.test(x)); if (l) sol = l; }
if (!m && !c && !sol) return '';
let e = m ? m[1] : sol;
if (c && !e.includes(c[0])) e += ' ' + c[0];
return e.replace(/\s+/g, ' ').trim().slice(0, 160);
};
const extrairInfo = txt => {
const t = String(txt || '');
const cpf = (t.match(/CPF(?:\/CNPJ)?\s*:?\s*([\d.\-\/]{11,18})/i) || [])[1] || '';
const nm = (t.match(/(?:Cliente|Nome(?: do cliente)?)\s*:?\s*([^\n\t]{3,90})/i) || [])[1] || '';
return { nome: nm.replace(/\s+/g, ' ').trim(), endereco: extrairEnd(t), eans: [...new Set([...t.matchAll(/EAN\s*:?\s*(\d{8,14})/gi)].map(m => m[1]))], cpf: cpf.replace(/\D/g, '') };
};
const norm1 = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const infoVazia = () => ({ endereco: '', eans: [], cpf: '', nome: '' });
let endOk = 0, endFalha = 0, amostraEnd = '', diag = '', amostraFalha = '';
const dialogoAberto = () => { const d = document.querySelector('[role="dialog"], .modal.show, .swal2-popup'); return d && (d.innerText || '').length > 20 ? d : null; };
async function lerEndereco(tr) {
const a = (tr.cells[1] && tr.cells[1].querySelector('a')) || (tr.cells[0] && tr.cells[0].querySelector('a'));
if (!a) return infoVazia();
const href = a.getAttribute('href') || '';
let texto = '';
if (href && !/^(javascript:|#)/i.test(href)) {
try {
const r = await fetch(new URL(href, location.href).href, { credentials: 'include' });
const dom = new DOMParser().parseFromString(await r.text(), 'text/html');
texto = dom.body ? (dom.body.innerText || dom.body.textContent || '') : '';
} catch (e) {}
const inf = extrairInfo(texto);
diag = 'link aberto por requisição, ' + texto.length + ' caracteres';
if (texto && !inf.endereco && !amostraFalha) amostraFalha = texto.replace(/\s+/g, ' ').slice(0, 220);
if (inf.endereco && !amostraEnd) amostraEnd = texto.replace(/\s+/g, ' ').slice(0, 160);
return inf;
}
let aberta = null, msg = null, via = '';
const orig = window.open;
window.open = function () { aberta = orig.apply(window, arguments); return aberta; };
const onm = e => { if (e.source === window && e.data && e.data.central === 'popup') msg = e.data.texto; };
window.addEventListener('message', onm);
document.documentElement.setAttribute('data-central-capturar', '1');
try {
a.click();
await esperar(() => msg !== null || aberta || dialogoAberto(), 12);
if (msg !== null) { texto = msg; via = 'janelinha lida'; }
else if (aberta) {
await esperar(() => msg !== null, 14);
if (msg !== null) { texto = msg; via = 'janelinha lida'; }
else { via = 'janelinha abriu mas não li'; try { texto = aberta.document.body.innerText || ''; } catch (e) {} try { aberta.close(); } catch (e) {} }
} else {
const d = dialogoAberto();
if (d) {
via = 'caixa de diálogo';
texto = d.innerText || '';
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
const fx = [...d.querySelectorAll('button, .close, [data-dismiss], [aria-label]')].find(b => /fechar|close|×|x/i.test((b.textContent || '') + (b.getAttribute('aria-label') || '')));
if (fx) fx.click();
await sleep(500);
} else via = 'nada abriu (janelinha bloqueada? libere pop-ups para o OnePet)';
}
} finally { window.open = orig; window.removeEventListener('message', onm); document.documentElement.removeAttribute('data-central-capturar'); }
diag = via + ', ' + (texto || '').length + ' caracteres';
if (texto && !extrairInfo(texto).endereco && !amostraFalha) amostraFalha = texto.replace(/\s+/g, ' ').slice(0, 220);
const inf2 = extrairInfo(texto);
if (inf2.endereco && !amostraEnd) amostraEnd = texto.replace(/\s+/g, ' ').slice(0, 160);
return inf2;
}
let comEndereco = confirm('Incluir também ENDEREÇO, PRODUTO (EAN) e CPF de cada cliente do Hubii?\n\nOK = sim (abre a janelinha de cada pendência; mais lento, uns 2 a 3 segundos cada)\nCancelar = só código, cliente, total e data');
T0reg = Date.now();
const iconeGuardado = localStorage.getItem('hubii_pend_icone') || '';
try {
if (!linhasPagina().length) { aviso('Não encontrei a tabela de pendências nesta tela. Abra a aba Pendências.'); return; }
const caixaBusca = qsa('input[type="search"], .dataTables_filter input').find(i => i.value);
if (caixaBusca) {
aviso('Limpando o filtro de busca da tela (estava "' + caixaBusca.value + '")...');
const pr = window.HTMLInputElement.prototype, ds = Object.getOwnPropertyDescriptor(pr, 'value');
if (ds && ds.set) ds.set.call(caixaBusca, ''); else caixaBusca.value = '';
['input', 'change', 'keyup'].forEach(t => caixaBusca.dispatchEvent(new Event(t, { bubbles: true })));
await sleep(2000);
}
aviso('Voltando para a primeira página...');
for (let i = 0; i < 100; i++) {
const ant = achaBotao('Anterior');
if (!ant || desab(ant)) break;
const antes = primeiraCod();
ant.click();
await esperar(() => primeiraCod() !== antes, 5);
}
const vistos = new Map();
let paginas = 0;
let amostra = '';
for (;;) {
const rows = linhasPagina();
const antes = primeiraCod();
for (const tr of rows) {
const cod = tr.cells[0].textContent.trim();
if (vistos.has(cod)) continue;
const ic = iconeDe(tr);
if (!amostra && ic) amostra = (ic.outerHTML || '').replace(/\s+/g, ' ').slice(0, 140);
const ehHubii = /hubii/i.test(textoHubii(tr)) || (!!iconeGuardado && assinatura(ic) === iconeGuardado);
let info = infoVazia();
const nomeCel = tr.cells[1].textContent.replace(/\s+/g, ' ').trim();
const truncado = /(\.{2,}|…)\s*$/.test(nomeCel);
if ((comEndereco || truncado) && ehHubii && !parar) {
aviso('Página ' + (paginas + 1) + ': lendo endereço de ' + tr.cells[1].textContent.replace(/\s+/g, ' ').trim() + ' (' + endOk + ' ok, ' + endFalha + ' sem endereço)' + (endFalha && diag ? ' [última: ' + diag + ']' : '') + '...');
const fresco = linhasPagina().find(r => r.cells[0].textContent.trim() === cod) || tr;
try { info = await lerEndereco(fresco); } catch (e) { info = infoVazia(); }
try { window.focus(); } catch (e) {}
await sleep(400);
if (info.endereco) endOk++; else endFalha++;
if (endOk === 0 && endFalha === 5) {
if (!confirm('Não consegui ler o endereço nas 5 primeiras.\nO que aconteceu: ' + (diag || 'sem informação') + '.' + (amostraFalha ? '\nTexto lido: ' + amostraFalha : '') + '\n\nOK = continuar coletando SEM endereço (rápido)\nCancelar = parar aqui para você me mandar este texto')) { parar = true; }
else comEndereco = false;
}
}
vistos.set(cod, {
cod,
endereco: info.endereco,
eans: info.eans,
cpf: info.cpf,
cliente: (truncado && info.nome && info.nome.length > nomeCel.length - 3 && norm1(info.nome).startsWith(norm1(nomeCel.replace(/\s*(\.{2,}|…)\s*$/, '')).slice(0, 12))) ? info.nome : nomeCel,
total: tr.cells[2].textContent.replace(/\s+/g, ' ').trim(),
data: tr.cells[3].textContent.trim(),
hubii: /hubii/i.test(textoHubii(tr)),
sig: assinatura(ic),
icone: ic ? ic.outerHTML : '',
});
}
paginas++;
const comH = [...vistos.values()].filter(v => v.hubii).length;
aviso('Página ' + paginas + ': ' + vistos.size + ' pendências lidas, ' + comH + ' com ícone do Hubii.');
if (parar) break;
const nx = achaBotao('Próximo');
if (!nx || desab(nx)) break;
nx.click();
const mudou = await esperar(() => primeiraCod() !== antes, 10);
if (!mudou) break;
}
const todos = [...vistos.values()];
btParar.style.display = 'none';
const finalizar = (hub, extra) => {
try { if (window.__centralReg && todos.length) window.__centralReg.add({ k: 'coleta', t0: T0reg, t: Date.now(), n: todos.length, hub: hub.length, parado: !!parar }); } catch (e) {}
const texto = hub.map(v => [v.cod, v.cliente, v.total, v.data, v.endereco || '', '', (v.eans || []).join(','), v.cpf || ''].join('\t')).join('\n');
localStorage.setItem('hubii_pend_coletadas', texto);
saida.value = texto;
saida.style.display = 'block';
btCopiar.style.display = 'inline-block';
btCopiar.onclick = async () => {
try { await navigator.clipboard.writeText(texto); } catch (e) { saida.select(); document.execCommand('copy'); }
aviso('Copiado (' + hub.length + ' pendências do Hubii). Agora abra o Hubii (Pedidos) e use o favorito "Verificar pendências".');
};
aviso((parar ? 'Parado antes do fim. ' : 'Fim. ') + todos.length + ' pendências em ' + paginas + ' página(s); ' + hub.length + ' são do Hubii (copie abaixo) e ' + (todos.length - hub.length) + ' foram ignoradas.' + (comEndereco ? '\nDetalhes lidos (endereço, EAN, CPF): ' + endOk + ', sem endereço: ' + endFalha + (amostraEnd ? '. Exemplo do texto lido: ' + amostraEnd : (endFalha ? '. Não consegui ler a janelinha; me envie um print dela.' : '')) : '') + (extra || ''));
};
let hub = todos.filter(v => v.hubii);
if (!hub.length) {
const grupos = new Map();
todos.filter(v => v.sig).forEach(v => { if (!grupos.has(v.sig)) grupos.set(v.sig, { icone: v.icone, itens: [] }); grupos.get(v.sig).itens.push(v); });
const guardado = localStorage.getItem('hubii_pend_icone');
if (guardado && grupos.has(guardado)) hub = grupos.get(guardado).itens;
else if (grupos.size) {
aviso('Não achei a palavra "Hubii" nos ícones. Clique no ícone do Hubii abaixo (o número é quantas pendências têm esse ícone):');
const area = h('div', { style: 'margin:6px 0' });
grupos.forEach((g, sig) => {
const caixaIc = h('span', { style: 'display:inline-block;width:28px;height:28px;margin-right:8px;vertical-align:middle;overflow:hidden' });
caixaIc.innerHTML = g.icone;
const b = h('button', { style: 'padding:8px 14px;cursor:pointer;border-radius:9px;font-size:13px;color:#fff;background:#5b3cc4;border:0;font-weight:700;margin:3px 6px 3px 0', onclick: () => { localStorage.setItem('hubii_pend_icone', sig); area.remove(); finalizar(g.itens); } }, caixaIc, h('span', { textContent: 'é este (' + g.itens.length + ')' }));
area.appendChild(b);
});
caixa.insertBefore(area, saida);
return;
}
}
finalizar(hub, hub.length ? '' : '\nNenhuma linha com ícone foi encontrada. Me envie um print da coluna do ícone.');
} catch (e) {
console.error(e);
aviso('Erro inesperado: ' + e.message);
} finally {
window.__pendColeta = false;
}
};
})();
