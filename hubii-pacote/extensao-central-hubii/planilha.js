// Planilha de pendências do dia: junta o resultado do Painel Hubii e do OneHub, dá a Confiabilidade (0 a 10)
// e gera o .xlsx (Resumo, Todas, Dar baixa, Cancelar, Aguardar e conferir) sem sair da Central.
(() => {
if (window.__centralPlan) return;

// ---------- utilidades
const br = x => (x == null || isNaN(x)) ? '?' : x.toFixed(2).replace('.', ',');
const money = s => { const m = String(s == null ? '' : s).match(/(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/); return m ? parseFloat(m[1].replace(/\./g, '') + '.' + m[2]) : null; };
const parseCsv = texto => {
  const t = String(texto || '').replace(/^﻿/, '');
  const prim = t.split('\n')[0] || '';
  const sep = (prim.match(/;/g) || []).length >= (prim.match(/\t/g) || []).length && /;/.test(prim) ? ';' : (/\t/.test(prim) ? '\t' : ',');
  const rows = []; let l = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { l.push(c); c = ''; }
    else if (ch === '\n') { l.push(c.replace(/\r$/, '')); rows.push(l); l = []; c = ''; }
    else c += ch;
  }
  if (c || l.length) { l.push(c.replace(/\r$/, '')); rows.push(l); }
  if (!rows.length) return [];
  const cab = rows[0].map(x => x.trim());
  return rows.slice(1).filter(r => r.some(x => x && x.trim())).map(r => { const o = {}; cab.forEach((h, i) => { o[h] = (r[i] == null ? '' : r[i]); }); return o; });
};

// ---------- motor (Confiabilidade)
const nConf = r => { const m = /Confirmado \((\d)\)/.exec(r['Verificação'] || ''); return m ? parseInt(m[1], 10) : 0; };
const confEDestino = (r, desp) => {
  const n = nConf(r), st = r['Status'];
  if (r['Autorizado para baixa'] === 'Sim') {
    let c = n >= 6 ? 10 : 9;
    if (st === 'Despacho') c = n >= 6 ? 9 : 8;
    if ((r['Observação'] || '').includes('Nome com muitos pedidos')) c = 9;
    return [c, 'Dar baixa'];
  }
  if (st === 'Cancelado') return [n >= 6 ? 9 : 7, 'Cancelar'];
  if (st === 'Despacho') { if (desp) return [n >= 3 ? 7 : 6, 'Dar baixa']; return [n >= 6 ? 9 : n >= 3 ? 8 : 5, 'Aguardar/conferir']; }
  if (st === 'A conferir') return [(r['Verificação'] || '').includes('perto da data') ? 1 : 2, 'Aguardar/conferir'];
  return [0, 'Aguardar/conferir'];
};
const obsBase = (r, destino, desp) => {
  const v = r['Verificação'] || '', o = r['Observação'] || '', st = r['Status'], p = [];
  if (st === 'Cancelado') p.push('Pedido cancelado no Painel: não dar baixa; cancelar a pendência.');
  if (st === 'Despacho' && r['Autorizado para baixa'] !== 'Sim') p.push(desp ? 'DESPACHO: dar baixa só se estiver em "Esperando Expedição" (o CSV não traz esse sub-status; confira na lista do Hubii).' : 'Pedido ainda em Despacho (não saiu): aguardar.');
  if (st === 'A conferir' && v.includes('Valor não confere')) p.push('Valor da pendência não confere com o pedido achado (pode ser o mesmo pedido com frete diferente): conferir.');
  if (st === 'Não localizado') p.push('Não achado pelo nome no Painel: consultar no OneHub (pode ser pedido invisível).');
  if (destino === 'Dar baixa' && !(st === 'Despacho' && r['Autorizado para baixa'] !== 'Sim')) p.push(nConf(r) >= 6 ? 'Valor, data, produto, endereço, nome e CPF batem: pode dar baixa.' : 'Valor, data e nome batem: pode dar baixa.');
  if (st === 'A conferir' && v.includes('perto da data')) p.push('Nenhum pedido deste nome perto da data da pendência: conferir à mão.');
  if (o && !o.startsWith('Pode ser pedido invisível') && o !== 'Valor não lido (pedido não aberto)') p.push(o);
  if (o === 'Valor não lido (pedido não aberto)') p.push('Valor não lido (pedido não aberto).');
  return p.join(' ');
};
const motor = (hub, oh, opt) => {
  opt = opt || {};
  const desp = !!opt.despachoOk;
  const dados = hub.map((r, i) => {
    const [c, d] = confEDestino(r, desp);
    return { ord: i + 1, cli: r['Cliente'] || '', ped: r['Pedido'] || '', st: r['Status'] || '', dp: r['Data do pedido (Hubii)'] || '', cod: r['Código'] || '', tot: money(r['Total']), dpend: r['Data da pendência'] || '', dest: d, ver: r['Verificação'] || '', obs: obsBase(r, d, desp), conf: c, poh: null, stoh: null, toh: null, end: r['Endereço (Hubii)'] || '', ean: r['Produto EAN (Hubii)'] || '', _orig: r['Observação'] || '' };
  });
  if (oh && oh.length) {
    const mapa = {}; oh.forEach(r => { if (r['Código']) mapa[r['Código']] = r; });
    dados.forEach(d => {
      const o = mapa[d.cod]; if (!o) return;
      const pend = d.tot; const ohn = o['Pedido (OneHub)'] || ''; const ohtot = money(o['Total (OneHub)']); const ohst = o['Status (OneHub)'] || '';
      const cand = [...d._orig.matchAll(/(\d{7}) \((Em trânsito|Entregue|Despacho), R\$ ([\d.,]+)\)/g)].map(m => [m[1], m[2], m[3]]);
      if (!ohn) {
        const lst = [...(o['Observação'] || '').matchAll(/(\d{7}) \(([^,]+), (\d\d\/\d\d\/\d{4}), R\$ ([\d.,]+)\)/g)].map(m => [m[1], m[2], m[3], m[4]]);
        if (ohst === 'Não encontrado no OneHub') { d.obs = 'Não achado no Painel nem no OneHub pelo nome. Confira o filtro de datas do OneHub (incluir ' + d.dpend + ') e o nome digitado.'; d.conf = 0; d.stoh = 'Não encontrado'; return; }
        const hit = cand.filter(c => lst.some(x => x[0] === c[0]));
        if (hit.length && pend) {
          const [n, st] = hit[0]; const t = money('R$ ' + cand.find(c => c[0] === n)[2]);
          if (t && Math.abs(pend - t) / t <= 0.25) {
            const lr = lst.find(x => x[0] === n);
            Object.assign(d, { ped: n, st, poh: n, stoh: lr[1], toh: money('R$ ' + lr[3]), dest: 'Dar baixa', conf: 6 });
            d.obs = 'Mesmo nº ' + n + ' no Painel (' + st + ') e no OneHub (' + lr[1] + '). Valor da pendência (R$ ' + br(pend) + ') difere do pedido (R$ ' + br(t) + '); o OneHub não confirmou sozinho: conferir o valor no PDV.';
            return;
          }
        }
        d.stoh = 'A conferir'; d.obs = 'OneHub tem pedido(s) deste nome, mas nenhum perto do valor: ' + (o['Observação'] || '') + '. O Painel indicou: ' + d._orig + '. Conferir à mão.'; d.conf = 2; return;
      }
      d.poh = ohn; d.stoh = ohst; d.toh = ohtot;
      const painel = cand.filter(c => c[0] === ohn);
      if (painel.length) {
        const [n, st, ts] = painel[0]; const t = money('R$ ' + ts);
        const diff = (t && pend != null) ? Math.abs(pend - t) / t : 1;
        if (diff > 0.25) {
          Object.assign(d, { ped: n, st, dest: 'Aguardar/conferir', conf: 2 });
          d.obs = 'O Painel e o OneHub têm o nº ' + n + ' (' + st + '/' + ohst + ', R$ ' + br(t) + '), mas o valor da pendência (R$ ' + br(pend) + ') é muito diferente (' + Math.round(diff * 100) + '%): provavelmente outra venda do mesmo cliente. Conferir.'; return;
        }
        if (st === 'Despacho' && desp && (ohst === 'Despachado' || ohst === 'Entregue')) {
          Object.assign(d, { ped: n, st, dest: 'Dar baixa', conf: diff <= 0.10 ? 7 : diff <= 0.15 ? 6 : 5 });
          d.obs = 'DESPACHO no Painel e ' + ohst + ' no OneHub (nº ' + n + '): dar baixa só se estiver em "Esperando Expedição". Valor da pendência (R$ ' + br(pend) + ') difere do pedido (R$ ' + br(t) + ', ' + Math.round(diff * 100) + '%): conferir o total no PDV.'; return;
        }
        if (st === 'Despacho') {
          Object.assign(d, { ped: n, st, dest: 'Aguardar/conferir', conf: 4 });
          d.obs = 'Mesmo nº ' + n + ' no Painel (Despacho) e no OneHub (' + ohst + '): o pedido ainda não saiu. Valor da pendência (R$ ' + br(pend) + ') difere do pedido (R$ ' + br(t) + ', ' + Math.round(diff * 100) + '%): aguardar sair e conferir.'; return;
        }
        if (ohst === 'Pedido Separado' || ohst === 'Novo' || ohst === 'Cancelado') {
          Object.assign(d, { ped: n, st, dest: 'Aguardar/conferir', conf: 3 });
          d.obs = 'CONFLITO: o Painel mostra ' + st + ' e o OneHub mostra ' + ohst + ' para o nº ' + n + '. Não dar baixa até conferir qual está certo.'; return;
        }
        Object.assign(d, { ped: n, st, dest: 'Dar baixa', conf: diff <= 0.10 ? 7 : diff <= 0.15 ? 6 : 5 });
        let txt = 'Mesmo nº ' + n + ' no Painel (' + st + ') e no OneHub (' + ohst + '), mesma data.';
        if (diff > 0.005) txt += ' Valor da pendência (R$ ' + br(pend) + ') difere do pedido (R$ ' + br(t) + ', ' + Math.round(diff * 100) + '%): conferir o total no PDV.'; else txt += ' Valor bate.';
        if ((o['Observação'] || '').startsWith('Outros')) txt += ' ' + o['Observação'] + '.';
        if (d.cli.toLowerCase().startsWith('rua ')) txt += ' O nome da pendência parece um endereço: confira quem é o comprador.';
        d.obs = txt;
      } else {
        const igual = ohtot != null && pend != null && Math.abs(ohtot - pend) < 0.005;
        if (ohst === 'Cancelado') {
          d.dest = 'Cancelar'; d.conf = igual ? 8 : 7;
          d.obs = 'Pedido ' + ohn + ' cancelado no OneHub (R$ ' + br(ohtot) + ') e não aparece no Painel (invisível): cancelar a pendência.' + (igual ? ' Valor, data e nome batem.' : ' Valor da pendência difere do pedido.'); return;
        }
        if (ohst === 'Despachado' || ohst === 'Entregue') {
          const dif = (ohtot && pend != null) ? Math.abs(ohtot - pend) / ohtot : 1;
          if (igual || dif <= 0.10) {
            d.dest = 'Dar baixa'; d.conf = igual ? 8 : 6;
            d.obs = 'Existe só no OneHub (pedido ' + ohn + ', ' + ohst + ', R$ ' + br(ohtot) + (igual ? '; valor, data e nome batem' : '; valor da pendência R$ ' + br(pend) + ' difere ' + Math.round(dif * 100) + '%') + '), não aparece no Painel. Despachado/Entregue no OneHub conta como OK para dar baixa.'; return;
          }
        }
        d.conf = igual ? (ohst === 'Despachado' ? 6 : 4) : 3;
        d.obs = 'Existe só no OneHub (pedido ' + ohn + ', ' + ohst + ', R$ ' + br(ohtot) + (igual ? '; valor, data e nome batem' : '') + '), não aparece no Painel. Regra "invisível = cancelar" não aplicada porque o pedido não está cancelado: decidir.';
      }
    });
  }
  dados.forEach(d => { delete d._orig; });
  return dados;
};

// ---------- visual da planilha
const ROXO = 'FF3A1F6D';
const ST = { 'Em trânsito': ['FF1F3E79', 'FFDCE6F8'], 'Entregue': ['FF1B6B35', 'FFE2F3E6'], 'Cancelado': ['FF9C3A00', 'FFFBE3D5'], 'Invisível': ['FF9C3A00', 'FFFBE3D5'], 'A conferir': ['FF7E5F00', 'FFFFF1CC'], 'Não localizado': ['FF555555', 'FFEDEDED'], 'Despacho': ['FF3A1F6D', 'FFEDE7F8'] };
const DS = { 'Dar baixa': ['FF006000', 'FFC5EECE'], 'Cancelar': ['FF7E5F00', 'FFFFF1CC'], 'Aguardar/conferir': ['FF1F3E79', 'FFDCE6F8'] };
const COLS = [['Ordem', 8, 'ord'], ['Cliente', 34, 'cli'], ['Pedido no Painel', 16, 'ped'], ['Status no Painel', 16, 'st'], ['Data do pedido', 14, 'dp'], ['Código', 13, 'cod'], ['Total', 13, 'tot'], ['Data da pendência', 15, 'dpend'], ['Pedido no OneHub', 16, 'poh'], ['Status no OneHub', 17, 'stoh'], ['Total no OneHub', 15, 'toh'], ['Destino', 20, 'dest'], ['Verificação', 52, 'ver'], ['Observação', 70, 'obs'], ['Confiabilidade', 15, 'conf'], ['Endereço (Hubii)', 50, 'end'], ['Produto EAN (Hubii)', 20, 'ean']];
const NOTAS = [
  ['Nota 10', 'Em trânsito/Entregue com 6 confirmações (valor, data, produto, endereço, nome e CPF).'],
  ['Nota 9', 'Em trânsito/Entregue com 3 a 5 confirmações, ou nome com muitíssimos pedidos: pode dar baixa.'],
  ['Nota 8 a 9 (Esperando Expedição)', 'Pedido em Despacho com status Esperando Expedição, autorizado para baixa. 9 = 6 confirmações; 8 = 3 a 5.'],
  ['Nota 6 a 7 (Despacho)', 'Só quando a opção "tratar Despacho como dar baixa" estava ligada: o CSV não traz o sub-status, então só dar baixa nos que estiverem em Esperando Expedição na lista do Hubii.'],
  ['Nota 7 a 9 (Cancelar)', 'Cancelado no Painel: não dar baixa; cancelar a pendência.'],
  ['Nota 6 a 7', 'Mesmo nº no Painel e no OneHub, mas valor da pendência diferente do pedido (7 até 10%, 6 até 15%, 5 acima).'],
  ['Nota 6 a 8', 'Só existe no OneHub e está Despachado ou Entregue: conta como OK para dar baixa. 8 com valor igual; 6 com valor até 10% diferente.'],
  ['Nota 7 a 8 (Cancelar)', 'Cancelado no OneHub e ausente do Painel (invisível): cancelar.'],
  ['Nota 3 a 5', 'Despacho ainda sem sair, ou só no OneHub como Pedido Separado, ou Painel e OneHub discordando do status: aguardar/conferir.'],
  ['Nota 2', 'Pedido achado, mas o valor da pendência não confere (ou difere mais de 25%): pode ser outra compra do mesmo cliente.'],
  ['Nota 0 a 1', 'Nada achado (ou nenhum pedido deste nome perto da data): consultar no OneHub / conferir à mão.']
];

// ---------- escritor de xlsx (sem bibliotecas)
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const colL = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const novoEstilo = () => {
  const fontes = [], fundos = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'], bordas = ['<border><left/><right/><top/><bottom/><diagonal/></border>'], fmts = [], xfs = [];
  const ix = (arr, x) => { let i = arr.indexOf(x); if (i < 0) { arr.push(x); i = arr.length - 1; } return i; };
  const bordaFina = '<border><left style="thin"><color rgb="FFD0CCDD"/></left><right style="thin"><color rgb="FFD0CCDD"/></right><top style="thin"><color rgb="FFD0CCDD"/></top><bottom style="thin"><color rgb="FFD0CCDD"/></bottom><diagonal/></border>';
  const cache = {};
  const get = o => {
    o = o || {}; const k = JSON.stringify(o); if (k in cache) return cache[k];
    const f = '<font>' + (o.b ? '<b/>' : '') + (o.i ? '<i/>' : '') + '<sz val="' + (o.sz || 10) + '"/><color rgb="' + (o.color || 'FF000000') + '"/><name val="Arial"/></font>';
    const fi = ix(fontes, f);
    const fu = o.fill ? ix(fundos, '<fill><patternFill patternType="solid"><fgColor rgb="' + o.fill + '"/><bgColor indexed="64"/></patternFill></fill>') : 0;
    const bo = o.borda ? ix(bordas, bordaFina) : 0;
    let nf = 0; if (o.fmt) { const i = ix(fmts, o.fmt); nf = 164 + i; }
    const al = (o.h || o.v || o.wrap) ? '<alignment' + (o.h ? ' horizontal="' + o.h + '"' : '') + ' vertical="' + (o.v || 'center') + '"' + (o.wrap ? ' wrapText="1"' : '') + '/>' : '';
    xfs.push('<xf numFmtId="' + nf + '" fontId="' + fi + '" fillId="' + fu + '" borderId="' + bo + '" xfId="0" applyFont="1"' + (fu ? ' applyFill="1"' : '') + (bo ? ' applyBorder="1"' : '') + (nf ? ' applyNumberFormat="1"' : '') + (al ? ' applyAlignment="1">' + al + '</xf>' : '/>'));
    cache[k] = xfs.length; return cache[k];
  };
  const xml = () => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    (fmts.length ? '<numFmts count="' + fmts.length + '">' + fmts.map((f, i) => '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + esc(f) + '"/>').join('') + '</numFmts>' : '') +
    '<fonts count="' + (fontes.length + 1) + '"><font><sz val="10"/><name val="Arial"/></font>' + fontes.join('') + '</fonts>' +
    '<fills count="' + fundos.length + '">' + fundos.join('') + '</fills><borders count="' + bordas.length + '">' + bordas.join('') + '</borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="' + (xfs.length + 1) + '"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' + xfs.join('') + '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  // as fontes têm índice deslocado em 1 (a fonte 0 é a padrão); ajusta
  const get2 = o => get(o);
  return { get: get2, xml, fontes };
};
// corrige o deslocamento das fontes: reescreve fontId +1 ao gerar o xml final
const montarEstilos = est => est.xml().replace(/<xf numFmtId="(\d+)" fontId="(\d+)"( fillId="\d+" borderId="\d+" xfId="0" applyFont="1")/g, (m, a, b, c) => '<xf numFmtId="' + a + '" fontId="' + (parseInt(b, 10) + 1) + '"' + c);

const novaPlanilha = (nome, aba) => ({ nome, aba: aba || '', linhas: [], larguras: [], altura: {}, congelar: null, filtro: null, escala: null, grade: true });
const cel = (v, s, f) => ({ v, s, f });
const sheetXml = (p) => {
  let max = 0; p.linhas.forEach(l => { if (l) max = Math.max(max, l.length); });
  const rows = p.linhas.map((l, r) => {
    if (!l) return '';
    const cs = l.map((c, i) => {
      if (!c) return '';
      const ref = colL(i) + (r + 1); const s = c.s ? ' s="' + c.s + '"' : '';
      if (c.f != null) return '<c r="' + ref + '"' + s + '><f>' + esc(c.f) + '</f><v>' + (c.v == null ? 0 : c.v) + '</v></c>';
      if (c.v == null || c.v === '') return c.s ? '<c r="' + ref + '"' + s + '/>' : '';
      if (typeof c.v === 'number') return '<c r="' + ref + '"' + s + '><v>' + c.v + '</v></c>';
      return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + esc(c.v) + '</t></is></c>';
    }).join('');
    const h = p.altura[r + 1];
    return '<row r="' + (r + 1) + '"' + (h ? ' ht="' + h + '" customHeight="1"' : '') + '>' + cs + '</row>';
  }).join('');
  const cols = p.larguras.length ? '<cols>' + p.larguras.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' : '';
  const pane = p.congelar ? '<pane xSplit="' + p.congelar[0] + '" ySplit="' + p.congelar[1] + '" topLeftCell="' + colL(p.congelar[0]) + (p.congelar[1] + 1) + '" activePane="bottomRight" state="frozen"/>' : '';
  const cf = p.escala ? '<conditionalFormatting sqref="' + p.escala + '"><cfRule type="colorScale" priority="1"><colorScale><cfvo type="num" val="0"/><cfvo type="num" val="5"/><cfvo type="num" val="10"/><color rgb="FFF4B6B0"/><color rgb="FFFFE9A8"/><color rgb="FF9ED9A8"/></colorScale></cfRule></conditionalFormatting>' : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr>' + (p.aba ? '<tabColor rgb="' + p.aba + '"/>' : '') + '</sheetPr><dimension ref="A1:' + colL(Math.max(0, max - 1)) + Math.max(1, p.linhas.length) + '"/>' +
    '<sheetViews><sheetView workbookViewId="0"' + (p.grade ? '' : ' showGridLines="0"') + '>' + pane + '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>' + cols + '<sheetData>' + rows + '</sheetData>' +
    (p.filtro ? '<autoFilter ref="' + p.filtro + '"/>' : '') + cf + '</worksheet>';
};
const crcTab = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = crcTab[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const zip = arquivos => {
  const enc = new TextEncoder(); const partes = []; const central = []; let pos = 0;
  const u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  arquivos.forEach(([nome, txt]) => {
    const nb = enc.encode(nome), d = enc.encode(txt), crc = crc32(d);
    const lh = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0x6000), ...u16(0x5a21), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nb.length), ...u16(0)]);
    partes.push(lh, nb, d);
    central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0x6000), ...u16(0x5a21), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(pos)]), nb);
    pos += lh.length + nb.length + d.length;
  });
  const tamCentral = central.reduce((a, x) => a + x.length, 0);
  const fim = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(arquivos.length), ...u16(arquivos.length), ...u32(tamCentral), ...u32(pos), ...u16(0)]);
  return new Blob([...partes, ...central, fim], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

// ---------- monta a planilha
const montarPlanilhas = (dados, dataTxt) => {
  const est = novoEstilo(); const S = o => est.get(o);
  const todas = dados;
  const porDest = d => dados.filter(x => x.dest === d);
  const abaDados = (nome, lista, cor) => {
    const p = novaPlanilha(nome, cor);
    p.larguras = COLS.map(c => c[1]);
    p.altura[1] = 27.75;
    p.linhas.push(COLS.map(c => cel(c[0], S({ b: true, color: 'FFFFFFFF', fill: ROXO, borda: true, h: 'center', wrap: true }))));
    lista.forEach((d, i) => {
      const r = i + 2;
      p.linhas.push(COLS.map(([t, w, k]) => {
        const v = d[k]; const vazio = v === '' || v == null;
        const o = { borda: true, h: ['cli', 'ver', 'obs', 'end'].includes(k) ? 'left' : 'center', wrap: ['ver', 'obs', 'end'].includes(k) };
        if (k === 'tot' || k === 'toh') o.fmt = '"R$" #,##0.00';
        if (k === 'st' && ST[v]) { o.color = ST[v][0]; o.fill = ST[v][1]; }
        if (k === 'dest' && DS[v]) { o.b = true; o.color = DS[v][0]; o.fill = DS[v][1]; }
        if (k === 'conf') o.b = true;
        return cel(vazio ? null : v, S(o));
      }));
      p.altura[r] = ((d.ver && d.ver.length > 50) || (d.obs || '').length > 75) ? 30 : 18;
    });
    if (!lista.length && nome === 'Cancelar') { p.linhas.push([null, cel('Nenhuma pendência para cancelar nesta rodada.', S({ i: true, color: 'FF666666' }))]); }
    const n = Math.max(lista.length + 1, 2);
    p.congelar = [2, 1]; p.filtro = 'A1:' + colL(COLS.length - 1) + n; p.escala = 'O2:O' + n;
    return p;
  };
  const tod = abaDados('Todas', todas, 'FF7A5BB5');
  const dar = abaDados('Dar baixa', porDest('Dar baixa'), 'FF2D9E4F');
  const can = abaDados('Cancelar', porDest('Cancelar'), 'FFDFA800');
  const agu = abaDados('Aguardar e conferir', porDest('Aguardar/conferir'), 'FF3B6DD1');

  // Resumo
  const R = novaPlanilha('Resumo', ROXO); R.grade = false; R.larguras = [62, 14, 70];
  const set = (r, c, x) => { while (R.linhas.length < r) R.linhas.push(null); const l = R.linhas[r - 1] || (R.linhas[r - 1] = []); while (l.length < c) l.push(null); l[c - 1] = x; };
  set(1, 1, cel('Pendências do Hubii: conferência no Painel Hubii', S({ b: true, sz: 16, color: ROXO }))); R.altura[1] = 19.7;
  set(2, 1, cel('Painel Hubii e OneHub de ' + dataTxt + ', com Confiabilidade de 0 a 10.', S({})));
  const cab = (r, a, b) => { set(r, 1, cel(a, S({ b: true, color: 'FFFFFFFF', fill: ROXO, h: 'center', borda: true }))); set(r, 2, cel(b, S({ b: true, color: 'FFFFFFFF', fill: ROXO, h: 'center', borda: true }))); };
  const lin = (r, a, f, val, fill, bold) => { set(r, 1, cel(a, S({ b: bold || !!fill, fill: fill || undefined, borda: true }))); set(r, 2, cel(null, S({ b: !!bold, fill: bold && fill ? fill : undefined, borda: true, h: 'center' }))); R.linhas[r - 1][1].f = f; R.linhas[r - 1][1].v = val; };
  cab(4, 'Destino', 'Pendências');
  [['Dar baixa', 'FFC5EECE'], ['Cancelar', 'FFFFF1CC'], ['Aguardar/conferir', 'FFDCE6F8']].forEach(([d, fill], i) => lin(5 + i, d, 'COUNTIF(Todas!$L$2:$L$700,A' + (5 + i) + ')', dados.filter(x => x.dest === d).length, fill));
  lin(8, 'Total', 'SUM(B5:B7)', dados.length, 'FFF3F0F8', true);
  cab(10, 'Status no Painel', 'Pendências');
  const sts = ['Em trânsito', 'Entregue', 'Cancelado', 'Invisível', 'Despacho', 'A conferir', 'Não localizado'];
  sts.forEach((s, i) => lin(11 + i, s, 'COUNTIF(Todas!$D$2:$D$700,A' + (11 + i) + ')', dados.filter(x => x.st === s).length));
  lin(18, 'Total', 'SUM(B11:B17)', dados.filter(x => sts.includes(x.st)).length, 'FFF3F0F8', true);
  cab(20, 'Confiabilidade', 'Pendências');
  const cf = x => x.conf;
  [['9 a 10: certeza, pode dar baixa/cancelar', 'COUNTIFS(Todas!$O$2:$O$700,">=9")', dados.filter(x => cf(x) >= 9).length],
   ['7 a 8: boa, vale um olhar rápido', 'COUNTIFS(Todas!$O$2:$O$700,">=7",Todas!$O$2:$O$700,"<9")', dados.filter(x => cf(x) >= 7 && cf(x) < 9).length],
   ['4 a 6: média, conferir', 'COUNTIFS(Todas!$O$2:$O$700,">=4",Todas!$O$2:$O$700,"<7")', dados.filter(x => cf(x) >= 4 && cf(x) < 7).length],
   ['0 a 3: conferir manualmente', 'COUNTIFS(Todas!$O$2:$O$700,"<4")', dados.filter(x => cf(x) < 4).length]].forEach(([a, f, v], i) => lin(21 + i, a, f, v));
  lin(25, 'Total', 'SUM(B21:B24)', dados.length, 'FFF3F0F8', true);
  set(27, 1, cel('Como a nota foi dada', S({ b: true })));
  NOTAS.forEach(([a, t], i) => { const r = 28 + i; set(r, 1, cel(a, S({ b: true }))); set(r, 3, cel(t, S({ wrap: true, v: 'top' }))); R.altura[r] = 28; });
  const rf = 29 + NOTAS.length;
  set(rf, 1, cel('Dica: as colunas Código e Total desta planilha são lidas pelo botão "Carregar planilha" do Baixa Hubii (e, na Central, o botão "Usar planilha da Central").', S({})));
  set(rf + 1, 1, cel('Na aba Todas, trocar o Destino de uma linha atualiza o Resumo. As abas por destino são cópias e não se movem sozinhas.', S({})));
  return { planilhas: [R, tod, dar, can, agu], est };
};
const gerarXlsx = (dados, dataTxt) => empacotar(montarPlanilhas(dados, dataTxt));
const empacotar = ({ planilhas, est }) => {
  const arq = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + planilhas.map((p, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' + planilhas.map((p, i) => '<sheet name="' + esc(p.nome) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + planilhas.map((p, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (planilhas.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', montarEstilos(est)]
  ].concat(planilhas.map((p, i) => ['xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(p)]));
  return zip(arq);
};

// linhas no formato lido pelo Baixa (aba "Dar baixa")
const abasParaBaixa = dados => {
  const linha = d => COLS.map(c => { const v = d[c[2]]; return v == null ? '' : v; });
  const mk = (nome, lista) => ({ nome, rows: [COLS.map(c => c[0])].concat(lista.map(linha)) });
  return [mk('Todas', dados), mk('Dar baixa', dados.filter(d => d.dest === 'Dar baixa'))];
};

// ---------- dados guardados (chrome.storage.local é compartilhado entre Hubii, OneHub e OnePet)
const stGet = k => new Promise(r => { try { chrome.storage.local.get(k, o => r(o || {})); } catch (e) { r({}); } });
const stSet = o => new Promise(r => { try { chrome.storage.local.set(o, () => r()); } catch (e) { r(); } });
const stDel = k => new Promise(r => { try { chrome.storage.local.remove(k, () => r()); } catch (e) { r(); } });
const CH = { hub: 'central_dados_hub', oh: 'central_dados_oh', opc: 'central_plan_opcoes' };
const pend = {}; // adia a gravação: a tabela é redesenhada a cada pedido lido
const salvar = (tipo, csvTxt) => {
  clearTimeout(pend[tipo]);
  pend[tipo] = setTimeout(() => { if (csvTxt && csvTxt.length > 20) stSet({ [CH[tipo]]: { t: Date.now(), csv: csvTxt } }); }, 1500);
};
const hoje = () => new Date().toLocaleDateString('pt-BR');
const hora = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const dadosGuardados = async () => {
  const o = await stGet([CH.hub, CH.oh, CH.opc]);
  return { hub: o[CH.hub] || null, oh: o[CH.oh] || null, opc: Object.assign({ despachoOk: false }, o[CH.opc] || {}) };
};
const baixar = (nome, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 4000); };
// usado pelo Baixa Hubii: abas no mesmo formato de uma planilha carregada
const ultimaParaBaixa = async () => {
  const g = await dadosGuardados();
  if (!g.hub) throw new Error('Ainda não há pendências do Painel Hubii guardadas. Rode "Verificar pendências (Painel)" antes.');
  const dados = motor(parseCsv(g.hub.csv), g.oh ? parseCsv(g.oh.csv) : [], g.opc);
  return { abas: abasParaBaixa(dados), nome: 'Planilha da Central (' + hora(g.hub.t) + ')' };
};

// ---------- janela
const abrir = async () => {
  const velho = document.getElementById('central-plan'); if (velho) velho.remove();
  const g = await dadosGuardados();
  let hubTxt = g.hub ? g.hub.csv : '', ohTxt = g.oh ? g.oh.csv : '';
  let hubInfo = g.hub ? 'guardado em ' + hora(g.hub.t) : '', ohInfo = g.oh ? 'guardado em ' + hora(g.oh.t) : '';
  let hubT = g.hub ? g.hub.t : 0, ohT = g.oh ? g.oh.t : 0;
  const diaDe = t => t ? new Date(t).toLocaleDateString('pt-BR') : '';
  const e = (tag, css, txt) => { const x = document.createElement(tag); if (css) x.style.cssText = css; if (txt != null) x.textContent = txt; return x; };
  const fundo = e('div', 'position:fixed;inset:0;z-index:2147483647;background:rgba(20,10,50,.55);display:flex;align-items:center;justify-content:center;font:13px/1.4 Segoe UI,Arial,sans-serif');
  fundo.id = 'central-plan';
  const jan = e('div', 'background:#fff;color:#222;width:560px;max-width:94vw;max-height:92vh;overflow:auto;border-radius:10px;box-shadow:0 6px 30px rgba(0,0,0,.45)');
  const topo = e('div', 'background:#3a1f6d;color:#fff;padding:12px 16px;font-weight:700;font-size:15px;display:flex;justify-content:space-between', 'Planilha de pendências');
  const fecha = e('span', 'cursor:pointer', '✕'); fecha.onclick = () => fundo.remove(); topo.appendChild(fecha);
  const corpo = e('div', 'padding:14px 16px');
  const bloco = (titulo, tipo) => {
    const caixa = e('div', 'border:1px solid #d9d3ea;border-radius:8px;padding:8px 10px;margin-bottom:10px');
    const t = e('div', 'font-weight:700;margin-bottom:2px', titulo);
    const inf = e('div', 'font-size:12px;color:#555;margin-bottom:6px');
    const arq = e('input'); arq.type = 'file'; arq.accept = '.csv,.txt,.tsv'; arq.style.display = 'none';
    const b = e('button', 'padding:3px 10px;cursor:pointer;border:1px solid #bbb;border-radius:5px;background:#f4f1fb', 'Escolher outro CSV');
    b.onclick = () => arq.click();
    const pinta = () => {
      const txt = tipo === 'hub' ? hubTxt : ohTxt, info = tipo === 'hub' ? hubInfo : ohInfo;
      let n = 0; try { n = txt ? parseCsv(txt).length : 0; } catch (x) {}
      inf.textContent = txt ? n + ' pendência(s), ' + info + '.' : (tipo === 'hub' ? 'Nada guardado. Rode "Verificar pendências (Painel)" ou escolha o CSV.' : 'Nada guardado (opcional). Rode a consulta no OneHub ou escolha o CSV. Sem ele, a planilha sai só com o Painel.');
      inf.style.color = txt ? '#1b6b35' : '#9c3a00';
      if (tipo === 'oh') {
        bTira.style.display = txt ? '' : 'none';
        if (txt && hubT && ohT && diaDe(ohT) !== diaDe(hubT)) { inf.textContent += ' ATENÇÃO: é de outro dia que o Painel (' + diaDe(hubT) + '). Se não rodou o OneHub hoje, clique em "Não usar o OneHub".'; inf.style.color = '#9c3a00'; }
      }
    };
    const bTira = e('button', 'padding:3px 10px;cursor:pointer;border:1px solid #e0a2a2;border-radius:5px;background:#fdf1ef;color:#7a1d12;margin-left:6px', 'Não usar o OneHub');
    bTira.onclick = async () => { await stDel(CH.oh); ohTxt = ''; ohInfo = ''; ohT = 0; pinta(); msg.style.color = '#333'; msg.textContent = 'OneHub tirado: a planilha (e o Baixa Hubii) passam a usar só o Painel, até você rodar o OneHub de novo ou escolher um CSV.'; };
    arq.onchange = async () => { const f = arq.files[0]; if (!f) return; const x = await f.text(); if (tipo === 'hub') { hubTxt = x; hubInfo = 'arquivo ' + f.name; hubT = Date.now(); } else { ohTxt = x; ohInfo = 'arquivo ' + f.name; ohT = Date.now(); } await stSet({ [CH[tipo]]: { t: Date.now(), csv: x } }); pinta(); arq.value = ''; };
    pinta(); caixa.append(t, inf, b); if (tipo === 'oh') caixa.append(bTira); caixa.append(arq); return caixa;
  };
  const chk = e('input'); chk.type = 'checkbox'; chk.checked = !!g.opc.despachoOk;
  const lab = e('label', 'display:block;margin:4px 0 10px;font-size:12px;cursor:pointer');
  lab.append(chk, document.createTextNode(' Tratar todo pedido em Despacho como "Dar baixa" (use só se NÃO rodou a verificação com "Esperando Expedição" marcada; o CSV não traz o sub-status).'));
  const dt = e('input', 'width:110px;margin-left:6px'); dt.value = hoje();
  const linDt = e('div', 'margin-bottom:10px;font-size:12px', 'Data que aparece no título:'); linDt.appendChild(dt);
  const msg = e('div', 'min-height:18px;font-size:12px;margin:6px 0;color:#333');
  const bGera = e('button', 'height:44px;padding:0 22px;cursor:pointer;border:0;border-radius:9px;background:#5b3cc4;color:#fff;font-size:15px;font-weight:700', 'Gerar planilha (.xlsx)');
  bGera.onclick = async () => {
    try {
      if (!hubTxt) { msg.textContent = 'Falta o CSV do Painel Hubii.'; return; }
      const dados = motor(parseCsv(hubTxt), ohTxt ? parseCsv(ohTxt) : [], { despachoOk: chk.checked });
      await stSet({ [CH.opc]: { despachoOk: chk.checked } });
      const d = new Date(), nome = 'Painel-Hubii-OneHub-pendencias-' + String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0') + '.xlsx';
      baixar(nome, gerarXlsx(dados, dt.value || hoje()));
      const c = x => dados.filter(r => r.dest === x).length;
      msg.style.color = '#1b6b35';
      msg.textContent = 'Pronto: ' + nome + '. ' + c('Dar baixa') + ' para dar baixa, ' + c('Cancelar') + ' para cancelar, ' + c('Aguardar/conferir') + ' para aguardar/conferir.';
      if (window.__centralReg) window.__centralReg.add({ k: 'planilha', t: Date.now(), n: dados.length });
    } catch (x) { msg.style.color = '#9c3a00'; msg.textContent = 'Erro: ' + x.message; }
  };
  const dica = e('div', 'font-size:12px;color:#555;margin-top:8px', 'No OnePet, o Baixa Hubii tem o botão "Planilha da Central (última)", que usa estes mesmos dados sem precisar abrir o arquivo.');
  corpo.append(bloco('1. Painel Hubii', 'hub'), bloco('2. OneHub (opcional)', 'oh'), lab, linDt, bGera, msg, dica);
  jan.append(topo, corpo); fundo.appendChild(jan); document.body.appendChild(fundo);
  fundo.addEventListener('mousedown', ev => { if (ev.target === fundo) fundo.remove(); });
};

window.__centralPlan = { empacotar, novoEstilo, novaPlanilha, cel, baixar, parseCsv, motor, gerarXlsx, abasParaBaixa, montarPlanilhas, money, COLS, salvar, abrir, ultimaParaBaixa };
if (typeof module !== 'undefined') module.exports = window.__centralPlan;
})();
