// Modo suporte: monta um relatório de diagnóstico SEM dados pessoais para colar no chat de suporte.
(() => {
if (window.__centralSup) return;
const stGet = k => new Promise(r => { try { chrome.storage.local.get(k, o => r(o || {})); } catch (e) { r({}); } });
const pad = n => String(n).padStart(2, '0');
const quando = t => { const d = new Date(t); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const dur = ms => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + pad(s % 60) + ' s'; };
const inicial = n => String(n).trim().split(/\s+/).map(p => (p[0] || '').toUpperCase() + '.').join('');

// ---------- remoção de dados pessoais
let nomes = [];
const limpar = txt => {
  let t = String(txt == null ? '' : txt);
  nomes.filter(n => n && n.trim().length > 2).sort((a, b) => b.length - a.length).forEach(n => { t = t.split(n).join('[' + inicial(n) + ']'); });
  return t
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF]').replace(/\b\d{11}\b/g, '[CPF?]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, '[telefone]')
    .replace(/\b\d{5}-\d{3}\b/g, '[CEP]')
    .replace(/R\$\s?[\d.]+,\d{2}/g, 'R$ [valor]');
};

// ---------- coleta por tela
const verif = (lista, ok, titulo, detalhe) => lista.push((ok ? '[OK]   ' : '[FALHA] ') + titulo + (detalhe ? ': ' + detalhe : ''));
const estadoPagina = async () => {
  const L = [], h = location.host;
  const comp = { 'registro (cronômetro)': !!window.__centralReg, 'planilha': !!window.__centralPlan, 'rotinas': Object.keys(window.__centralBM || {}).join(', ') || 'nenhuma' };
  L.push('Componentes carregados: ' + Object.entries(comp).map(([k, v]) => k + '=' + (v === true ? 'sim' : v === false ? 'NÃO' : v)).join('; '));
  if (h === 'hub.hubii.co') {
    let d = null; try { d = window.__centralDiag && window.__centralDiag(); } catch (e) { L.push('Erro ao ler a tela do Hubii: ' + e.message); }
    if (!d) verif(L, false, 'Leitura da tela do Hubii', 'o leitor da Central não respondeu (recarregue a página com F5)');
    else {
      verif(L, d.tabela, 'Cabeçalho da tabela de pedidos ("ID Pedido")');
      verif(L, d.linhas > 0, 'Pedidos lidos na tela', d.linhas + ' linha(s)');
      verif(L, d.pag !== null, 'Contador "Mostrando X a Y de N pedidos"', d.pag || 'não achei');
      verif(L, d.aba, 'Aba Despacho encontrada', d.badge !== null ? 'contador da aba: ' + d.badge : 'sem contador visível');
      L.push('Linhas por status (contagem): ' + Object.entries(d.status).map(([k, v]) => k + '=' + v).join('; '));
      L.push('Tela de detalhe de pedido aberta: ' + (d.detalhe ? 'sim' : 'não') + '; rotina rodando nesta aba: ' + (d.ocupado ? 'sim' : 'não'));
      try { const lg = JSON.parse(localStorage.getItem('hubii_central_log') || '[]').slice(-12); if (lg.length) { L.push('Últimas mensagens da rotina (mais antigas primeiro):'); lg.forEach(x => L.push('  ' + quando(x.t) + ':' + pad(new Date(x.t).getSeconds()) + ' ' + x.m)); } } catch (e) {}
      L.push('Memória guardada: fila de etiquetas=' + d.fila + ' pedido(s); histórico de etiquetas (14 dias)=' + d.hist + '; faturados recentes=' + d.fat);
    }
    L.push('Verificação de pendências aberta: ' + (document.getElementById('hubii-pend') ? 'sim' : 'não'));
  } else if (h === 'onehub.onepet.com.br') {
    const tb = [...document.querySelectorAll('table')].filter(t => t.getClientRects().length);
    verif(L, !document.querySelector('input[type=password]'), 'Sessão do OneHub (sem tela de login)');
    verif(L, tb.length > 0, 'Tabela visível no OneHub', tb.length + ' tabela(s), ' + tb.reduce((a, t) => a + t.querySelectorAll('tbody tr').length, 0) + ' linha(s)');
    L.push('Consulta no OneHub aberta: ' + (document.getElementById('hubii-oh') ? 'sim' : 'não'));
  } else if (/onepet\.com\.br$/.test(h)) {
    let d = null; try { d = window.__centralDiagBaixa && window.__centralDiagBaixa(); } catch (e) { L.push('Erro ao ler a tela do OnePet: ' + e.message); }
    if (!d) verif(L, false, 'Leitura da tela do OnePet', 'o leitor da Baixa não respondeu (recarregue a página com F5)');
    else {
      L.push('Tela reconhecida: ' + (d.pend ? 'Pendências' : d.pdv ? 'PDV' : 'outra (nem Pendências nem PDV)'));
      verif(L, d.painel, 'Painel Baixa Hubii visível', d.pend || d.pdv ? '' : 'normal fora de Pendências/PDV');
      verif(L, !d.sessao, 'Estado da baixa guardado', d.sessao || 'nenhuma baixa em andamento');
    }
    L.push('Pendências coletadas guardadas neste navegador: ' + (d && d.coletadas != null ? d.coletadas : '?'));
  } else L.push('Site não reconhecido pela Central.');
  return L;
};
const resumoDados = async () => {
  const o = await stGet(null), L = [];
  const conta = k => { const x = o[k]; if (!x || !x.csv) return 'nada guardado'; let n = 0; try { n = window.__centralPlan.parseCsv(x.csv).length; } catch (e) { n = '?'; } return n + ' pendência(s), guardado em ' + quando(x.t); };
  L.push('Painel Hubii (CSV guardado): ' + conta('central_dados_hub'));
  L.push('OneHub (CSV guardado): ' + conta('central_dados_oh'));
  const ev = Object.keys(o).filter(k => k.startsWith('ev_')).map(k => o[k]).filter(e => e && e.t).sort((a, b) => b.t - a.t);
  L.push('Registros de desempenho guardados: ' + ev.length);
  const ult = ev.slice(0, 15).map(e => {
    const ini = e.t0 || (e.t - (e.ms || 0));
    return '  ' + quando(e.t) + '  ' + e.k + (e.n != null ? ' itens=' + e.n : '') + (e.pul ? ' pulados=' + e.pul : '') + ' duração=' + dur(e.t - ini) + (e.parado ? ' PAROU ANTES DO FIM' : '') + (e.res ? ' resultado=' + e.res : '');
  });
  return { L, ult, bx: o.baixaHubii || null };
};

const gerar = async () => {
  nomes = [];
  let v = '?'; try { v = chrome.runtime.getManifest().version; } catch (e) {}
  const [pg, dd] = await Promise.all([estadoPagina(), resumoDados()]);
  try { nomes = ((dd.bx && dd.bx.fila) || []).map(x => x.nome); } catch (e) {}
  const T = [];
  T.push('RELATÓRIO DE SUPORTE: Central Hubii ' + v);
  T.push('Gerado em ' + new Date().toLocaleString('pt-BR') + ' (fuso ' + Intl.DateTimeFormat().resolvedOptions().timeZone + ')');
  T.push('Dados pessoais removidos (nomes viram iniciais; CPF, e-mail, telefone, CEP e valores são ocultados).');
  T.push('');
  T.push('== Onde estou ==');
  T.push('Site: ' + location.host + location.pathname + ' (aba em ' + (document.visibilityState === 'visible' ? 'primeiro plano' : 'segundo plano') + ')');
  T.push('Navegador: ' + (navigator.userAgent.match(/Chrome\/[\d.]+/) || ['?'])[0] + '; tela ' + innerWidth + 'x' + innerHeight);
  T.push('');
  T.push('== Verificações desta tela ==');
  pg.forEach(x => T.push(x));
  T.push('');
  T.push('== Dados guardados ==');
  dd.L.forEach(x => T.push(x));
  if (dd.bx) {
    const b = dd.bx, cont = {}; (b.resultados || []).forEach(r => { cont[r.res] = (cont[r.res] || 0) + 1; });
    T.push('Baixa Hubii guardada: fase=' + b.fase + (b.faseParou ? ' (parou em ' + b.faseParou + ')' : '') + '; cliente ' + ((b.i || 0) + 1) + ' de ' + ((b.fila || []).length) + '; rodando=' + (b.rodando ? 'sim' : 'não') + '; resultados: ' + (Object.entries(cont).map(([k, n]) => k + '=' + n).join(', ') || 'nenhum'));
    if (b.motivo) T.push('Motivo da última parada: ' + b.motivo);
  } else T.push('Baixa Hubii guardada: nenhuma');
  T.push('');
  T.push('== Últimas execuções (mais recentes primeiro) ==');
  (dd.ult.length ? dd.ult : ['  nenhuma']).forEach(x => T.push(x));
  T.push('');
  T.push('Descreva abaixo o que aconteceu (o que você clicou e o que esperava):');
  return limpar(T.join('\n'));
};

const abrir = async () => {
  const v = document.getElementById('central-sup'); if (v) v.remove();
  const e = (tag, css, txt) => { const x = document.createElement(tag); if (css) x.style.cssText = css; if (txt != null) x.textContent = txt; return x; };
  const fundo = e('div', 'position:fixed;inset:0;z-index:2147483647;background:rgba(20,10,50,.55);display:flex;align-items:center;justify-content:center;font:13px/1.4 Segoe UI,Arial,sans-serif'); fundo.id = 'central-sup';
  const jan = e('div', 'background:#fff;color:#222;width:720px;max-width:95vw;max-height:92vh;display:flex;flex-direction:column;border-radius:10px;box-shadow:0 6px 30px rgba(0,0,0,.45)');
  const topo = e('div', 'background:#3a1f6d;color:#fff;padding:12px 16px;font-weight:700;font-size:15px;display:flex;justify-content:space-between', 'Suporte da Central Hubii');
  const fecha = e('span', 'cursor:pointer', '✕'); fecha.onclick = () => fundo.remove(); topo.appendChild(fecha);
  const nota = e('div', 'padding:10px 16px 0;font-size:12px;color:#555', 'Este relatório diz o que a Central está vendo nesta tela. Não leva dados de clientes. Copie e cole no chat de suporte, junto com uma frase do que aconteceu.');
  const ta = e('textarea', 'margin:8px 16px;height:380px;font:12px/1.4 Consolas,monospace;color:#111;background:#fafafa;border:1px solid #ccc;border-radius:6px;padding:8px;resize:vertical'); ta.readOnly = false; ta.value = 'Gerando...';
  const rod = e('div', 'padding:0 16px 14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center');
  const mk = (t, f, cor) => { const b = e('button', 'height:42px;padding:0 18px;cursor:pointer;border-radius:9px;border:1px solid #b9b2dc;font-size:14px;font-weight:600;' + (cor ? 'background:#5b3cc4;color:#fff;border-color:#5b3cc4' : 'background:#fff;color:#2d254d'), t); b.onclick = f; return b; };
  const msg = e('span', 'font-size:12px;color:#1b6b35');
  const copiar = mk('Copiar relatório', async () => { try { await navigator.clipboard.writeText(ta.value); } catch (x) { ta.select(); document.execCommand('copy'); } msg.textContent = 'Copiado. Cole no chat e escreva embaixo o que aconteceu.'; }, true);
  const baixa = mk('Baixar como arquivo', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + ta.value], { type: 'text/plain;charset=utf-8' })); a.download = 'suporte-central-hubii-' + new Date().toISOString().slice(0, 10) + '.txt'; document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 3000); });
  const atual = mk('Atualizar', async () => { msg.textContent = ''; ta.value = await gerar(); });
  rod.append(copiar, baixa, atual, msg);
  jan.append(topo, nota, ta, rod); fundo.appendChild(jan); document.body.appendChild(fundo);
  fundo.addEventListener('mousedown', ev => { if (ev.target === fundo) fundo.remove(); });
  try { ta.value = await gerar(); } catch (x) { ta.value = 'Erro ao gerar o relatório: ' + x.message; }
};
window.__centralSup = { abrir, gerar, limpar };
})();
