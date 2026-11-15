// Registro de desempenho da Central Hubii: cronometra cada rotina e monta o relatório.
// Os eventos ficam em chrome.storage.local (compartilhado entre Hubii e OnePet), um por chave "ev_<hora>_<sorteio>".
(() => {
if (window.__centralReg) return;
const DEF = { desc: 45, etq: 30, analise: 180, baixa: 120, dia: 8 };
const KB = 'central_base';
const stGet = k => new Promise(r => { try { chrome.storage.local.get(k, o => r(o || {})); } catch (e) { r({}); } });
const stSet = o => new Promise(r => { try { chrome.storage.local.set(o, () => r()); } catch (e) { r(); } });
const stDel = ks => new Promise(r => { try { chrome.storage.local.remove(ks, () => r()); } catch (e) { r(); } });

const add = ev => { try { const k = 'ev_' + ev.t + '_' + Math.random().toString(36).slice(2, 7); return stSet({ [k]: ev }); } catch (e) { return Promise.resolve(); } };
const dur = ms => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return s + ' s';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' min ' + String(s % 60).padStart(2, '0') + ' s';
  return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min';
};
const diasTxt = (ms, h) => { const d = ms / (3600000 * (h || 8)); return (d >= 10 ? Math.round(d) : Math.round(d * 10) / 10).toString().replace('.', ',') + (Math.abs(d - 1) < 0.05 ? ' dia' : ' dias') + ' de trabalho de ' + (h || 8) + ' h'; };
const hhmm = t => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dia = t => new Date(t).toLocaleDateString('pt-BR');
const ymd = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

const carregar = async () => {
  const todo = await stGet(null);
  const eventos = Object.keys(todo).filter(k => k.startsWith('ev_')).map(k => Object.assign({ _k: k }, todo[k])).filter(e => e && e.t);
  const base = Object.assign({}, DEF, todo[KB] || {});
  return { eventos, base };
};

// ---------- cálculo
const NOMES = { descritivos: 'Descritivos (faturar + imprimir)', etiquetas: 'Etiquetas', analise: 'Análise das pendências (coleta + Painel + OneHub)', baixa: 'Baixas no OnePet' };
const calcular = (eventos, base, de, ate) => {
  const ev = eventos.filter(e => e.t >= de && e.t <= ate).sort((a, b) => a.t - b.t);
  const L = { descritivos: { n: 0, ms: 0 }, etiquetas: { n: 0, ms: 0 }, analise: { n: 0, ms: 0 }, baixa: { n: 0, ms: 0 } };
  let evitados = 0; const execs = []; const dias = {};
  const d0 = t => (dias[ymd(t)] = dias[ymd(t)] || { t, descritivos: { n: 0, ms: 0 }, etiquetas: { n: 0, ms: 0 }, analise: { n: 0, ms: 0 }, baixa: { n: 0, ms: 0 } });
  ev.forEach(e => {
    let linha = null, ms = 0, n = 0;
    if (e.k === 'descritivos' || e.k === 'etiquetas') { linha = e.k; ms = e.t - e.t0; n = e.n || 0; evitados += e.evit || 0; execs.push({ k: e.k, ini: e.t0, fim: e.t, n, ms, pul: e.pul || 0, parado: !!e.parado }); }
    else if (e.k === 'coleta' || e.k === 'verificar' || e.k === 'onehub') { linha = 'analise'; ms = e.t - e.t0; n = e.k === 'verificar' ? (e.n || 0) : 0; execs.push({ k: e.k, ini: e.t0, fim: e.t, n: e.n || 0, ms, pul: 0, parado: false }); }
    else if (e.k === 'baixa' && !/^teste/i.test(e.res || '')) { linha = 'baixa'; ms = e.ms || 0; n = e.res === 'baixado' ? 1 : 0; }
    if (!linha) return;
    L[linha].n += n; L[linha].ms += ms;
    const dd = d0(e.t); dd[linha].n += n; dd[linha].ms += ms;
  });
  const man = { descritivos: base.desc, etiquetas: base.etq, analise: base.analise, baixa: base.baixa };
  let tAuto = 0, tMan = 0;
  Object.keys(L).forEach(k => { L[k].man = L[k].n * man[k] * 1000; tAuto += L[k].ms; tMan += L[k].man; });
  const lista = Object.keys(dias).sort().map(k => { const d = dias[k]; let a = 0, m = 0; Object.keys(L).forEach(x => { a += d[x].ms; m += d[x][x === 'descritivos' ? 'n' : 'n'] * man[x] * 1000; }); return { k, t: d.t, d, auto: a, man: m }; });
  let acc = 0; lista.forEach(x => { acc += x.man - x.auto; x.acc = acc; });
  const sem = {};
  lista.forEach(x => {
    const dt = new Date(x.t); dt.setHours(0, 0, 0, 0); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const k = ymd(dt.getTime()); const w = sem[k] = sem[k] || { t: dt.getTime(), desc: 0, etq: 0, an: 0, bx: 0, auto: 0, man: 0, dias: 0, acc: 0 };
    w.desc += x.d.descritivos.n; w.etq += x.d.etiquetas.n; w.an += x.d.analise.n; w.bx += x.d.baixa.n; w.auto += x.auto; w.man += x.man; w.dias++; w.acc = x.acc;
  });
  return { L, tAuto, tMan, evitados, execs, dias: lista, semanas: Object.keys(sem).sort().map(k => sem[k]), total: ev.length };
};

// ---------- texto e HTML
const CSS = `
.cr, .cr * { box-sizing: border-box; font-family: Segoe UI, Arial, sans-serif; }
.cr { color: #1b1740; font-size: 13px; }
.cr h3 { margin: 14px 0 6px; font-size: 14px; color: #2d254d; }
.cr table { width: 100%; border-collapse: collapse; margin: 4px 0 8px; }
.cr th { text-align: left; background: #2d254d; color: #fff; padding: 6px 8px; font-size: 12px; }
.cr td { padding: 5px 8px; border-bottom: 1px solid #e3e0f0; }
.cr td.n, .cr th.n { text-align: right; white-space: nowrap; }
.cr tr.tot td { font-weight: 700; background: #f1eefb; }
.cr .dest { display: flex; gap: 10px; flex-wrap: wrap; margin: 8px 0; }
.cr .card { flex: 1 1 170px; background: #f6f5fc; border: 1px solid #ddd8f2; border-radius: 8px; padding: 10px 12px; }
.cr .card b { display: block; font-size: 20px; color: #3a1f6d; margin-top: 2px; }
.cr .card.v b { color: #0b6a2a; }
.cr .nota { font-size: 12px; color: #5a5480; margin: 6px 0; }
`;
const tabelaLinhas = m => {
  const L = m.L;
  return ['descritivos', 'etiquetas', 'analise', 'baixa'].map(k => {
    const x = L[k]; const eco = x.man - x.ms;
    return '<tr><td>' + NOMES[k] + '</td><td class="n">' + x.n + '</td><td class="n">' + dur(x.ms) + '</td><td class="n">' + dur(x.man) + '</td><td class="n">' + (x.n ? dur(eco > 0 ? eco : 0) : '-') + '</td><td class="n">' + (x.n ? dur(x.ms / x.n) : '-') + '</td></tr>';
  }).join('');
};
const horas1 = ms => (Math.round(ms / 360000) / 10).toString().replace('.', ',');
const diasUteisMes = (ano, mes) => { let n = 0; const f = new Date(ano, mes + 1, 0).getDate(); for (let d = 1; d <= f; d++) { const w = new Date(ano, mes, d).getDay(); if (w !== 0 && w !== 6) n++; } return n; };
const grafico = (m, base) => {
  const ds = m.dias; if (!ds.length) return '';
  const W = 860, H = 230, pl = 46, pr = 16, pt = 14, pb = 34;
  const hd = (base.dia || 8) * 3600000;
  const accMax = Math.max(hd, ...ds.map(x => Math.max(0, x.acc)));
  const topo = Math.ceil(accMax / hd) * hd, iw = W - pl - pr, ih = H - pt - pb;
  const X = i => pl + (ds.length === 1 ? iw / 2 : (i + 0.5) * iw / ds.length), Y = v => pt + ih - ih * Math.max(0, v) / topo;
  const bw = Math.max(3, Math.min(26, iw / ds.length * 0.6));
  let o = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;max-width:' + W + 'px" role="img" aria-label="Tempo liberado por dia e acumulado no período">';
  const passo = Math.max(1, Math.ceil(topo / hd / 6));
  for (let k = 0; k <= topo / hd; k += passo) { const y = Y(k * hd); o += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '" stroke="' + (k ? '#c9c3e6' : '#8a84ab') + '" stroke-dasharray="' + (k ? '4 4' : '0') + '"/><text x="' + (pl - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="#5a5480">' + (k ? k + (k === 1 ? ' dia' : ' dias') : '0') + '</text>'; }
  ds.forEach((x, i) => { const lib = Math.max(0, x.man - x.auto); o += '<rect x="' + (X(i) - bw / 2) + '" y="' + Y(lib) + '" width="' + bw + '" height="' + Math.max(0, pt + ih - Y(lib)) + '" fill="#b9b2dc"><title>' + dia(x.t) + ': liberou ' + dur(lib) + '</title></rect>'; });
  o += '<polyline fill="none" stroke="#0b6a2a" stroke-width="2.5" points="' + ds.map((x, i) => X(i) + ',' + Y(x.acc)).join(' ') + '"/>';
  ds.forEach((x, i) => { o += '<circle cx="' + X(i) + '" cy="' + Y(x.acc) + '" r="3" fill="#0b6a2a"><title>' + dia(x.t) + ': acumulado ' + dur(Math.max(0, x.acc)) + '</title></circle>'; });
  const cada = Math.max(1, Math.ceil(ds.length / 15));
  ds.forEach((x, i) => { if (i % cada === 0 || i === ds.length - 1) o += '<text x="' + X(i) + '" y="' + (H - 14) + '" text-anchor="middle" font-size="11" fill="#5a5480">' + new Date(x.t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + '</text>'; });
  o += '</svg>';
  return '<h3>Tempo liberado por dia (barras) e acumulado (linha verde)</h3>' + o + '<div class="nota">As linhas tracejadas marcam dias inteiros de trabalho de ' + (base.dia || 8) + ' h liberados. A linha verde é a soma do que já foi poupado desde o início do período.</div>';
};
const faixaMensal = (m, base) => {
  const eco = Math.max(0, m.tMan - m.tAuto); const n = m.dias.length;
  const L = m.L; let t = '<div style="background:#eaf6ee;border:1px solid #b7dcc2;border-radius:8px;padding:12px 14px;margin:8px 0;color:#0b3d1a"><div style="font-size:15px"><b>Fechamento do ' + m.mensal.rot + ':</b> a Central liberou <b>' + dur(eco) + '</b> de trabalho (' + horas1(eco) + ' h), o que equivale a <b>' + diasTxt(eco, base.dia) + '</b>.</div>';
  t += '<div style="margin-top:4px">Foram ' + L.descritivos.n + ' descritivos, ' + L.etiquetas.n + ' etiquetas, ' + L.analise.n + ' pendências analisadas e ' + L.baixa.n + ' baixas, em ' + n + ' dia(s) com uso' + (n ? '; média de ' + dur(eco / n) + ' liberados por dia de uso' : '') + '.</div>';
  if (m.mensal.proj) t += '<div style="margin-top:4px">Projeção (estimativa): mantendo esse ritmo nos ' + m.mensal.proj.uteis + ' dias úteis do mês, o total chega a cerca de <b>' + diasTxt(m.mensal.proj.ms, base.dia) + '</b>.</div>';
  return t + '</div>';
};
const tabelaSemanas = (m, base) => {
  if (m.semanas.length < 2) return '';
  const r = m.semanas.map(w => '<tr><td>Semana de ' + dia(w.t).slice(0, 5) + '</td><td class="n">' + w.dias + '</td><td class="n">' + w.desc + '</td><td class="n">' + w.etq + '</td><td class="n">' + w.an + '</td><td class="n">' + w.bx + '</td><td class="n">' + dur(w.auto) + '</td><td class="n">' + dur(w.man) + '</td><td class="n">' + dur(Math.max(0, w.man - w.auto)) + '</td><td class="n">' + diasTxt(Math.max(0, w.acc), base.dia).replace(/ de trabalho de .*$/, '') + '</td></tr>').join('');
  return '<h3>Por semana</h3><table><tr><th>Semana</th><th class="n">Dias de uso</th><th class="n">Descrit.</th><th class="n">Etiq.</th><th class="n">Análises</th><th class="n">Baixas</th><th class="n">Automático</th><th class="n">À mão</th><th class="n">Liberado</th><th class="n">Acumulado</th></tr>' + r + '</table>';
};
const corpoHtml = (m, base, titulo) => {
  const eco = Math.max(0, m.tMan - m.tAuto);
  const exec = m.execs.map(e => '<tr><td>' + dia(e.ini) + '</td><td>' + ({ descritivos: 'Descritivos', etiquetas: 'Etiquetas', coleta: 'Coleta de pendências', verificar: 'Verificação no Painel Hubii', onehub: 'Consulta no OneHub' }[e.k]) + '</td><td>' + hhmm(e.ini) + ' a ' + hhmm(e.fim) + '</td><td class="n">' + e.n + (e.pul ? ' (+' + e.pul + ' pulados)' : '') + '</td><td class="n">' + dur(e.ms) + '</td><td>' + (e.parado ? 'parada antes do fim' : 'concluída') + '</td></tr>').join('');
  const dd = m.dias.map(x => '<tr><td>' + dia(x.t) + '</td><td class="n">' + x.d.descritivos.n + '</td><td class="n">' + x.d.etiquetas.n + '</td><td class="n">' + x.d.analise.n + '</td><td class="n">' + x.d.baixa.n + '</td><td class="n">' + dur(x.auto) + '</td><td class="n">' + dur(x.man) + '</td><td class="n">' + dur(Math.max(0, x.man - x.auto)) + '</td><td class="n">' + dur(Math.max(0, x.acc)) + '</td></tr>').join('');
  return '<div class="cr">' + (titulo ? '<h2 style="margin:0 0 4px;color:#2d254d">' + titulo + '</h2>' : '') +
    '<div class="dest"><div class="card">Tempo gasto pela automação<b>' + dur(m.tAuto) + '</b></div><div class="card">Tempo de uma pessoa fazendo à mão (estimado)<b>' + dur(m.tMan) + '</b></div><div class="card v">Tempo liberado<b>' + dur(eco) + '</b>' + (eco >= 3600000 ? 'equivale a ' + diasTxt(eco, base.dia) : 'em horas de trabalho') + '</div><div class="card v">Repetições evitadas<b>' + m.evitados + '</b>pedidos já impressos/faturados que a lista bloqueou</div></div>' +
    (m.mensal ? faixaMensal(m, base) : '') + grafico(m, base) + '<h3>Resumo por atividade</h3><table><tr><th>Atividade</th><th class="n">Itens</th><th class="n">Tempo automático</th><th class="n">À mão (estimado)</th><th class="n">Economia</th><th class="n">Média por item</th></tr>' + tabelaLinhas(m) +
    '<tr class="tot"><td>Total</td><td class="n">' + (m.L.descritivos.n + m.L.etiquetas.n + m.L.analise.n + m.L.baixa.n) + '</td><td class="n">' + dur(m.tAuto) + '</td><td class="n">' + dur(m.tMan) + '</td><td class="n">' + dur(eco) + '</td><td class="n"></td></tr></table>' +
    '<div class="nota">Tempo automático é medido: descritivos e etiquetas contam só a partir do "Confirmar" de cada lista (não contam a conferência nem o intervalo entre as duas rotinas); as baixas somam o tempo de cada cliente. Tempo à mão é uma estimativa por item: descritivo ' + base.desc + ' s, etiqueta ' + base.etq + ' s, análise de cada pendência ' + base.analise + ' s, baixa ' + base.baixa + ' s. Itens da análise = pendências verificadas no Painel. Dias de trabalho = tempo liberado dividido por ' + base.dia + ' h.</div>' +
    tabelaSemanas(m, base) + '<h3>Por dia (Análises = pendências analisadas; Liberado = à mão menos automático)</h3><table><tr><th>Dia</th><th class="n">Descrit.</th><th class="n">Etiq.</th><th class="n">Análises</th><th class="n">Baixas</th><th class="n">Automático</th><th class="n">À mão</th><th class="n">Liberado</th><th class="n">Acumulado</th></tr>' + (dd || '<tr><td colspan="9">Sem registros neste período.</td></tr>') + '</table>' +
    '<h3>Execuções registradas</h3><table><tr><th>Dia</th><th>Rotina</th><th>Início e fim</th><th class="n">Itens</th><th class="n">Duração</th><th>Situação</th></tr>' + (exec || '<tr><td colspan="6">Sem execuções neste período.</td></tr>') + '</table>' +
    '<div class="nota">Cada pedido repetido que a memória bloqueou é um clique a menos no pedido errado: com a lista guardada, o risco de reimprimir ou refaturar à mão é praticamente nulo.</div></div>';
};
const textoPlano = (m, base, rotuloPeriodo) => {
  const L = m.L; const eco = Math.max(0, m.tMan - m.tAuto);
  const l = k => NOMES[k] + ': ' + L[k].n + ' item(ns); automático ' + dur(L[k].ms) + '; à mão (estimado) ' + dur(L[k].man) + (L[k].n ? '; média ' + dur(L[k].ms / L[k].n) + ' por item' : '');
  return ['Relatório de desempenho: Central Hubii (' + rotuloPeriodo + ')', ''].concat(m.mensal ? ['Fechamento: liberou ' + dur(eco) + ' (' + diasTxt(eco, base.dia) + ') em ' + m.dias.length + ' dia(s) de uso.', ''] : []).concat([
    l('descritivos'), l('etiquetas'), l('analise'), l('baixa'), '',
    'Tempo automático total: ' + dur(m.tAuto), 'Tempo à mão estimado: ' + dur(m.tMan), 'Tempo liberado: ' + dur(eco) + ' (' + diasTxt(eco, base.dia) + ')', 'Repetições evitadas pela lista: ' + m.evitados, '',
    'Premissas à mão (s/item): descritivo ' + base.desc + ', etiqueta ' + base.etq + ', análise ' + base.analise + ', baixa ' + base.baixa + '; dia de trabalho ' + base.dia + ' h']).join('\n');
};
const csvEventos = ev => 'tipo;inicio;fim;itens;pulados;repeticoes_evitadas;duracao_s;resultado\n' + ev.sort((a, b) => a.t - b.t).map(e => {
  const ini = e.t0 || (e.t - (e.ms || 0)); const fim = e.t;
  return [e.k, new Date(ini).toLocaleString('pt-BR'), new Date(fim).toLocaleString('pt-BR'), e.n == null ? '' : e.n, e.pul || '', e.evit || '', Math.round((fim - ini) / 1000), e.res || (e.parado ? 'parada' : '')].join(';');
}).join('\n');

const baixar = (nome, tipo, conteudo) => {
  const u = URL.createObjectURL(new Blob(['﻿' + conteudo], { type: tipo + ';charset=utf-8' }));
  const a = document.createElement('a'); a.href = u; a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 2000);
};

// ---------- janela do relatório
const abrirRelatorio = async () => {
  const velho = document.getElementById('central-relatorio'); if (velho) velho.remove();
  const fundo = document.createElement('div'); fundo.id = 'central-relatorio';
  fundo.style.cssText = 'position:fixed;inset:0;background:rgba(15,10,40,.62);z-index:2147483647;display:flex;align-items:center;justify-content:center';
  const jan = document.createElement('div');
  jan.style.cssText = 'background:#fff;width:min(940px,95vw);max-height:92vh;border-radius:12px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.45)';
  const st = document.createElement('style'); st.textContent = CSS; jan.appendChild(st);
  const topo = document.createElement('div'); topo.style.cssText = 'background:#2d254d;color:#fff;padding:12px 18px;font:600 17px Segoe UI,Arial,sans-serif;display:flex;justify-content:space-between;align-items:center';
  topo.textContent = 'Relatório de desempenho: Central Hubii';
  const fecha = document.createElement('button'); fecha.textContent = 'Fechar'; fecha.style.cssText = 'cursor:pointer;border:0;border-radius:6px;padding:6px 12px;font-size:13px'; fecha.onclick = () => fundo.remove(); topo.appendChild(fecha);
  const barra = document.createElement('div'); barra.style.cssText = 'padding:10px 18px;background:#f6f5fc;border-bottom:1px solid #ddd;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px;color:#1b1740';
  const corpo = document.createElement('div'); corpo.style.cssText = 'padding:6px 18px 14px;overflow:auto;flex:1';
  const rod = document.createElement('div'); rod.style.cssText = 'padding:10px 18px;border-top:1px solid #ddd;background:#f6f5fc;display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12.5px;color:#1b1740';
  const mkb = (t, f) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'cursor:pointer;border:1px solid #b9b2dc;background:#fff;color:#2d254d;border-radius:6px;padding:7px 12px;font-size:13px'; b.onclick = f; return b; };
  const sel = document.createElement('select'); sel.style.cssText = 'padding:5px;color:#000;background:#fff;border:1px solid #b9b2dc;border-radius:4px';
  [['hoje', 'Hoje'], ['7', 'Últimos 7 dias'], ['mes', 'Este mês'], ['mesant', 'Mês passado'], ['30', 'Últimos 30 dias'], ['tudo', 'Tudo'], ['per', 'Período…']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); });
  sel.value = 'mes';
  const nomeMes = (y, mm) => { const t = new Date(y, mm, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const mesesComDados = ev => { const set = new Set(); ev.forEach(e => { const d = new Date(e.t); set.add(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }); return [...set].sort().reverse(); };
  const di = document.createElement('input'); di.type = 'date'; const df = document.createElement('input'); df.type = 'date';
  [di, df].forEach(i => { i.style.cssText = 'padding:4px;color:#000;background:#fff;border:1px solid #b9b2dc;border-radius:4px;display:none'; });
  barra.append('Período:', sel, di, df);
  const premissas = document.createElement('div'); premissas.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap';
  const campo = (rot, k) => { const i = document.createElement('input'); i.type = 'number'; i.min = 1; i.style.cssText = 'width:62px;padding:4px;color:#000;background:#fff;border:1px solid #b9b2dc;border-radius:4px'; const l = document.createElement('label'); l.append(rot + ' ', i); premissas.appendChild(l); return i; };
  const iDesc = campo('descritivo (s)'), iEtq = campo('etiqueta (s)'), iAn = campo('análise/pendência (s)'), iBx = campo('baixa (s)'), iDia = campo('horas por dia de trabalho');
  let dados = null, ultimo = null;
  const faixa = () => {
    const agora = Date.now(); const ini0 = new Date(); ini0.setHours(0, 0, 0, 0);
    if (sel.value.startsWith('m:')) { const [y, mm] = sel.value.slice(2).split('-').map(Number); const i = new Date(y, mm - 1, 1), f = new Date(y, mm, 1); return [i.getTime(), f.getTime() - 1, 'mês de ' + nomeMes(y, mm - 1).toLowerCase()]; }
    if (sel.value === 'hoje') return [ini0.getTime(), agora, 'hoje'];
    if (sel.value === '7') return [ini0.getTime() - 6 * 864e5, agora, 'últimos 7 dias'];
    if (sel.value === 'mes') { const i = new Date(); i.setDate(1); i.setHours(0, 0, 0, 0); return [i.getTime(), agora, 'mês de ' + i.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })]; }
    if (sel.value === 'mesant') { const i = new Date(); i.setDate(1); i.setHours(0, 0, 0, 0); const f = new Date(i.getTime() - 1); i.setMonth(i.getMonth() - 1); return [i.getTime(), f.getTime(), 'mês de ' + i.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })]; }
    if (sel.value === '30') return [ini0.getTime() - 29 * 864e5, agora, 'últimos 30 dias'];
    if (sel.value === 'per') { const a = di.value ? new Date(di.value + 'T00:00:00').getTime() : 0; const b = df.value ? new Date(df.value + 'T23:59:59').getTime() : agora; return [a, b, (di.value || 'início') + ' a ' + (df.value || 'hoje')]; }
    return [0, agora, 'todo o período registrado'];
  };
  const desenhar = () => {
    const base = { desc: +iDesc.value || DEF.desc, etq: +iEtq.value || DEF.etq, analise: +iAn.value || DEF.analise, baixa: +iBx.value || DEF.baixa, dia: +iDia.value || DEF.dia };
    const [a, b, rot] = faixa();
    const m = calcular(dados.eventos, base, a, b);
    if (sel.value === 'mes' || sel.value === 'mesant' || sel.value.startsWith('m:')) {
      const ini = new Date(a); m.mensal = { rot };
      const atual = ini.getFullYear() === new Date().getFullYear() && ini.getMonth() === new Date().getMonth();
      if (atual && m.dias.length >= 3) { const uteis = diasUteisMes(ini.getFullYear(), ini.getMonth()); const lib = Math.max(0, m.tMan - m.tAuto); m.mensal.proj = { uteis, ms: lib / m.dias.length * uteis }; }
    }
    ultimo = { m, base, rot, a, b };
    corpo.innerHTML = corpoHtml(m, base, '');
    if (!m.total) { const p = document.createElement('div'); p.style.cssText = 'padding:10px;margin:8px 0;background:#fff4d6;border-radius:6px;color:#6b4a00'; p.textContent = 'Ainda não há registros neste período. Os tempos passam a ser gravados a partir do Confirmar de cada rotina (descritivos, etiquetas, coleta, verificação, OneHub e baixas).'; corpo.prepend(p); }
  };
  const recarregar = async () => { dados = await carregar();
    [...sel.querySelectorAll('option[data-mes]')].forEach(o => o.remove());
    const ref = [...sel.options].find(o => o.value === 'tudo');
    mesesComDados(dados.eventos).forEach(k => { const [y, mm] = k.split('-').map(Number); const o = document.createElement('option'); o.value = 'm:' + k; o.dataset.mes = '1'; o.textContent = 'Fechamento: ' + nomeMes(y, mm - 1); sel.insertBefore(o, ref); }); iDesc.value = dados.base.desc; iEtq.value = dados.base.etq; iAn.value = dados.base.analise; iBx.value = dados.base.baixa; iDia.value = dados.base.dia; desenhar(); };
  sel.onchange = () => { di.style.display = df.style.display = sel.value === 'per' ? '' : 'none'; if (dados) desenhar(); };
  di.onchange = df.onchange = () => dados && desenhar();
  [iDesc, iEtq, iAn, iBx, iDia].forEach(i => { i.oninput = () => dados && desenhar(); });
  const salvarBase = mkb('Salvar premissas', async () => { await stSet({ [KB]: { desc: +iDesc.value || DEF.desc, etq: +iEtq.value || DEF.etq, analise: +iAn.value || DEF.analise, baixa: +iBx.value || DEF.baixa, dia: +iDia.value || DEF.dia } }); salvarBase.textContent = 'Salvo'; setTimeout(() => { salvarBase.textContent = 'Salvar premissas'; }, 1500); });
  const bCopia = mkb('Copiar resumo', async () => { try { await navigator.clipboard.writeText(textoPlano(ultimo.m, ultimo.base, ultimo.rot)); bCopia.textContent = 'Copiado'; setTimeout(() => { bCopia.textContent = 'Copiar resumo'; }, 1500); } catch (e) { alert('Não consegui copiar.'); } });
  const bHtml = mkb('Baixar relatório (HTML)', () => baixar('Relatorio-desempenho-Central-Hubii-' + ymd(Date.now()) + '.html', 'text/html', '<!doctype html><meta charset="utf-8"><title>Relatório de desempenho: Central Hubii</title><style>body{margin:24px auto;max-width:960px;font-family:Segoe UI,Arial,sans-serif}' + CSS + '</style>' + corpoHtml(ultimo.m, ultimo.base, 'Relatório de desempenho: Central Hubii (' + ultimo.rot + ')') + '<p class="cr nota">Gerado em ' + new Date().toLocaleString('pt-BR') + '.</p>'));
  const bCsv = mkb('Baixar dados (CSV)', () => baixar('Central-Hubii-registros-' + ymd(Date.now()) + '.csv', 'text/csv', csvEventos(dados.eventos.filter(e => e.t >= ultimo.a && e.t <= ultimo.b))));
  const bLimpa = mkb('Apagar registros', async () => { if (!confirm('Apagar TODOS os registros de desempenho? Não dá para desfazer.')) return; const d = await carregar(); await stDel(d.eventos.map(e => e._k)); await recarregar(); });
  rod.append(premissas, salvarBase, bCopia, bHtml, bCsv, bLimpa);
  jan.append(topo, barra, corpo, rod); fundo.appendChild(jan); document.body.appendChild(fundo);
  fundo.addEventListener('mousedown', e => { if (e.target === fundo) fundo.remove(); });
  await recarregar();
};

// ---------- histórico por pedido (uma chave "h_<pedido>" no armazenamento da extensão)
// Guarda produtos (EAN, nome, quantidade) e as horas de descritivo, etiqueta, reimpressão e conferência, e o código BR.
// O background.js manda os registros novos para o painel local, que guarda tudo num arquivo do computador.
let filaPed = Promise.resolve();
const pedido = (id, campos) => {
  id = String(id || '').replace(/\D/g, '');
  if (!/^\d{5,9}$/.test(id) || !campos) return Promise.resolve();
  filaPed = filaPed.then(async () => {
    const k = 'h_' + id; const o = await stGet(k); const r = Object.assign({ id }, o[k] || {});
    let mudou = !o[k];
    const itens = Array.isArray(campos.itens) ? campos.itens.filter(x => x && x.e) : [];
    if (itens.length && (!Array.isArray(r.itens) || itens.length > r.itens.length || r.itens.some(x => x.q == null))) { r.itens = itens; mudou = true; }
    ['desc', 'etq'].forEach(c => { if (campos[c] && !r[c]) { r[c] = campos[c]; mudou = true; } });   // primeira vez
    ['reimp', 'conf'].forEach(c => { if (campos[c] && campos[c] !== r[c]) { r[c] = campos[c]; mudou = true; } }); // última vez
    if (campos.br && campos.br !== r.br) { r.br = campos.br; mudou = true; }
    if (!mudou) return;
    r.u = Date.now();
    await stSet({ [k]: r });
  }).catch(() => {});
  return filaPed;
};

window.__centralReg = { add, dur, abrirRelatorio, DEF, calcular, corpoHtml, textoPlano, CSS, pedido };
})();
