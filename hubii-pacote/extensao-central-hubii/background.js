// Fecha a aba da etiqueta aberta pelo Hubii quando a Central está só LENDO o código BR (sem imprimir).
// A Central avisa "ativo" na aba do Hubii; qualquer aba aberta a partir dela é fechada logo depois.
const guardar = ativos => { try { chrome.storage.session.set({ central_fechar_abas: ativos }); } catch (e) {} };
const ler = () => new Promise(r => { try { chrome.storage.session.get('central_fechar_abas', o => r((o && o.central_fechar_abas) || [])); } catch (e) { r([]); } });
chrome.runtime.onMessage.addListener((m, s) => {
  if (!m || m.central !== 'fechar-abas' || !s || !s.tab) return;
  ler().then(a => { const t = s.tab.id; const i = a.indexOf(t); if (m.ativo && i < 0) a.push(t); if (!m.ativo && i >= 0) a.splice(i, 1); guardar(a); });
});
chrome.tabs.onCreated.addListener(async tab => {
  try {
    if (tab.openerTabId == null) return;
    const a = await ler(); if (!a.includes(tab.openerTabId)) return;
    setTimeout(() => { chrome.tabs.remove(tab.id).catch(() => {}); }, 700);
  } catch (e) {}
});

// ---------- Painel local da Central (http://localhost:8765)
// Junta os números do dia (registro de rotinas, etiquetas impressas, pendências coletadas) e o que as páginas abertas
// informam (painel-ponte.js) e manda ao painel. Se o painel estiver desligado, não faz nada. Nada sai do computador.
const PAINEL = 'http://localhost:8765/api/ext';
const paginas = new Map(); // id da aba -> { t, d }
let ultimoEnvio = 0, enviando = false, cacheDia = { t: 0, v: null };
const fonteId = async () => {
  const o = await chrome.storage.local.get('painel_fonte');
  if (o && o.painel_fonte) return o.painel_fonte;
  const id = 'f' + Math.random().toString(36).slice(2, 10);
  await chrome.storage.local.set({ painel_fonte: id }); return id;
};
const resumoDia = async () => {
  if (cacheDia.v && Date.now() - cacheDia.t < 8000) return cacheDia.v;
  const todo = await chrome.storage.local.get(null);
  const ini = new Date(); ini.setHours(0, 0, 0, 0); const t0 = ini.getTime();
  const hoje = { descritivos: { n: 0, ult: 0 }, etiquetas: { n: 0, ult: 0 } };
  let coleta = null;
  for (const k in todo) {
    if (!k.startsWith('ev_')) continue;
    const e = todo[k]; if (!e || !e.t) continue;
    if ((e.k === 'descritivos' || e.k === 'etiquetas') && e.t >= t0) { hoje[e.k].n += e.n || 0; hoje[e.k].ult = Math.max(hoje[e.k].ult, e.t); }
    if (e.k === 'coleta' && (!coleta || e.t > coleta.t)) coleta = { t: e.t, n: e.n || 0 };
  }
  // etiquetas: o histórico é gravado a cada etiqueta (o registro só no fim da rodada), então vale o maior
  try {
    const h = todo.espelho_hubii_etiquetas_historico; const lista = h && h.v ? JSON.parse(h.v) : [];
    const dia = new Date().toLocaleDateString('pt-BR');
    const doDia = lista.filter(x => x && x.dia === dia);
    if (doDia.length > hoje.etiquetas.n) { hoje.etiquetas.n = doDia.length; hoje.etiquetas.ult = Math.max(hoje.etiquetas.ult, ...doDia.map(x => x.t || 0)); }
  } catch (e) {}
  let pend = null;
  if (coleta) pend = { t: coleta.t, n: (todo.painel_pend && todo.painel_pend.n != null && todo.painel_pend.t >= coleta.t - 600000) ? todo.painel_pend.n : coleta.n };
  cacheDia = { t: Date.now(), v: { hoje, pend } };
  return cacheDia.v;
};
const enviarPainel = async forcar => {
  if (enviando || (!forcar && Date.now() - ultimoEnvio < 3000)) return;
  enviando = true; ultimoEnvio = Date.now();
  try {
    const agora = Date.now();
    for (const [k, v] of paginas) if (agora - v.t > 20000) paginas.delete(k);
    const r0 = await resumoDia();
    const fonte = await fonteId();
    const hist = await histParaEnviar();
    const pd = await pendParaEnviar();
    const corpo = { fonte, versao: chrome.runtime.getManifest().version, t: agora, dia: new Date().toLocaleDateString('pt-BR'), hoje: r0.hoje, pend: r0.pend, paginas: [...paginas.values()].map(v => v.d), hist: hist.map(h => JSON.stringify(Object.assign({ fonte }, h))) };
    if (pd) corpo.pendDados = pd.dados;
    const r = await fetch(PAINEL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Central': '1' }, body: JSON.stringify(corpo) });
    if (r.ok) {
      const j = await r.json();
      if (j.histOk && hist.length) await histConfirmar(hist);
      if (pd && j.pendOk) pendEnviado = pd.sig;
      (j.ordens || []).forEach(o => {
        if (o.acao === 'parar') for (const id of paginas.keys()) chrome.tabs.sendMessage(id, { central: 'painel-parar' }).catch(() => {});
        if (o.acao === 'backup') fazerBackup(o.id, fonte).catch(() => {});
        if (o.acao === 'restaurar') restaurar(o.id, fonte).catch(() => {});
        if (o.acao === 'recarregar') recarregarExtensao().catch(() => {});
      });
    }
  } catch (e) { /* painel desligado: tudo bem */ }
  finally { enviando = false; }
};
chrome.runtime.onMessage.addListener((m, s) => {
  if (!m || m.central !== 'painel' || !s || !s.tab) return;
  paginas.set(s.tab.id, { t: Date.now(), d: m.d || {} });
  if (m.d && m.d.pend && m.d.pend.n != null) {
    chrome.storage.local.get('painel_pend').then(o => {
      const a = o && o.painel_pend;
      if (!a || a.n !== m.d.pend.n) { chrome.storage.local.set({ painel_pend: { n: m.d.pend.n, t: Date.now() } }); cacheDia.t = 0; }
    }).catch(() => {});
  }
  enviarPainel(false);
});
chrome.tabs.onRemoved.addListener(id => paginas.delete(id));

// histórico por pedido: manda ao painel os registros "h_<pedido>" que mudaram desde o último envio confirmado
const histSujos = new Set(); let histVarrido = false;
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local') return;
  let novo = false;
  for (const k in ch) if (k.startsWith('h_') && ch[k].newValue) { histSujos.add(k); novo = true; }
  if (novo) setTimeout(() => enviarPainel(true), 1500);
});
const histParaEnviar = async () => {
  if (!histVarrido) { // uma vez por partida do background: confere tudo que ainda não foi confirmado
    histVarrido = true;
    const todo = await chrome.storage.local.get(null); const ack = todo.painel_hist_ack || 0;
    const velhos = [];
    for (const k in todo) if (k.startsWith('h_') && todo[k]) { if ((todo[k].u || 0) > ack) histSujos.add(k); else if (todo[k].u < Date.now() - 60 * 86400000) velhos.push(k); }
    if (velhos.length) await chrome.storage.local.remove(velhos); // já estão no arquivo do painel
  }
  if (!histSujos.size) return [];
  const o = await chrome.storage.local.get([...histSujos]);
  for (const k of [...histSujos]) if (!o[k]) histSujos.delete(k);
  return Object.values(o).filter(Boolean).sort((a, b) => (a.u || 0) - (b.u || 0)).slice(0, 300); // mais antigos primeiro
};
const histConfirmar = async enviados => {
  const o = await chrome.storage.local.get(enviados.map(h => 'h_' + h.id));
  let max = (await chrome.storage.local.get('painel_hist_ack')).painel_hist_ack || 0;
  enviados.forEach(h => { const k = 'h_' + h.id; const atual = o[k]; if (!atual || atual.u === h.u) histSujos.delete(k); max = Math.max(max, h.u || 0); });
  await chrome.storage.local.set({ painel_hist_ack: max });
};
try {
  chrome.alarms.create('central-painel', { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener(a => { if (a && a.name === 'central-painel') enviarPainel(true); });
} catch (e) {}
enviarPainel(true);

// ---------- pendências verificadas (Painel Hubii e OneHub): o painel mostra o resultado e a ação de cada uma
let pendEnviado = '';
const pendParaEnviar = async () => {
  const o = await chrome.storage.local.get(['central_dados_hub', 'central_dados_oh', 'central_plan_opcoes']);
  if (!o.central_dados_hub && !o.central_dados_oh) return null;
  const sig = (o.central_dados_hub ? o.central_dados_hub.t : 0) + '|' + (o.central_dados_oh ? o.central_dados_oh.t : 0) + '|' + JSON.stringify(o.central_plan_opcoes || {});
  if (sig === pendEnviado) return null;
  return { sig, dados: { hub: o.central_dados_hub || null, oh: o.central_dados_oh || null, opc: o.central_plan_opcoes || {} } };
};
chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && (ch.central_dados_hub || ch.central_dados_oh)) setTimeout(() => enviarPainel(true), 2500); });

// ---------- backup e restauração (pedidos pelo painel)
// Backup: manda ao painel tudo o que esta extensão guarda neste Chrome (relatório, memórias, códigos BR, pendências...).
const BASE = 'http://localhost:8765';
const fazerBackup = async (id, fonte) => {
  const todo = await chrome.storage.local.get(null);
  const corpo = JSON.stringify({ id, fonte, versao: chrome.runtime.getManifest().version, t: Date.now(), dados: todo });
  await fetch(BASE + '/api/backup-ext', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Central': '1' }, body: corpo });
};
// Restauração: grava só o que está FALTANDO neste Chrome (nunca apaga nem troca o que já existe).
// Não restaura o histórico por pedido (ele volta direto para o arquivo do painel) nem a identificação deste Chrome.
const restaurar = async (id, fonte) => {
  const r = await fetch(BASE + '/api/restaurar-dados?id=' + encodeURIComponent(id), { cache: 'no-store' });
  if (!r.ok) return;
  const b = await r.json(); const atual = await chrome.storage.local.get(null);
  const novo = {}; let n = 0;
  Object.values(b.storages || {}).forEach(d => {
    for (const k in (d || {})) {
      if (k.startsWith('h_') || k.startsWith('painel_') || k in atual || k in novo) continue;
      novo[k] = d[k]; n++;
    }
  });
  if (n) await chrome.storage.local.set(novo);
  cacheDia.t = 0;
  await fetch(BASE + '/api/restaurar-ok', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Central': '1' }, body: JSON.stringify({ id, fonte, n }) });
};

// ---------- atualização pelo painel: a extensão se recarrega sozinha (sem abrir chrome://extensions)
// e, ao voltar, atualiza as abas do Hubii/OnePet que estavam abertas, para elas usarem a versão nova.
const recarregarExtensao = async () => {
  await chrome.storage.local.set({ painel_recarregar_abas: { t: Date.now(), abas: [...paginas.keys()] } });
  setTimeout(() => chrome.runtime.reload(), 500);
};
(async () => {
  try {
    const o = await chrome.storage.local.get('painel_recarregar_abas'); const r = o && o.painel_recarregar_abas;
    if (!r) return;
    await chrome.storage.local.remove('painel_recarregar_abas');
    if (Date.now() - r.t > 5 * 60000) return;
    setTimeout(() => (r.abas || []).forEach(id => chrome.tabs.reload(id).catch(() => {})), 1500);
  } catch (e) {}
})();
