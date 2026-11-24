/**
 * Central Hubii: planilha na nuvem.
 *
 * COMO USAR (uma vez só):
 *  1. Na planilha do Google: Extensões > Apps Script. Apague o que estiver lá, cole TODO este código e salve (Ctrl+S).
 *  2. Implantar > Nova implantação > tipo "App da Web". Executar como: Eu. Quem pode acessar: Qualquer pessoa. Implantar.
 *     (O Google pede para autorizar: Avançado > Acessar projeto > Permitir.)
 *  3. Copie o "URL do app da Web" e cole na Central (Ajuda e backup > Planilha na nuvem).
 *
 * Só quem tem a CHAVE abaixo consegue gravar ou ler. A Central envia número do pedido, produtos, quantidades e horas.
 * Não envia nome, CPF, endereço nem valor de pedido.
 */
const CHAVE = '__CHAVE__';
const ABA_PEDIDOS = 'Pedidos';
const ABA_DIA = 'Resumo do dia';
const FUSO = 'America/Sao_Paulo';
const CAB_PEDIDOS = ['Loja', 'Pedido', 'Dia', 'Descritivo', 'Etiqueta', 'Reimpressão', 'Conferido', 'Código BR', 'Produtos', 'Unidades', 'Atualizado', 'JSON'];
const CAB_DIA = ['Loja', 'Dia', 'Pedidos (descritivos)', 'Unidades', 'Etiquetas', 'Conferidos', 'Sacola 30x20', 'Sacola 35x45', 'Sacola 45x50', 'Sacola 50x60', 'Sem sacola'];
const COL_JSON = CAB_PEDIDOS.length - 1;
const ABA_EVENTOS = 'Eventos';
const ABA_DESEMP_DIA = 'Desempenho por dia';
const ABA_DESEMP_MES = 'Desempenho por mês';
const CAB_EVENTOS = ['Loja', 'Chave', 'Dia', 'Rotina', 'Início', 'Fim', 'Duração (s)', 'Itens', 'JSON'];
const COL_EV_JSON = CAB_EVENTOS.length - 1;
const CAB_DESEMP_DIA = ['Loja', 'Dia', 'Descritivos', 'Etiquetas', 'Pendências analisadas', 'Baixas', 'Tempo da Central (min)', 'Tempo à mão estimado (min)', 'Tempo liberado (min)'];
const CAB_DESEMP_MES = ['Loja', 'Mês', 'Dias de uso', 'Descritivos', 'Etiquetas', 'Pendências analisadas', 'Baixas', 'Tempo da Central (h)', 'Tempo à mão estimado (h)', 'Tempo liberado (h)', 'Dias de trabalho liberados'];
// premissas de tempo à mão (segundos por item), as mesmas do relatório de desempenho da extensão; a Central manda as suas
const DEF = { desc: 45, etq: 30, analise: 180, baixa: 120, dia: 8 };

function saida(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.chave !== CHAVE) return saida({ ok: false, erro: 'chave' });
    if (d.acao === 'testar') return saida(testar());
    if (d.acao === 'historico') return saida(gravarHistorico(d));
    if (d.acao === 'eventos') return saida(gravarEventos(d));
    return saida({ ok: false, erro: 'acao desconhecida' });
  } catch (err) { return saida({ ok: false, erro: String(err) }); }
}

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.chave !== CHAVE) return saida({ ok: false, erro: 'chave' });
    if (p.acao === 'testar') return saida(testar());
    if (p.acao === 'historico') return saida(lerHistorico(p));
    if (p.acao === 'eventos') return saida(lerEventos(p));
    return saida({ ok: false, erro: 'acao desconhecida' });
  } catch (err) { return saida({ ok: false, erro: String(err) }); }
}

const VERSAO_SCRIPT = 2;   // 1 = pedidos; 2 = pedidos + desempenho (eventos)
function testar() { return { ok: true, msg: 'conectado', planilha: SpreadsheetApp.getActive().getName(), versao: VERSAO_SCRIPT }; }

function aba(nome, cab) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(nome);
  if (!sh) sh = ss.insertSheet(nome);
  if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}

const hora = t => t ? Utilities.formatDate(new Date(t), FUSO, 'HH:mm') : '';
const diaTxt = t => t ? Utilities.formatDate(new Date(t), FUSO, 'dd/MM/yyyy') : '';
const diaChave = t => Utilities.formatDate(new Date(t), FUSO, 'yyyy-MM-dd');
const baseT = r => r.desc || r.etq || r.reimp || r.conf || r.u || 0;
const tSaida = r => r.desc || r.etq || r.reimp || 0;
const seguro = x => /^[=+\-@]/.test(x) ? "'" + x : x;

// mesma fusão do painel: o registro de um pedido junta o que cada navegador anotou
function fundir(a, r) {
  const o = Object.assign({}, a); o.id = String(r.id);
  if (Array.isArray(r.itens) && r.itens.length && (!Array.isArray(o.itens) || r.itens.length > o.itens.length || o.itens.some(x => x.q == null))) o.itens = r.itens;
  ['desc', 'etq'].forEach(k => { if (r[k] && (!o[k] || r[k] < o[k])) o[k] = r[k]; });
  ['reimp', 'conf', 'u'].forEach(k => { if (r[k] && (!o[k] || r[k] > o[k])) o[k] = r[k]; });
  if (r.br) o.br = r.br;
  return o;
}

function linha(loja, r) {
  const itens = r.itens || [];
  const prod = itens.map(i => (i.q != null ? i.q + 'x ' : '') + (i.n || i.e)).join('; ').slice(0, 1500);
  const un = itens.reduce((s, i) => s + (i.q > 0 ? i.q : 1), 0);
  return [loja, Number(r.id), diaTxt(baseT(r)), hora(r.desc), hora(r.etq), hora(r.reimp), hora(r.conf), r.br || '', seguro(prod), un, r.u ? diaTxt(r.u) + ' ' + hora(r.u) : '', JSON.stringify(r)];
}

function gravarHistorico(d) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const loja = String(d.loja || '').slice(0, 60);
    const sh = aba(ABA_PEDIDOS, CAB_PEDIDOS);
    const n = Math.max(0, sh.getLastRow() - 1);
    const dados = n > 0 ? sh.getRange(2, 1, n, CAB_PEDIDOS.length).getValues() : [];
    const indice = {}; dados.forEach((l, i) => { indice[l[0] + '|' + l[1]] = i; });
    const sujos = new Set(); let novos = 0, atualizados = 0, ignorados = 0;
    (d.registros || []).forEach(r => {
      if (!r || !/^\d{5,9}$/.test(String(r.id))) { ignorados++; return; }
      const k = loja + '|' + r.id; const i = indice[k];
      if (i === undefined) { dados.push(linha(loja, fundir({}, r))); indice[k] = dados.length - 1; novos++; return; }
      let atual = {}; try { atual = JSON.parse(dados[i][COL_JSON]); } catch (e) {}
      const nova = linha(loja, fundir(atual, r));
      if (nova[COL_JSON] !== dados[i][COL_JSON]) { dados[i] = nova; if (i < n) sujos.add(i); atualizados++; }
    });
    sujos.forEach(i => sh.getRange(i + 2, 1, 1, CAB_PEDIDOS.length).setValues([dados[i]]));
    if (dados.length > n) sh.getRange(n + 2, 1, dados.length - n, CAB_PEDIDOS.length).setValues(dados.slice(n));
    resumoDia(dados);
    return { ok: true, novos, atualizados, ignorados, total: dados.length };
  } finally { lock.releaseLock(); }
}

// aba "Resumo do dia": pedidos, unidades, etiquetas, conferidos e sacolas por dia (recalculada a cada envio)
function resumoDia(dados) {
  const mapa = {};
  const dia = (loja, t) => { const k = loja + '|' + diaChave(t); return mapa[k] || (mapa[k] = { loja, chave: diaChave(t), t, p: 0, u: 0, e: 0, c: 0, s: { '30x20': 0, '35x45': 0, '45x50': 0, '50x60': 0 }, sem: 0 }); };
  dados.forEach(l => {
    let r; try { r = JSON.parse(l[COL_JSON]); } catch (e) { return; }
    const loja = l[0];
    const ts = tSaida(r);
    if (ts && (r.itens || []).length) {
      const a = dia(loja, ts); a.p++; a.u += r.itens.reduce((s, i) => s + (i.q > 0 ? i.q : 1), 0);
      const b = sacolaDe(r.itens); if (!b.sacolas.length) a.sem++; else b.sacolas.forEach(x => { a.s[x]++; });
    }
    if (r.etq) dia(loja, r.etq).e++;
    if (r.conf) dia(loja, r.conf).c++;
  });
  const lista = Object.keys(mapa).map(k => mapa[k]).sort((a, b) => a.loja.localeCompare(b.loja) || (a.chave < b.chave ? 1 : -1)).slice(0, 800);
  const sh = aba(ABA_DIA, CAB_DIA);
  const ult = sh.getLastRow(); if (ult > 1) sh.getRange(2, 1, ult - 1, CAB_DIA.length).clearContent();
  if (lista.length) sh.getRange(2, 1, lista.length, CAB_DIA.length).setValues(lista.map(a => [a.loja, diaTxt(a.t), a.p, a.u, a.e, a.c, a.s['30x20'], a.s['35x45'], a.s['45x50'], a.s['50x60'], a.sem]));
}

// restauração: devolve os registros em páginas (a Central pede "desde" a linha N)
function lerHistorico(p) {
  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_PEDIDOS);
  if (!sh || sh.getLastRow() < 2) return { ok: true, registros: [], proximo: null, total: 0 };
  const ate = sh.getLastRow();
  const desde = Math.max(2, parseInt(p.desde, 10) || 2);
  const limite = Math.max(1, Math.min(500, parseInt(p.limite, 10) || 200));
  const qtd = Math.max(0, Math.min(limite, ate - desde + 1));
  const vals = qtd ? sh.getRange(desde, 1, qtd, CAB_PEDIDOS.length).getValues() : [];
  const loja = String(p.loja || '');
  const registros = vals.filter(l => !loja || l[0] === loja).map(l => l[COL_JSON]).filter(x => typeof x === 'string' && x.charAt(0) === '{');
  return { ok: true, registros, proximo: desde + qtd <= ate ? desde + qtd : null, total: ate - 1 };
}

// ---------- desempenho (tempo poupado): eventos de cronometragem das rotinas
function gravarEventos(d) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const loja = String(d.loja || '').slice(0, 60);
    const sh = aba(ABA_EVENTOS, CAB_EVENTOS);
    const n = Math.max(0, sh.getLastRow() - 1);
    const dados = n > 0 ? sh.getRange(2, 1, n, CAB_EVENTOS.length).getValues() : [];
    const vistos = {}; dados.forEach(l => { vistos[l[0] + '|' + l[1]] = true; });
    const novos = []; let ignorados = 0;
    (d.eventos || []).forEach(e => {
      if (!e || !e.t || !e.k || !/^ev_\d+_[a-z0-9]+$/.test(String(e._k))) { ignorados++; return; }
      const k = loja + '|' + e._k; if (vistos[k]) return; vistos[k] = true;
      const ini = e.t0 || (e.t - (e.ms || 0));
      novos.push([loja, e._k, diaTxt(e.t), e.k + (e.res ? ' (' + e.res + ')' : ''), hora(ini), hora(e.t), Math.round((e.t - ini) / 1000), e.n == null ? '' : e.n, JSON.stringify(e)]);
    });
    if (novos.length) sh.getRange(n + 2, 1, novos.length, CAB_EVENTOS.length).setValues(novos);
    const todos = dados.concat(novos);
    desempenho(todos, Object.assign({}, DEF, d.base || {}));
    return { ok: true, novos: novos.length, ignorados, total: todos.length };
  } finally { lock.releaseLock(); }
}

// a mesma regra do relatório da extensão (registro.js, calcular): o que cada evento conta como itens e tempo
function linhaEvento(e) {
  if (e.k === 'descritivos' || e.k === 'etiquetas') return { linha: e.k, ms: e.t - e.t0, n: e.n || 0 };
  if (e.k === 'coleta' || e.k === 'verificar' || e.k === 'onehub') return { linha: 'analise', ms: e.t - e.t0, n: e.k === 'verificar' ? (e.n || 0) : 0 };
  if (e.k === 'baixa' && !/^teste/i.test(e.res || '')) return { linha: 'baixa', ms: e.ms || 0, n: e.res === 'baixado' ? 1 : 0 };
  return null;
}
function desempenho(linhas, base) {
  const man = { descritivos: base.desc, etiquetas: base.etq, analise: base.analise, baixa: base.baixa };
  const zero = () => ({ descritivos: 0, etiquetas: 0, analise: 0, baixa: 0 });
  const dias = {};
  linhas.forEach(l => {
    let e; try { e = JSON.parse(l[COL_EV_JSON]); } catch (x) { return; }
    const x = linhaEvento(e); if (!x) return;
    const k = l[0] + '|' + diaChave(e.t);
    const a = dias[k] || (dias[k] = { loja: l[0], chave: diaChave(e.t), t: e.t, n: zero(), ms: zero() });
    a.n[x.linha] += x.n; a.ms[x.linha] += x.ms;
  });
  const lista = Object.keys(dias).map(k => dias[k]);
  lista.forEach(a => { a.auto = 0; a.manual = 0; Object.keys(man).forEach(g => { a.auto += a.ms[g]; a.manual += a.n[g] * man[g] * 1000; }); });
  lista.sort((a, b) => a.loja.localeCompare(b.loja) || (a.chave < b.chave ? 1 : -1));
  const min = ms => Math.round(ms / 6000) / 10;
  const h = ms => Math.round(ms / 360000) / 10;
  const sd = aba(ABA_DESEMP_DIA, CAB_DESEMP_DIA);
  const ud = sd.getLastRow(); if (ud > 1) sd.getRange(2, 1, ud - 1, CAB_DESEMP_DIA.length).clearContent();
  if (lista.length) sd.getRange(2, 1, lista.length, CAB_DESEMP_DIA.length).setValues(lista.map(a => [a.loja, diaTxt(a.t), a.n.descritivos, a.n.etiquetas, a.n.analise, a.n.baixa, min(a.auto), min(a.manual), min(Math.max(0, a.manual - a.auto))]));
  const meses = {};
  lista.forEach(a => {
    const k = a.loja + '|' + a.chave.slice(0, 7);
    const m = meses[k] || (meses[k] = { loja: a.loja, chave: a.chave.slice(0, 7), dias: 0, n: zero(), auto: 0, manual: 0 });
    m.dias++; Object.keys(m.n).forEach(g => { m.n[g] += a.n[g]; }); m.auto += a.auto; m.manual += a.manual;
  });
  const lm = Object.keys(meses).map(k => meses[k]).sort((a, b) => a.loja.localeCompare(b.loja) || (a.chave < b.chave ? 1 : -1));
  const sm = aba(ABA_DESEMP_MES, CAB_DESEMP_MES);
  const um = sm.getLastRow(); if (um > 1) sm.getRange(2, 1, um - 1, CAB_DESEMP_MES.length).clearContent();
  if (lm.length) sm.getRange(2, 1, lm.length, CAB_DESEMP_MES.length).setValues(lm.map(m => { const lib = Math.max(0, m.manual - m.auto); return [m.loja, m.chave.slice(5) + '/' + m.chave.slice(0, 4), m.dias, m.n.descritivos, m.n.etiquetas, m.n.analise, m.n.baixa, h(m.auto), h(m.manual), h(lib), Math.round(lib / (base.dia * 3600000) * 10) / 10]; }));
}

function lerEventos(p) {
  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_EVENTOS);
  if (!sh || sh.getLastRow() < 2) return { ok: true, registros: [], proximo: null, total: 0 };
  const ate = sh.getLastRow();
  const desde = Math.max(2, parseInt(p.desde, 10) || 2);
  const limite = Math.max(1, Math.min(500, parseInt(p.limite, 10) || 300));
  const qtd = Math.max(0, Math.min(limite, ate - desde + 1));
  const vals = qtd ? sh.getRange(desde, 1, qtd, CAB_EVENTOS.length).getValues() : [];
  const loja = String(p.loja || '');
  const registros = vals.filter(l => !loja || l[0] === loja).map(l => l[COL_EV_JSON]).filter(x => typeof x === 'string' && x.charAt(0) === '{');
  return { ok: true, registros, proximo: desde + qtd <= ate ? desde + qtd : null, total: ate - 1 };
}

// regra das sacolas: a mesma do painel (Compra contínua > Materiais de separação)
// peso em kg tirado do nome do produto ("2,5 Kg", "400 g", "85g"); null se não tiver
const pesoKg = n => { const m = [...String(n || '').matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/gi)].pop(); if (!m) return null; const v = parseFloat(m[1].replace(',', '.')); return /kg/i.test(m[2]) ? v : v / 1000; };
function sacolaDe(itens) {
  let sac = 0, med = 0, pqUn = 0, pqKg = 0;
  (itens || []).forEach(i => { const q = i.q > 0 ? i.q : 1; const w = pesoKg(i.n); if (w != null && w >= 7) sac += q; else if (w != null && w > 1) med += q; else { pqUn += q; pqKg += (w || 0) * q; } });
  const resto = () => {
    if (med >= 2) return { s: '45x50', m: med + ' rações médias' };
    if (med === 1) return { s: '35x45', m: '1 ração média' + (pqUn ? ' + ' + pqUn + ' pequeno(s)' : '') };
    if (!pqUn) return null;
    const kg = Math.round(pqKg * 100) / 100;
    if (pqUn <= 4 && pqKg < 1) return { s: '30x20', m: pqUn + ' pequeno(s), ' + String(kg).replace('.', ',') + ' kg' };
    return { s: '35x45', m: pqUn + ' pequeno(s), ' + String(kg).replace('.', ',') + ' kg' };
  };
  if (sac >= 2) return { sacolas: ['50x60'], motivo: sac + ' sacarias' + (med || pqUn ? ' + outros itens' : '') };
  const r = resto();
  if (sac === 1) return { sacolas: r ? [r.s] : [], motivo: '1 sacaria sem sacola' + (r ? '; ' + r.m : '') };
  return { sacolas: r ? [r.s] : [], motivo: r ? r.m : 'sem itens' };
}
