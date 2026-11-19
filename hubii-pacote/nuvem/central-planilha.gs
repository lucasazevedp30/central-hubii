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

function saida(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.chave !== CHAVE) return saida({ ok: false, erro: 'chave' });
    if (d.acao === 'testar') return saida(testar());
    if (d.acao === 'historico') return saida(gravarHistorico(d));
    return saida({ ok: false, erro: 'acao desconhecida' });
  } catch (err) { return saida({ ok: false, erro: String(err) }); }
}

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.chave !== CHAVE) return saida({ ok: false, erro: 'chave' });
    if (p.acao === 'testar') return saida(testar());
    if (p.acao === 'historico') return saida(lerHistorico(p));
    return saida({ ok: false, erro: 'acao desconhecida' });
  } catch (err) { return saida({ ok: false, erro: String(err) }); }
}

function testar() { return { ok: true, msg: 'conectado', planilha: SpreadsheetApp.getActive().getName() }; }

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
