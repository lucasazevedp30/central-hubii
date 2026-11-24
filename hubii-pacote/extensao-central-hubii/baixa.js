(() => {
if (window.__baixaHubii) return;
window.__baixaHubii = true;
const KEY = 'baixaHubii';
const store = {
  get: () => new Promise(r => chrome.storage.local.get(KEY, o => r(o[KEY] || null))),
  set: s => new Promise(r => chrome.storage.local.set({ [KEY]: s }, r)),
  del: () => new Promise(r => chrome.storage.local.remove(KEY, r))
};
// relógio em Worker + áudio mudo + trava de Web Locks: evitam que o Chrome atrase esta aba quando ela fica em segundo plano
let relogio = null; const esperaPend = {}; let seqRel = 0;
try {
  relogio = new Worker(URL.createObjectURL(new Blob(['onmessage=function(e){var d=e.data;setTimeout(function(){postMessage(d.id)},d.ms)}'], { type: 'text/javascript' })));
  relogio.onmessage = e => { const f = esperaPend[e.data]; if (f) { delete esperaPend[e.data]; f(); } };
  relogio.onerror = () => { relogio = null; };
} catch (e) { relogio = null; }
const sleep = ms => new Promise(r => {
  if (!relogio) { setTimeout(r, ms); return; }
  const id = ++seqRel; esperaPend[id] = r; relogio.postMessage({ id, ms });
  setTimeout(() => { if (esperaPend[id]) { delete esperaPend[id]; r(); } }, ms + 4000);
});
const manterAcordado = () => {
  try { if (navigator.locks && navigator.locks.request) navigator.locks.request('baixa-hubii', () => new Promise(() => {})); } catch (e) {}
  try {
    if (window.__baixaAudio) return;
    const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC();
    const osc = ac.createOscillator(); const gan = ac.createGain(); gan.gain.value = 0.00001; osc.frequency.value = 30;
    osc.connect(gan); gan.connect(ac.destination); osc.start(); window.__baixaAudio = ac;
  } catch (e) {}
};
let PARAR = false, ocupado = false, S = null;
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(?\bhubii\b\)?/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const nt = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const limpaNome = n => {
  let x = (n || '').replace(/\(?\bhubii\b\)?/ig, ' ').replace(/\s+/g, ' ').trim();
  if (/\.\.\.|…/.test(x)) { x = x.replace(/\s*(\.\.\.|…).*$/, '').trim().split(' '); x.pop(); x = x.join(' '); }
  return x;
};
const money = s => { const m = String(s || '').match(/(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/); return m ? parseFloat(m[1].replace(/\./g, '') + '.' + m[2]) : null; };
const igual = (a, b) => a !== null && b !== null && Math.abs(a - b) < 0.005;
const fmt = n => 'R$ ' + n.toFixed(2).replace('.', ',');
const visivel = e => { if (!e || !e.getClientRects().length) return false; const c = getComputedStyle(e); return c.visibility !== 'hidden' && c.display !== 'none' && (document.hidden || parseFloat(c.opacity || '1') > 0.05); };
const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim();
// Com a aba em segundo plano o Chrome pausa as animações da página (a janela de pagamento, por exemplo, só abre quando a aba volta).
// Por isso o tempo de espera NÃO corre enquanto a aba está escondida: a rotina fica esperando você voltar (até 30 min), em vez de parar.
const esperar = async (fn, seg = 20) => {
  let oculto = 0, avisou = false;
  for (let i = 0; i < seg * 4; i++) {
    if (PARAR) throw new Error('parado');
    const r = fn(); if (r) return r;
    if (document.hidden && oculto < 7200) {
      oculto++; i--;
      if (!avisou) { avisou = true; try { say('Esta aba ficou em segundo plano: o Chrome pausa a tela. Volte para esta aba que eu continuo sozinho.'); } catch (e) {} }
    }
    await sleep(250);
  }
  return null;
};
const clicavel = e => e.closest('button, a, [role="button"]') || e;
const setValor = (inp, v) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(inp, v);
  ['input', 'keyup', 'change'].forEach(t => inp.dispatchEvent(new Event(t, { bubbles: true })));
};
const achaTitulo = (frag, exato) => {
  const ok = e => { const t = nt(txt(e)); return t.length <= 70 && (exato ? t === frag : t.includes(frag)); };
  const caixa = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
  const c = [...document.body.querySelectorAll('*')].filter(e => caixa(e) && !e.closest('#baixa-hubii') && ok(e));
  return c.find(e => ![...e.children].some(k => c.includes(k))) || null;
};
const folhas = (raiz, f) => [...raiz.querySelectorAll('*')].filter(e => e.children.length === 0 && visivel(e) && f(nt(txt(e)), e));
// Lê o campo "Valor" da janela de pagamento e espera até `seg` segundos ele aparecer com o valor IGUAL ao esperado (o RESTANTE).
// O Hubii às vezes demora a montar a janela ou a preencher o valor. Devolve sempre o último estado lido (ok = achou e confere):
// se o valor for outro, ok continua falso e a rotina para, como antes. Nunca paga um valor diferente do restante.
const esperarCampoValor = async (achaModal, modalIni, esperado, seg) => {
  const ler = () => {
    let r = achaModal() || modalIni;
    while (r && r.parentElement && !([...r.querySelectorAll('button')].some(x => nt(txt(x)).startsWith('confirmar')))) r = r.parentElement;
    r = r || document.body;
    const rotulo = folhas(r, n => n === 'valor')[0];
    const entradas = [...r.querySelectorAll('input')].filter(i => visivel(i) && i.type !== 'hidden');
    const inp = (rotulo && entradas.find(i => rotulo.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING)) || entradas.filter(i => /\d/.test(i.value)).slice(-1)[0];
    const lido = inp ? (/,/.test(inp.value) ? money(inp.value) : parseFloat(inp.value)) : null;
    const c = { raiz: r, rotulo, entradas, inp, lido };
    c.ok = !!(inp && igual(lido, esperado)); c.confirmar = [...r.querySelectorAll('button')].some(x => nt(txt(x)).startsWith('confirmar'));
    return c;
  };
  let c = ler();
  if (c.ok) return c;
  await esperar(() => { c = ler(); return c.ok; }, seg);
  return c;
};

// ---------- painel
let painel, linhaEl, corpoEl, pintaProgFn = null;
const salvar = () => store.set(S);
const say = async m => {
  console.log('[Baixa Hubii]', m);
  if (linhaEl) linhaEl.textContent = m;
  if (pintaProgFn) pintaProgFn();
  if (S) { S.status = m; S.log = (S.log || []).concat(new Date().toLocaleTimeString('pt-BR') + ' ' + m).slice(-40); await salvar(); }
};
const resultado = async (item, res, det) => {
  try { if (window.__centralReg) window.__centralReg.add({ k: 'baixa', t: Date.now(), ms: Math.min(600000, Math.max(0, Date.now() - (S.itemT0 || Date.now()))), res: String(res) }); } catch (e) {}
  S.itemT0 = 0;
  S.resultados.push({ nome: item.nome, res, det: det || '', hora: new Date().toLocaleString('pt-BR') });
  await salvar();
};
const relatorio = () => (S && S.resultados || []).map(r => [r.nome, r.res, r.det, r.hora].join('\t')).join('\n');
// ---------- carregar planilha (.xlsx / .csv)
const lerZip = async buf => {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  let e = buf.byteLength - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('arquivo xlsx inválido');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {};
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const met = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(u8.slice(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
    const ini = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    out[nome] = async () => {
      const dados = u8.slice(ini, ini + cs); if (met === 0) return new TextDecoder().decode(dados);
      const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(dados); w.close();
      return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer());
    };
  }
  return out;
};
const xmlDoc = s => new DOMParser().parseFromString(s, 'application/xml');
const colNum = ref => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const lerXlsx = async buf => {
  const z = await lerZip(buf);
  const wb = xmlDoc(await z['xl/workbook.xml']()), rels = xmlDoc(await z['xl/_rels/workbook.xml.rels']());
  const alvo = {}; rels.querySelectorAll('Relationship').forEach(r => { alvo[r.getAttribute('Id')] = r.getAttribute('Target'); });
  const ss = []; if (z['xl/sharedStrings.xml']) xmlDoc(await z['xl/sharedStrings.xml']()).querySelectorAll('si').forEach(si => ss.push([...si.querySelectorAll('t')].map(t => t.textContent).join('')));
  const abas = [];
  for (const s of wb.querySelectorAll('sheet')) {
    const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let t = (alvo[rid] || '').replace(/^\//, ''); if (!t.startsWith('xl/')) t = 'xl/' + t;
    if (!z[t]) continue;
    const rows = [];
    xmlDoc(await z[t]()).querySelectorAll('row').forEach(r => {
      const linha = [];
      r.querySelectorAll('c').forEach(c => {
        const v = c.querySelector('v'), tipo = c.getAttribute('t'); let val = '';
        if (tipo === 's' && v) val = ss[+v.textContent] || ''; else if (tipo === 'inlineStr') val = [...c.querySelectorAll('t')].map(x => x.textContent).join(''); else if (v) val = v.textContent;
        linha[colNum(c.getAttribute('r'))] = val;
      });
      rows[+r.getAttribute('r') - 1] = linha;
    });
    abas.push({ nome: s.getAttribute('name'), rows: [...rows].map(x => x || []) });
  }
  return abas;
};
const lerCsv = txtc => {
  const sep = ((txtc.split('\n')[0].match(/;/g) || []).length >= (txtc.split('\n')[0].match(/,/g) || []).length && /;/.test(txtc.split('\n')[0])) ? ';' : (/\t/.test(txtc.split('\n')[0]) ? '\t' : ',');
  const rows = []; let l = [], c = '', q = false;
  for (let i = 0; i < txtc.length; i++) {
    const ch = txtc[i];
    if (q) { if (ch === '"') { if (txtc[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { l.push(c); c = ''; } else if (ch === '\n') { l.push(c.replace(/\r$/, '')); rows.push(l); l = []; c = ''; } else c += ch;
  }
  if (c || l.length) { l.push(c.replace(/\r$/, '')); rows.push(l); }
  return [{ nome: 'csv', rows }];
};
const lerArquivoPlanilha = async f => {
  if (/\.csv$|\.txt$|\.tsv$/i.test(f.name)) return lerCsv(await f.text());
  return lerXlsx(await f.arrayBuffer());
};
const coletadas = () => {
  let t = ''; try { t = localStorage.getItem('hubii_pend_coletadas') || ''; } catch (e) {}
  return t.split('\n').map(l => l.split('\t')).filter(p => p.length > 2 && /^\d{9}$/.test((p[0] || '').trim())).map(p => ({ codigo: p[0].trim(), cliente: p[1] || '', total: money(p[2]) }));
};
// devolve {linhas, resumo}
const montarDaPlanilha = (abas, minConf) => {
  const ach = (rows, nomes) => { for (let i = 0; i < Math.min(rows.length, 15); i++) { const h = (rows[i] || []).map(x => norm(String(x || ''))); if (h.includes('cliente')) return { i, h }; } return null; };
  let aba = abas.find(a => norm(a.nome) === 'dar baixa'), cab = aba && ach(aba.rows);
  if (!cab) for (const a of abas) { const c = ach(a.rows); if (c) { aba = a; cab = c; break; } }
  if (!cab) throw new Error('Não achei a coluna "Cliente" na planilha.');
  const col = (...nomes) => cab.h.findIndex(x => nomes.includes(x));
  const iCli = col('cliente'), iDes = col('destino'), iConf = col('confiabilidade'), iOrd = col('ordem'), iTot = col('total', 'valor'), iCod = col('codigo');
  let linhas = aba.rows.slice(cab.i + 1).map(r => ({
    cliente: String(r[iCli] || '').trim(), destino: iDes >= 0 ? norm(String(r[iDes] || '')) : 'dar baixa',
    conf: iConf >= 0 ? parseFloat(String(r[iConf]).replace(',', '.')) : NaN, ord: iOrd >= 0 ? parseFloat(r[iOrd]) : NaN,
    total: iTot >= 0 ? (/^\d+(\.\d+)?$/.test(String(r[iTot] || '').trim()) ? parseFloat(r[iTot]) : money(r[iTot])) : null, codigo: iCod >= 0 ? (String(r[iCod] || '').match(/\b\d{9}\b/) || [''])[0] : ''
  })).filter(l => l.cliente);
  const totalAba = linhas.length;
  linhas = linhas.filter(l => l.destino.includes('dar baixa'));
  const doDestino = linhas.length;
  linhas = linhas.filter(l => !isNaN(l.conf) && l.conf >= minConf);
  linhas.sort((a, b) => (isNaN(a.ord) ? 1e9 : a.ord) - (isNaN(b.ord) ? 1e9 : b.ord));
  const col9 = coletadas(); let semColeta = 0, ambiguos = 0;
  linhas.forEach(l => {
    if (l.codigo && l.total !== null) return;
    const k = norm(limpaNome(l.cliente));
    const cands = col9.filter(c => { const n = norm(limpaNome(c.cliente)); return n && k && (n === k || n.includes(k) || k.includes(n)); });
    if (cands.length === 1) { l.codigo = l.codigo || cands[0].codigo; if (l.total === null) l.total = cands[0].total; }
    else if (cands.length > 1) { ambiguos++; l.amb = true; } else semColeta++;
  });
  return { linhas, resumo: { aba: aba.nome, totalAba, doDestino, usadas: linhas.length, semColeta, ambiguos, coletadas: col9.length } };
};
window.__centralDiagBaixa = () => {
  let pend = false, pdv = false, painel = false; try { pend = ehPend(); } catch (e) {} try { pdv = ehPdv(); } catch (e) {}
  try { const p = document.getElementById('baixa-hubii'); painel = !!p && p.style.display !== 'none'; } catch (e) {}
  return { pend, pdv, painel, sessao: S ? ('fase ' + S.fase + (S.rodando ? ', rodando' : ', parada')) : '', coletadas: coletadas().length };
};
const montarPainel = () => {
  if (document.getElementById('baixa-hubii')) return;
  painel = document.createElement('div');
  painel.id = 'baixa-hubii';
  painel.style.cssText = 'position:fixed;left:19px;bottom:135px;display:none;z-index:2147483646;background:#fff;color:#1b1740;font:14px/1.45 Segoe UI,system-ui,Arial,sans-serif;padding:12px 14px;border-radius:14px;width:360px;max-width:94vw;border:1px solid #ddd8f2;box-shadow:0 8px 28px rgba(45,37,77,.35)';
  const cab = document.createElement('div');
  cab.style.cssText = 'font-weight:700;font-size:15px;color:#3a1f6d;cursor:move;display:flex;justify-content:space-between;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #ece8f8';
  cab.innerHTML = '<span>Baixa Hubii v4</span><span id="bh-min" style="cursor:pointer">–</span>';
  linhaEl = document.createElement('div'); linhaEl.style.cssText = 'margin-bottom:8px;word-break:break-word;color:#3a3560;font-size:13px';
  corpoEl = document.createElement('div');
  const progEl = document.createElement('div'); progEl.style.cssText = 'margin-bottom:8px;display:none';
  const pintaProg = () => {
    try {
      if (!S || !S.fila || !S.fila.length) { progEl.style.display = 'none'; return; }
      const fim = S.fase === 'fim' || S.fase === 'testefim';
      const st = S.rodando ? ['Rodando', '#e6e0fa', '#3a1f6d', '#5b3cc4'] : fim ? ['Concluído', '#e2f3e6', '#0b6a2a', '#0b6a2a'] : ['Parou', '#fde3df', '#a3261b', '#a3261b'];
      const total = S.fila.length, n = fim ? total : Math.min(S.i || 0, total);
      progEl.style.display = '';
      progEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;font-weight:700;padding:2px 10px;border-radius:999px;background:' + st[1] + ';color:' + st[2] + '">' + st[0] + '</span><span style="flex:1"></span><span style="font-size:20px;font-weight:700;color:#3a1f6d">' + n + ' <small style="font-size:13px;font-weight:600;color:#5a5480">de ' + total + '</small></span></div><div style="height:8px;border-radius:5px;background:#ece8f8;margin-top:6px;overflow:hidden"><div style="height:8px;width:' + Math.round(100 * n / total) + '%;background:' + st[3] + ';border-radius:5px"></div></div>';
    } catch (e) {}
  };
  pintaProgFn = pintaProg; pintaProg(); setInterval(pintaProg, 1000);
  painel.append(cab, progEl, linhaEl, corpoEl);
  document.body.appendChild(painel);
  let ox, oy, arr = false;
  cab.onpointerdown = e => { if (e.target.id === 'bh-min') return; arr = true; const r = painel.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top; cab.setPointerCapture(e.pointerId); };
  cab.onpointermove = e => { if (!arr) return; painel.style.left = (e.clientX - ox) + 'px'; painel.style.top = (e.clientY - oy) + 'px'; painel.style.bottom = 'auto'; };
  cab.onpointerup = () => { arr = false; };
  // só aparece na tela de Pendências (ou enquanto uma baixa está em andamento)
  const mostrar = () => { try { const v = ehPend() || !!(S && (S.rodando || /PDV Premium/i.test(document.body.innerText))); painel.style.display = v ? '' : 'none'; } catch (e) {} };
  mostrar(); setInterval(mostrar, 1000);
  cab.querySelector('#bh-min').onclick = () => { corpoEl.style.display = corpoEl.style.display === 'none' ? '' : 'none'; };
};
const PASTEL = { '#c8f7c5': ['#e2f3e6', '#0b3d1a', '#b7dcc2'], '#ffe9a8': ['#fff1cc', '#5e4700', '#ecd58a'], '#ffd6d6': ['#fff', '#a3261b', '#a3261b'], '#d9ccff': ['#ece9fb', '#3a1f6d', '#c9bff0'], primario: ['#5b3cc4', '#fff', '#5b3cc4'] };
const btn = (t, f, cor) => { const b = document.createElement('button'); b.textContent = t; const c = PASTEL[cor] || ['#fff', '#3a1f6d', '#b9b2dc']; b.style.cssText = 'margin:4px 6px 0 0;padding:8px 14px;cursor:pointer;color:' + c[1] + ';border-radius:9px;font:600 13px Segoe UI,system-ui,Arial,sans-serif;border:' + (cor === '#ffd6d6' ? '2px' : '1px') + ' solid ' + c[2] + ';background:' + c[0]; b.onclick = f; return b; };
const desenharControles = () => {
  corpoEl.innerHTML = '';
  if (pintaProgFn) pintaProgFn();
  const rodando = S && S.rodando;
  if (rodando) {
    corpoEl.append(btn('Parar', async () => { PARAR = true; S.rodando = false; await say('Parado. Feitos: ' + S.resultados.length + ' de ' + S.fila.length + '.'); desenharControles(); }, '#ffd6d6'));
    return;
  }
  const ta = document.createElement('textarea');
  ta.placeholder = 'Um cliente por linha: nome, total e (opcional) código.\nEx.: Maria Silva 104,31 100261593';
  ta.style.cssText = 'width:100%;height:90px;box-sizing:border-box;color:#1b1740;background:#f6f5fc;border:1px solid #b9b2dc;border-radius:8px;padding:6px 8px;font:12px monospace';
  const sel = document.createElement('select'); sel.style.cssText = 'width:100%;margin-top:8px;color:#1b1740;border:1px solid #b9b2dc;border-radius:8px;padding:6px;background:#fff';
  [['1', 'Teste 1: abre o PDV e confere o total (não paga)'], ['2', 'Teste 2: vai até o pagamento Hubii, sem finalizar (1 pedido)'], ['3', 'COMPLETO: paga, finaliza e confere']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); });
  const infoPl = document.createElement('div'); infoPl.style.cssText = 'font-size:12px;margin-top:6px;line-height:1.35';
  const arq = document.createElement('input'); arq.type = 'file'; arq.accept = '.xlsx,.csv,.tsv,.txt'; arq.style.display = 'none';
  const minI = document.createElement('input'); minI.type = 'number'; minI.min = 0; minI.max = 10; minI.value = 9; minI.style.cssText = 'width:52px;color:#1b1740;border:1px solid #b9b2dc;border-radius:6px;padding:4px';
  const bPl = btn('Carregar planilha', () => arq.click(), '#d9ccff');
  const bCen = btn('Planilha da Central (última)', async () => {
    try { if (!window.__centralPlan) throw new Error('A planilha da Central não carregou. Recarregue a página (F5).'); ultima = await window.__centralPlan.ultimaParaBaixa(); aplicarPlanilha(); }
    catch (e) { infoPl.textContent = 'Erro: ' + e.message; }
  }, '#c8f7c5');
  const linPl = document.createElement('div'); linPl.append(bCen, bPl, document.createTextNode(' confiabilidade mínima: '), minI, arq);
  let ultima = null; let daPlanilha = new Set();
  const aplicarPlanilha = () => {
    if (!ultima) return;
    try {
      const r = montarDaPlanilha(ultima.abas, parseFloat(minI.value) || 0);
      const lns = r.linhas.map(l => [l.cliente, l.total === null ? '' : l.total.toFixed(2).replace('.', ','), l.codigo || ''].join('\t'));
      daPlanilha = new Set(lns.map(x => x.trim()));
      ta.value = lns.join('\n');
      const m = r.resumo;
      infoPl.textContent = 'Planilha "' + ultima.nome + '" (aba ' + m.aba + '): ' + m.doDestino + ' em Dar baixa; ' + m.usadas + ' com confiabilidade ≥ ' + minI.value + ' carregadas, na ordem.' +
        (m.coletadas ? ' Coleta: ' + m.coletadas + ' pendências lidas; ' : ' ATENÇÃO: sem coleta guardada (rode "Coletar pendências" antes), só pelo nome; ') +
        (m.ambiguos ? m.ambiguos + ' nome(s) com mais de uma pendência (sem total/código); ' : '') + (m.semColeta ? m.semColeta + ' sem correspondência na coleta.' : '') +
        ' Mudou a confiabilidade mínima? A lista se atualiza sozinha. Confira a lista abaixo, escolha o modo e clique em Iniciar.';
    } catch (e) { infoPl.textContent = 'Erro ao ler a planilha: ' + e.message; }
  };
  minI.onchange = minI.oninput = aplicarPlanilha;
  arq.onchange = async () => {
    const f = arq.files[0]; if (!f) return;
    try { ultima = { abas: await lerArquivoPlanilha(f), nome: f.name }; aplicarPlanilha(); }
    catch (e) { infoPl.textContent = 'Erro ao ler a planilha: ' + e.message; }
    arq.value = '';
  };
  if (S && S.fila && !S.rodando && S.fase !== 'fim' && S.fase !== 'testefim' && S.i < S.fila.length) {
    const it = S.fila[S.i];
    const onde = { busca: 'buscando o cliente na Pendências', pdv: 'no PDV (venda/pagamento)', verifica: 'conferindo se a venda saiu da Pendências' }[S.fase === 'parado' ? S.faseParou : S.fase] || 'em andamento';
    const cx = document.createElement('div'); cx.style.cssText = 'background:#fdf1ef;color:#5e140e;border:1px solid #f0b9b1;border-radius:10px;padding:8px 10px;margin-bottom:8px;font-size:13px;line-height:1.4';
    cx.textContent = 'Parou no cliente ' + (S.i + 1) + ' de ' + S.fila.length + ': ' + it.nome + ' (' + onde + ').' + (S.motivo ? ' Motivo: ' + S.motivo : '') + ' Já feitos: ' + (S.resultados || []).filter(r => r.res === 'baixado').length + ' baixado(s).';
    cx.append(document.createElement('br'));
    const retomar = async modo => {
      PARAR = false;
      const f = S.fase === 'parado' ? (S.faseParou || 'busca') : S.fase;
      if (modo === 'pular') { await resultado(it, 'pulado', 'pulado à mão depois de parar' + (S.motivo ? ': ' + S.motivo : '')); S.i++; S.fase = 'busca'; S.atual = null; }
      else if (modo === 'conferir' && S.atual) S.fase = 'verifica';
      else S.fase = f;
      if (S.fase === 'pdv' && !ehPdv()) { S.fase = 'busca'; S.tentaPdv = 0; }
      S.rodando = true; S.motivo = ''; S.itemT0 = Date.now(); manterAcordado(); await salvar(); desenharControles();
      if (S.fase === 'busca' && !ehPend()) { location.href = S.urlPend; return; }
      loop();
    };
    cx.append(btn('Continuar de onde parou', () => retomar('igual'), '#c8f7c5'));
    if (S.atual && S.fase === 'parado' && S.faseParou === 'pdv') cx.append(btn('Já finalizei à mão: conferir', () => retomar('conferir'), '#ffe9a8'));
    cx.append(btn('Pular este cliente', () => retomar('pular')));
    corpoEl.append(cx);
  }
  corpoEl.append(linPl, infoPl, ta, sel);
  corpoEl.append(btn('Iniciar', async () => {
    const fila = ta.value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const p = l.split(/\t|;/).map(x => x.trim());
      if (p.length > 1) {
        const cod = (p.slice(1).join(' ').match(/\b\d{9}\b/) || [''])[0];
        const tot = p.slice(1).map(money).find(x => x !== null);
        return { nome: p[0], total: tot === undefined ? null : tot, codigo: cod, manual: !daPlanilha.has(l) };
      }
      const cod = (l.match(/\b\d{9}\b/) || [''])[0];
      let resto = cod ? l.replace(cod, ' ') : l;
      const m = resto.match(/^(.*?)\s+(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*$/);
      const manual = !daPlanilha.has(l);
      return m ? { nome: m[1].trim(), total: money(m[2]), codigo: cod, manual } : { nome: resto.replace(/\s+/g, ' ').trim(), total: null, codigo: cod, manual };
    });
    if (!fila.length) { alert('Cole ao menos um nome.'); return; }
    if (S && S.resultados && S.resultados.length && !confirm('Já existe um andamento guardado (' + S.resultados.length + ' resultado(s)). Começar uma lista nova apaga isso. Dica: use "Copiar relatório" antes, ou "Continuar de onde parou". Apagar e começar de novo?')) return;
    const nMao = fila.filter(x => x.manual).length;
    if (sel.value === '3' && !confirm('Vai dar baixa (finalizar a venda) em até ' + fila.length + ' pedido(s). Não dá para desfazer.' + (nMao ? '\n\n' + nMao + ' deles foram colocados à mão: para esses o valor NÃO é conferido (você já verificou). Os da planilha continuam conferindo o valor e param se não bater.' : '') + '\n\nContinuar?')) return;
    PARAR = false;
    S = { rodando: true, nivel: parseInt(sel.value, 10), fila, i: 0, fase: 'busca', atual: null, urlPend: location.href, resultados: [], log: [] };
    manterAcordado(); await salvar(); desenharControles(); loop();
  }, 'primario'));
  if (S) {
    if (S.resultados && S.resultados.length) corpoEl.append(btn('Copiar relatório', () => { navigator.clipboard.writeText('Cliente\tResultado\tDetalhe\tHora\n' + relatorio()); say('Relatório copiado (' + S.resultados.length + ' linhas).'); }));
    corpoEl.append(btn('Limpar', async () => { await store.del(); S = null; linhaEl.textContent = ''; desenharControles(); }));
  }
};

// ---------- leitura das telas
const ehPdv = () => !!lerTotais() || (/PDV Premium/i.test(document.body.innerText) && [...document.querySelectorAll('button')].some(b => nt(txt(b)).includes('finalizar venda')));
const achaBotao = t => [...document.querySelectorAll('button')].find(b => visivel(b) && nt(txt(b)).includes(t));
const ehPend = () => [...document.querySelectorAll('table')].some(t => t.getClientRects().length && /c[oó]digo/i.test(t.innerText) && /cliente/i.test(t.innerText));
const lerTotais = () => {
  const m = document.body.innerText.replace(/\s+/g, ' ').match(/TOTAL\s*R\$\s*([\d.,]+)\s*PAGO\s*R\$\s*([\d.,]+)\s*RESTANTE\s*R\$\s*([\d.,]+)/i);
  return m ? { total: money(m[1]), pago: money(m[2]), restante: money(m[3]) } : null;
};
const linhasTabela = () => {
  const t = [...document.querySelectorAll('table')].find(x => /c[oó]digo/i.test(x.innerText) && /cliente/i.test(x.innerText));
  if (!t) return [];
  const ths = [...t.querySelectorAll('thead th, tr:first-child th')].map(h => nt(txt(h)));
  const ic = ths.findIndex(x => x.includes('codigo')), icl = ths.findIndex(x => x.includes('cliente')), itt = ths.findIndex(x => x === 'total'), idd = ths.findIndex(x => x === 'data');
  return [...t.querySelectorAll('tbody tr')].map(tr => {
    const td = [...tr.children]; if (td.length < 4) return null;
    return { tr, codigo: txt(td[ic < 0 ? 0 : ic]), cliente: txt(td[icl < 0 ? 1 : icl]), total: money(txt(td[itt < 0 ? 2 : itt])), data: txt(td[idd < 0 ? 3 : idd]) };
  }).filter(r => r && /\d{5,}/.test(r.codigo));
};
const achaBusca = () => document.querySelector('.dataTables_filter input') || [...document.querySelectorAll('input[type="search"], input[type="text"]')].find(i => visivel(i) && !i.closest('#baixa-hubii'));
const buscar = async nome => {
  const inp = await esperar(achaBusca, 20); if (!inp) throw new Error('não achei a caixa de busca da Pendências');
  setValor(inp, ''); await sleep(700);
  setValor(inp, nome);
  let ant = '', est = 0;
  for (let k = 0; k < 40 && est < 3; k++) { await sleep(400); const a = linhasTabela().map(r => r.codigo).join(','); est = a === ant ? est + 1 : 0; ant = a; if (PARAR) throw new Error('parado'); }
  return linhasTabela();
};
const escolher = (rows, item) => {
  const alvo = norm(limpaNome(item.nome));
  let c = rows.filter(r => { const n = norm(r.cliente); return n === alvo || n.includes(alvo) || alvo.includes(n); });
  if (item.codigo) return c.filter(r => r.codigo === item.codigo);
  if (c.length > 1 && item.total !== null && item.total !== undefined) { const m = c.filter(r => igual(r.total, item.total)); if (m.length) c = m; }
  return c;
};
const acharIconeHubii = tr => {
  const e = tr.querySelector('img[src*="hubii" i], img[alt*="hubii" i], [title*="hubii" i], [class*="hubii" i], a[href*="hubii" i]');
  return e || null;
};
const proximo = async (item, res, det) => {
  await resultado(item, res, det);
  S.i++; S.fase = 'busca'; S.atual = null; S.tentaPdv = 0; await salvar();
};
const paraPendencias = async () => { await salvar(); if (!ehPend()) { location.href = S.urlPend; await sleep(60000); } };
const parar = async m => { S.rodando = false; if (S.fase !== 'parado') S.faseParou = S.fase; S.fase = 'parado'; S.motivo = m; await say(m); desenharControles(); };

// ---------- etapas
const etapaBusca = async () => {
  if (S.i >= S.fila.length) { S.rodando = false; S.fase = 'fim'; await say('Fim. ' + S.resultados.filter(r => r.res === 'baixado').length + ' baixado(s) de ' + S.fila.length + '. Veja "Copiar relatório".'); desenharControles(); return; }
  if (!ehPend()) { await esperar(ehPend, 25); if (!ehPend()) { location.href = S.urlPend; await sleep(60000); return; } }
  const item = S.fila[S.i];
  if (!S.itemT0) S.itemT0 = Date.now();
  await say('(' + (S.i + 1) + '/' + S.fila.length + ') Buscando ' + item.nome + '...');
  const rows = await buscar(limpaNome(item.nome));
  const c = escolher(rows, item);
  if (c.length === 0) return proximo(item, 'pulado', 'não achei na Pendências' + (rows.length ? ' (' + rows.length + ' linha(s) de outros nomes)' : ''));
  if (c.length > 1) return proximo(item, 'pulado', 'ambíguo: ' + c.length + ' linhas (' + c.map(r => r.codigo + ' ' + fmt(r.total || 0)).join(', ') + '). Passe o código da pendência na lista.');
  const r = c[0];
  const ic = acharIconeHubii(r.tr);
  if (!ic) return proximo(item, 'pulado', 'a linha ' + r.codigo + ' não tem ícone do Hubii');
  S.atual = { codigo: r.codigo, total: r.total, cliente: r.cliente, data: r.data };
  S.urlPend = location.href; S.fase = 'pdv'; if (!S.tentaPdv) S.tentaPdv = 0; await salvar();
  await say('Abrindo a venda ' + r.codigo + ' (' + (r.total === null ? '?' : fmt(r.total)) + ')...');
  clicavel(ic).click();
  await sleep(2000);
};
const acharPgtoHubii = () => {
  const ancora = folhas(document.body, n => n === 'forma de pagamento')[0];
  let col = ancora; while (col && col.parentElement && !/subtotal/i.test(col.innerText)) col = col.parentElement;
  col = col || document.body;
  return folhas(col, n => n === 'hubii')[0] || null;
};
const etapaPdv = async () => {
  const item = S.fila[S.i];
  if (!await esperar(ehPdv, 40)) { const nf = [...document.querySelectorAll('button')].filter(b => nt(txt(b)).includes('finalizar')).length; await parar('Não reconheci a tela do PDV. Parei. [v4; "PDV Premium" no texto: ' + (/PDV Premium/i.test(document.body.innerText) ? 'sim' : 'não') + '; botões "finalizar": ' + nf + '; TOTAL/PAGO/RESTANTE lidos: ' + (lerTotais() ? 'sim' : 'não') + '; aba ' + (document.hidden ? 'em segundo plano' : 'em primeiro plano') + ']'); return; }
  await sleep(1500);
  const t = lerTotais();
  if (!t) { await parar('Não consegui ler TOTAL/PAGO/RESTANTE no PDV. Parei.'); return; }
  if (t.pago > 0.004) { await parar('O PDV já tem pagamento registrado (' + fmt(t.pago) + '). Parei para não pagar duas vezes.'); return; }
  const ref = item.total;
  const confere = (ref !== null && ref !== undefined) ? (igual(t.total, ref) || igual(S.atual.total, ref)) : igual(t.total, S.atual.total);
  if (!confere && item.manual) { S.atual.aMao = true; await say('Colocado à mão: valor não confere (PDV ' + fmt(t.total) + ', pendência ' + (S.atual.total === null ? '?' : fmt(S.atual.total)) + '), mas sigo com o valor do PDV.'); }
  else if (!confere) {
    const m = 'total do PDV ' + fmt(t.total) + ', pendência ' + (S.atual.total === null ? '?' : fmt(S.atual.total)) + (ref !== null && ref !== undefined ? ', lista ' + fmt(ref) : ' (sem total na lista)') + ': nenhum bate';
    await say(m + '. Pulando.');
    await proximo(item, 'pulado', m);
    location.href = S.urlPend; await sleep(60000); return;
  }
  S.atual.pdv = t.total; await salvar();
  if (confere && !igual(t.total, S.atual.total)) await say('Pendência ' + fmt(S.atual.total || 0) + ' e PDV ' + fmt(t.total) + ' diferem (frete/repasse), mas a lista confere. Seguindo com o valor do PDV.');
  if (S.nivel === 1) {
    await say('Teste 1 ok: PDV com total ' + fmt(t.total) + ' confere com a lista.');
    await proximo(item, 'teste 1 ok', 'PDV ' + fmt(t.total) + ' / pendência ' + (S.atual.total === null ? '?' : fmt(S.atual.total)) + '; não paguei');
    location.href = S.urlPend; await sleep(60000); return;
  }
  let h = acharPgtoHubii();
  if (!h) {
    const mais = folhas(document.body, n => n.includes('mais opcoes'))[0];
    if (mais) { clicavel(mais).click(); await sleep(800); }
    h = await esperar(acharPgtoHubii, 6);
  }
  if (!h) { await parar('Não achei o botão de pagamento "Hubii". Parei.'); return; }
  const achaModal = () => achaTitulo('pagamento em hubii') || (folhas(document.body, n => n === 'conta bancaria')[0] && folhas(document.body, n => n === 'valor')[0] ? folhas(document.body, n => n === 'valor')[0] : null);
  let modal = achaModal();
  if (!modal) {
    await say('Selecionando pagamento Hubii...');
    clicavel(h).click();
    modal = await esperar(achaModal, 12);
    if (!modal && !document.hidden) { await say('A janela do Hubii está demorando; clicando de novo e esperando mais um pouco...'); clicavel(h).click(); modal = await esperar(achaModal, 35); }
  } else await say('A janela "Pagamento em Hubii" já estava aberta; seguindo.');
  if (!modal) {
    const achados = [...document.body.querySelectorAll('*')].filter(e => !e.closest('#baixa-hubii') && nt(txt(e)).length <= 70 && nt(txt(e)).includes('pagamento em hubii'));
    const estilo = e => { if (!e) return ''; const c = getComputedStyle(e); return (e.tagName || '').toLowerCase() + ' vis=' + c.visibility + ' op=' + c.opacity + ' disp=' + c.display + ' rects=' + e.getClientRects().length; };
    const ult = achados[achados.length - 1];
    await parar('A janela "Pagamento em Hubii" não abriu em ~45s. Parei. [v5; aba ' + (document.hidden ? 'em segundo plano' : 'em primeiro plano') + '; estado=' + document.visibilityState + '; foco=' + (document.hasFocus() ? 'sim' : 'não') + '; textos "pagamento em hubii": ' + achados.length + (achados[0] ? '; 1º: ' + estilo(achados[0]) : '') + (ult && ult !== achados[0] ? '; último: ' + estilo(ult) : '') + ']'); return;
    return;
  }
  await sleep(600);
  const aPagar = t.restante;
  const campo = await esperarCampoValor(achaModal, modal, aPagar, 15);
  if (!campo.ok) {
    await parar('O valor na janela de pagamento (' + (campo.inp ? campo.inp.value : 'não achei o campo') + ') não é o RESTANTE ' + fmt(aPagar) + '. Parei. [esperei 15 s; campos visíveis: ' + campo.entradas.length + '; rótulo "Valor": ' + (campo.rotulo ? 'achado' : 'não achado') + '; botão Confirmar: ' + (campo.confirmar ? 'achado' : 'não achado') + ']');
    return;
  }
  const raiz = campo.raiz, inp = campo.inp;
  const botoesConf = () => [...raiz.querySelectorAll('button')].filter(b => visivel(b) && nt(txt(b)).startsWith('confirmar') && !nt(txt(b)).includes('finalizar'));
  const ok = botoesConf().find(b => nt(txt(b)).includes('enter')) || botoesConf()[0];
  if (!ok) { await parar('Botão Confirmar da janela de pagamento não encontrado. Parei.'); return; }
  const confirmou = () => { const x = lerTotais(); return x && igual(x.pago, t.total) && x.restante < 0.005; };
  const clicaReal = b => { ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(tp => b.dispatchEvent(new MouseEvent(tp, { bubbles: true, cancelable: true, view: window }))); };
  await say('Confirmando o valor ' + fmt(aPagar) + ' (botão "' + txt(ok) + '")...');
  ok.click();
  let pago = await esperar(confirmou, 5);
  if (!pago && visivel(ok)) { clicaReal(ok); pago = await esperar(confirmou, 5); }
  if (!pago && visivel(ok)) {
    inp.focus();
    ['keydown', 'keypress', 'keyup'].forEach(tp => inp.dispatchEvent(new KeyboardEvent(tp, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })));
    pago = await esperar(confirmou, 6);
  }
  if (!pago) { await parar('Depois de confirmar, PAGO não ficou igual ao TOTAL. Parei sem finalizar.'); return; }
  if (S.nivel === 2) {
    await say('Teste 2 ok: pagamento Hubii de ' + fmt(t.total) + ' lançado. NÃO finalizei. Revise a tela; para desfazer use Cancelar do PDV.');
    await resultado(item, 'teste 2 ok', 'pagamento lançado, não finalizado');
    S.rodando = false; S.fase = 'testefim'; await salvar(); desenharControles(); return;
  }
  const fin = await esperar(() => { const b = achaBotao('finalizar venda'); return b && !b.disabled ? b : null; }, 10);
  if (!fin) { await parar('"Finalizar venda" não habilitou. Parei.'); return; }
  await say('Finalizando a venda...');
  fin.click();
  const canal = await esperar(() => achaTitulo('canal de vendas', true) || achaTitulo('canal de vendas'), 30);
  if (!canal) { await parar('A janela "Canal de Vendas" não abriu. Parei.'); return; }
  await sleep(700);
  const card = folhas(document.body, (n, e) => n === 'hubii' && !!e.closest('[role="dialog"], .modal, [class*="modal" i], [class*="dialog" i]'))[0] || folhas(document.body, n => n === 'hubii').slice(-1)[0];
  if (!card) { await parar('Não achei o canal "Hubii". Parei.'); return; }
  clicavel(card).click();
  await sleep(800);
  let raizCanal = canal; while (raizCanal && raizCanal.parentElement && ![...raizCanal.querySelectorAll('button')].some(b => nt(txt(b)).includes('confirmar e finalizar'))) raizCanal = raizCanal.parentElement;
  const conf = [...(raizCanal || document).querySelectorAll('button')].filter(b => visivel(b) && nt(txt(b)).includes('confirmar e finalizar')).slice(-1)[0];
  if (!conf) { await parar('Botão "Confirmar e Finalizar" não encontrado. Parei.'); return; }
  S.fase = 'verifica'; await salvar();
  conf.click();
  await esperar(() => !folhas(document.body, n => n === 'canal de vendas')[0], 40);
  await sleep(4000);
  location.href = S.urlPend; await sleep(60000);
};
const etapaVerifica = async () => {
  const item = S.fila[S.i];
  if (!ehPend()) { await esperar(ehPend, 25); if (!ehPend()) { location.href = S.urlPend; await sleep(60000); return; } }
  await say('Conferindo se ' + item.nome + ' saiu da Pendências...');
  const rows = await buscar(limpaNome(item.nome));
  if (rows.some(r => r.codigo === S.atual.codigo)) { await resultado(item, 'ATENÇÃO', 'a venda ' + S.atual.codigo + ' continua na Pendências depois de finalizar'); await parar('ATENÇÃO: a venda ' + S.atual.codigo + ' ainda está na Pendências. Parei; confira à mão.'); return; }
  await proximo(item, 'baixado', 'venda ' + S.atual.codigo + ' pago ' + fmt(S.atual.pdv || S.atual.total || 0) + (S.atual.pdv && !igual(S.atual.pdv, S.atual.total) ? ' (pendência ' + fmt(S.atual.total || 0) + ')' : '') + (S.atual.aMao ? ' [colocado à mão: valor não conferido]' : ''));
};
const loop = async () => {
  manterAcordado();
  if (ocupado) return; ocupado = true;
  try {
    while (S && S.rodando && !PARAR) {
      if (S.fase === 'busca') await etapaBusca();
      else if (S.fase === 'pdv') { if (ehPdv() || !ehPend()) await etapaPdv(); else { await sleep(6000); if (ehPdv()) continue; if (ehPend()) { S.tentaPdv = (S.tentaPdv || 0) + 1; if (S.tentaPdv > 2) { await parar('O clique no ícone do Hubii não abriu o PDV (tentei 3 vezes). Parei.'); } else { await say('O PDV não abriu; procurando o cliente de novo (tentativa ' + (S.tentaPdv + 1) + ' de 3)...'); S.fase = 'busca'; await salvar(); } } } }
      else if (S.fase === 'verifica') await etapaVerifica();
      else break;
    }
  } catch (e) {
    if (e.message !== 'parado') { console.error(e); if (S) { S.rodando = false; await say('Erro: ' + e.message); desenharControles(); } }
  } finally { ocupado = false; }
};
(async () => {
  S = await store.get();
  montarPainel();
  if (S) linhaEl.textContent = S.status || '';
  desenharControles();
  if (S && S.rodando) { await sleep(1500); loop(); }
})();
})();
