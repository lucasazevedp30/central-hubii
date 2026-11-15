// Conferência de despacho: bipa a etiqueta de cada pacote (código de barras "BR..." ou QR code) e marca o pedido.
// Mostra o que falta, avisa pacote repetido ou fora da lista e gera a planilha pintada no fim.
(() => {
if (window.__centralConf) return;
const K = 'hubii_conferencia';
const ler = () => { try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { return null; } };
const gravar = s => { try { if (s) localStorage.setItem(K, JSON.stringify(s)); else localStorage.removeItem(K); } catch (e) {} };
const hora = t => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dataHora = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const e = (tag, css, txt) => { const x = document.createElement(tag); if (css) x.style.cssText = css; if (txt != null) x.textContent = txt; return x; };
const D = () => window.__centralConfDados;

let ctx = null;
const bip = tipo => {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const toca = (f, ini, dur) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.type = 'square'; g.gain.value = 0.08; o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + ini); o.stop(ctx.currentTime + ini + dur); };
    if (tipo === 'ok') toca(1320, 0, 0.09);
    else if (tipo === 'rep') { toca(700, 0, 0.1); toca(700, 0.16, 0.1); }
    else { toca(220, 0, 0.45); }
  } catch (x) {}
};

// interpreta o que foi bipado ou digitado
const interpretar = (bruto, S, brs) => {
  const cod = String(bruto || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!cod) return null;
  if (/^BR\d{8,}[A-Z]?$/.test(cod)) {
    // compara sem a letra final (algumas etiquetas terminam em letra, ex.: BR265341661201P)
    const base = cod.replace(/[A-Z]+$/, '');
    const id = Object.keys(brs).find(k => brs[k] && String(brs[k].br).replace(/[A-Z]+$/, '') === base);
    return id ? { id, br: cod } : { erro: 'br', br: cod };
  }
  if (/^#?\d{5,9}$/.test(cod)) return { id: cod.replace('#', '') };
  if (/^\d{44}$/.test(cod)) return { erro: 'nf' };
  return { erro: 'outro', cod };
};

const abrir = () => {
  const velho = document.getElementById('central-conf'); if (velho) velho.remove();
  let S = ler();
  let pendBR = null; // BR bipado que a Central não conhecia: o próximo número de pedido digitado fica ligado a ele
  const fundo = e('div', 'position:fixed;inset:0;z-index:2147483646;background:rgba(20,10,50,.55);display:flex;align-items:center;justify-content:center;font:14px/1.4 Segoe UI,Arial,sans-serif'); fundo.id = 'central-conf';
  const jan = e('div', 'background:#f3f1fa;color:#1b1740;width:940px;max-width:96vw;height:92vh;display:flex;flex-direction:column;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,.45);overflow:hidden');
  const topo = e('div', 'background:linear-gradient(120deg,#2d1b5e,#1b1f48 55%,#121e38);color:#fff;padding:14px 18px;font-weight:700;font-size:16px;display:flex;justify-content:space-between;align-items:center', 'Conferência de despacho');
  const fecha = e('span', 'cursor:pointer;font-size:18px;padding:0 6px', '✕'); fecha.title = 'Fechar (a conferência fica guardada)'; topo.appendChild(fecha);
  const corpo = e('div', 'padding:14px 18px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:12px');
  jan.append(topo, corpo); fundo.appendChild(jan); document.body.appendChild(fundo);
  const sair = () => { document.removeEventListener('keydown', teclado, true); fundo.remove(); };
  fecha.onclick = sair;
  const btn = (t, f, tipo) => { const b = e('button', 'height:38px;padding:0 14px;cursor:pointer;border-radius:10px;font:600 13px Segoe UI,Arial,sans-serif;' + (tipo === 'pri' ? 'background:#5b3cc4;color:#fff;border:0' : tipo === 'per' ? 'background:#fff;color:#b3261e;border:1px solid #e0a2a2' : 'background:#fff;color:#3a1f6d;border:1px solid #b9b2dc'), t); b.onclick = f; return b; };
  const cartao = () => e('div', 'background:#fff;border:1px solid #ddd8f2;border-radius:12px;padding:12px 14px');
  let inp = null;
  const teclado = ev => { if (!inp || !document.body.contains(inp)) return; const t = ev.target; if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t !== inp))) return; if (ev.key.length === 1 && !ev.ctrlKey && !ev.altKey && !ev.metaKey && document.activeElement !== inp) inp.focus(); };
  document.addEventListener('keydown', teclado, true);

  // ---------- tela 1: escolher a lista
  const telaInicio = aviso => {
    corpo.textContent = ''; inp = null;
    const c = cartao();
    c.append(e('div', 'font-weight:700;font-size:15px;margin-bottom:4px', 'Quais pedidos vão sair hoje?'), e('div', 'color:#4a4570;font-size:13px;margin-bottom:10px', 'Escolha de onde vem a lista. Depois é só bipar a etiqueta de cada pacote (código de barras "BR..." ou qualquer QR code da etiqueta).'));
    const msg = e('div', 'min-height:18px;font-size:13px;color:#9c3a00;margin-top:8px', aviso || '');
    const hoje = (D() && D().impressasHoje()) || [];
    const comecar = (ids, origem) => {
      ids = [...new Set(ids.map(String))];
      if (!ids.length) { msg.textContent = 'Não achei nenhum pedido nessa origem.'; return; }
      S = { t0: Date.now(), origem, lista: ids, conf: {}, fora: [] }; gravar(S); telaBipar();
    };
    const b1 = btn('Ler a aba Despacho ("Esperando Expedição")', async () => {
      if (!D()) { msg.textContent = 'A Central não carregou por completo. Recarregue a página (F5).'; return; }
      b1.disabled = true; msg.style.color = '#333'; msg.textContent = 'Lendo todas as páginas da aba Despacho...';
      fundo.style.display = 'none';
      try { const r = await D().lerExpedicao(); fundo.style.display = 'flex'; msg.style.color = '#9c3a00'; comecar(r.ids, 'aba Despacho, "Esperando Expedição"' + (r.total != null ? ' (a tela diz ' + r.total + ')' : '')); }
      catch (x) { fundo.style.display = 'flex'; msg.style.color = '#9c3a00'; msg.textContent = 'Erro: ' + x.message; }
      b1.disabled = false;
    }, 'pri');
    const b2 = btn('Etiquetas impressas hoje pela Central (' + hoje.length + ')', () => comecar(hoje, 'etiquetas impressas hoje pela Central'));
    if (!hoje.length) { b2.disabled = true; b2.style.opacity = '.5'; b2.style.cursor = 'default'; }
    const lin = e('div', 'display:flex;gap:8px;flex-wrap:wrap'); lin.append(b1, b2);
    const ta = e('textarea', 'width:100%;box-sizing:border-box;height:90px;margin-top:12px;border:1px solid #b9b2dc;border-radius:8px;padding:8px;font:13px Consolas,monospace;color:#1b1740');
    ta.placeholder = 'Ou cole aqui os números dos pedidos (um por linha ou separados por espaço)';
    const b3 = btn('Usar a lista colada', () => comecar((ta.value.match(/\d{5,9}/g) || []), 'lista colada'));
    b3.style.marginTop = '8px';
    c.append(lin, ta, b3, msg);
    const brs = D() ? Object.keys(D().brs()).length : 0;
    const info = e('div', 'font-size:12.5px;color:#5a5480', 'Etiquetas na memória da Central (pedido + código BR): ' + brs + '. A Central guarda o código BR sozinha toda vez que uma etiqueta é aberta nesta página. Pacote com etiqueta fora da memória: digite o número do pedido, que está no topo da etiqueta.');
    corpo.append(c, info);
  };

  // ---------- tela 2: bipar
  const telaBipar = () => {
    corpo.textContent = '';
    const brs = () => (D() ? D().brs() : {});
    const faixa = e('div', 'border-radius:12px;padding:14px 16px;font-size:20px;font-weight:700;min-height:30px;background:#eee9fb;color:#3a1f6d', 'Pronto. Bipe a etiqueta do primeiro pacote.');
    const pinta = (tipo, t) => { const c = { ok: ['#d9f2e1', '#14532d'], rep: ['#fff1cc', '#6b4e00'], err: ['#fde2e0', '#7a1d12'], inf: ['#eee9fb', '#3a1f6d'] }[tipo]; faixa.style.background = c[0]; faixa.style.color = c[1]; faixa.textContent = t; };
    inp = e('input', 'flex:1;height:46px;border:2px solid #5b3cc4;border-radius:10px;padding:0 12px;font:600 18px Consolas,monospace;color:#1b1740;min-width:0');
    inp.placeholder = 'Bipe aqui (ou digite o número do pedido e Enter)'; inp.autocomplete = 'off'; inp.spellcheck = false;
    const linInp = e('div', 'display:flex;gap:8px;align-items:center'); linInp.append(inp, btn('OK', () => processar(), 'pri'));
    const cont = e('div', 'display:flex;align-items:baseline;gap:10px');
    const nBig = e('span', 'font-size:30px;font-weight:800;color:#3a1f6d'), nTxt = e('span', 'color:#4a4570;font-size:14px');
    cont.append(nBig, nTxt);
    const barra = e('div', 'height:10px;border-radius:6px;background:#ddd8f2;overflow:hidden'); const barraIn = e('div', 'height:100%;width:0;background:#1f9d55;transition:width .2s'); barra.appendChild(barraIn);
    const cols = e('div', 'display:flex;gap:12px;flex:1;min-height:180px');
    const colF = cartao(), colC = cartao(); [colF, colC].forEach(c => { c.style.flex = '1'; c.style.overflow = 'auto'; c.style.minHeight = '0'; });
    cols.append(colF, colC);
    const foraCx = e('div', 'font-size:13px;color:#7a1d12');
    const rod = e('div', 'display:flex;gap:8px;flex-wrap:wrap;align-items:center');
    const origem = e('div', 'font-size:12.5px;color:#5a5480');
    const escreveOrigem = () => { const rl = S.rel || []; origem.textContent = 'Lista: ' + S.origem + ', iniciada em ' + dataHora(S.t0) + '.' + (rl.length ? ' Lida de novo ' + rl.length + (rl.length > 1 ? ' vezes' : ' vez') + ' (última às ' + hora(rl[rl.length - 1].t).slice(0, 5) + '): ' + rl.reduce((a, x) => a + x.n, 0) + ' pedido(s) incluído(s) depois.' : ''); };
    escreveOrigem();
    const busca = e('input', 'height:34px;border:1px solid #b9b2dc;border-radius:8px;padding:0 10px;font:13px Segoe UI,Arial,sans-serif;color:#1b1740;width:300px;max-width:100%');
    busca.placeholder = 'Buscar pedido ou código BR nas listas'; busca.autocomplete = 'off'; busca.spellcheck = false;
    const linBusca = e('div', 'display:flex;gap:8px;align-items:center'); const limpa = btn('Limpar busca', () => { busca.value = ''; desenhar(); inp.focus(); }); limpa.style.height = '34px';
    linBusca.append(busca, limpa);
    // se bipar com o cursor na busca, o código vai para a conferência em vez de filtrar
    busca.addEventListener('input', () => { if (/^\s*BR\d{9,16}[A-Z]?\s*$/i.test(busca.value)) { inp.value = busca.value; busca.value = ''; processar(); } else desenhar(); });
    busca.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); inp.focus(); } else if (ev.key === 'Escape') { busca.value = ''; desenhar(); inp.focus(); } });
    corpo.append(faixa, linInp, cont, barra, linBusca, cols, foraCx, rod, origem);

    const desenhar = () => {
      const m = brs(); const feitos = S.lista.filter(id => S.conf[id]); const faltam = S.lista.filter(id => !S.conf[id]);
      const termo = busca.value.trim().toUpperCase().replace(/^#/, '');
      const casa = id => !termo || String(id).includes(termo) || (m[id] && String(m[id].br).includes(termo));
      nBig.textContent = feitos.length + ' de ' + S.lista.length; nTxt.textContent = faltam.length ? 'conferidos · faltam ' + faltam.length : 'conferidos · TUDO CONFERIDO';
      barraIn.style.width = (S.lista.length ? Math.round(feitos.length / S.lista.length * 100) : 0) + '%';
      const chip = (id, feito) => {
        const x = e('div', 'display:flex;justify-content:space-between;gap:8px;padding:4px 8px;border-radius:7px;margin-bottom:3px;font:600 13px Consolas,monospace;' + (feito ? 'background:#16856a;color:#fff' : 'background:#f6f4fc;color:#1b1740;cursor:pointer'));
        x.append(e('span', '', '#' + id), e('span', 'font-weight:400;font-size:12px;opacity:.9', (feito ? hora(S.conf[id].t) + (S.conf[id].m ? ' · à mão' : '') : (m[id] ? m[id].br : 'sem BR na memória')) + (S.add && S.add[id] ? ' · novo' : '')));
        if (!feito) { x.title = 'Duplo clique: marcar à mão'; x.ondblclick = () => { if (confirm('Marcar o pedido #' + id + ' como conferido à mão?')) { marcar(id, true); } }; }
        return x;
      };
      colF.textContent = ''; const fV = faltam.filter(casa), cV = feitos.filter(casa);
      colF.append(e('div', 'font-weight:700;margin-bottom:6px;color:#7a1d12', 'Faltam (' + faltam.length + ')' + (termo ? ' · mostrando ' + fV.length : ''))); fV.forEach(id => colF.append(chip(id, false)));
      if (termo && !fV.length && faltam.length) colF.append(e('div', 'color:#5a5480', 'Nenhum pedido que falta bate com a busca.'));
      if (!faltam.length) colF.append(e('div', 'color:#14532d;font-weight:600', 'Nenhum. Todos os pacotes da lista foram conferidos.'));
      colC.textContent = ''; colC.append(e('div', 'font-weight:700;margin-bottom:6px;color:#14532d', 'Conferidos (' + feitos.length + ')' + (termo ? ' · mostrando ' + cV.length : ''))); cV.slice().sort((a, b) => S.conf[b].t - S.conf[a].t).forEach(id => colC.append(chip(id, true)));
      foraCx.textContent = S.fora.length ? 'Bipados que NÃO estão na lista (' + S.fora.length + '): ' + S.fora.map(f => f.id ? '#' + f.id : f.cod).join(', ') : '';
    };
    const marcar = (id, aMao) => { S.conf[id] = { t: Date.now(), m: aMao ? 1 : 0 }; S.ult = id; gravar(S); try { if (window.__centralReg && window.__centralReg.pedido) window.__centralReg.pedido(id, { conf: S.conf[id].t }); } catch (x) {} desenhar(); };
    const processar = () => {
      const v = inp.value; inp.value = ''; inp.focus();
      const r = interpretar(v, S, brs()); if (!r) return;
      if (r.erro === 'nf') { bip('err'); pinta('err', 'Esse é o código da nota fiscal (o de baixo). Bipe o código de cima ("BR...") ou um QR code.'); return; }
      if (r.erro === 'outro') { bip('err'); pinta('err', 'Código não reconhecido: ' + r.cod.slice(0, 30) + '. Bipe o código "BR..." da etiqueta ou digite o número do pedido.'); return; }
      if (r.erro === 'br') { pendBR = r.br; bip('err'); pinta('err', 'Etiqueta ' + r.br + ' não está na memória da Central. Digite agora o número do pedido (topo da etiqueta) e Enter: eu marco e guardo esse código.'); return; }
      const id = r.id;
      if (pendBR && !r.br) { try { D() && D().vincular(id, pendBR); } catch (x) {} }
      pendBR = null;
      if (!S.lista.includes(id)) {
        if (!S.fora.some(f => f.id === id)) { S.fora.push({ id, t: Date.now(), m: r.br ? 0 : 1 }); gravar(S); }
        bip('err'); pinta('err', 'FORA DA LISTA: o pedido #' + id + ' não está nesta conferência. Separe este pacote e confira.'); desenhar(); return;
      }
      if (S.conf[id]) { bip('rep'); pinta('rep', 'JÁ CONFERIDO: pedido #' + id + ' foi bipado às ' + hora(S.conf[id].t) + '. Pacote repetido?'); return; }
      marcar(id, !r.br);
      const n = S.lista.filter(x => S.conf[x]).length;
      bip('ok'); pinta('ok', '✔ Pedido #' + id + ' conferido (' + n + ' de ' + S.lista.length + ')' + (n === S.lista.length ? '. TUDO CONFERIDO!' : ''));
    };
    // Ler de novo: relê "Esperando Expedição" e inclui só os pedidos novos. Nada do que já foi conferido se perde.
    const juntar = ids => {
      ids = [...new Set((ids || []).map(String))];
      const t = Date.now(); S.add = S.add || {}; S.rel = S.rel || [];
      const novos = ids.filter(id => !S.lista.includes(id));
      let jaBipados = 0;
      novos.forEach(id => {
        S.lista.push(id); S.add[id] = t;
        const f = S.fora.find(x => x.id === id); // bipado antes de entrar na lista: já fica conferido, com a hora em que foi bipado
        if (f) { S.conf[id] = { t: f.t, m: f.m ? 1 : 0 }; jaBipados++; }
      });
      S.fora = S.fora.filter(x => !(x.id && S.lista.includes(x.id)));
      const sumiram = S.lista.filter(id => !S.conf[id] && !ids.includes(id));
      S.rel.push({ t, n: novos.length }); gravar(S);
      return { novos, jaBipados, sumiram };
    };
    let lendo = false;
    const lerDeNovo = async () => {
      if (lendo) return;
      if (!D()) { pinta('err', 'A Central não carregou por completo. Recarregue a página (F5): a conferência fica guardada.'); return; }
      lendo = true; pinta('inf', 'Lendo de novo a aba Despacho ("Esperando Expedição")...');
      fundo.style.display = 'none';
      let r = null, erro = null;
      try { r = await D().lerExpedicao(); } catch (x) { erro = x; }
      fundo.style.display = 'flex'; lendo = false;
      if (erro) { bip('err'); pinta('err', 'Não consegui ler de novo: ' + erro.message + ' A conferência continua como estava.'); inp.focus(); return; }
      if (!r.ids || !r.ids.length) { pinta('rep', 'A aba Despacho veio vazia em "Esperando Expedição". Não mudei nada na conferência.'); inp.focus(); return; }
      const j = juntar(r.ids); escreveOrigem(); desenhar();
      const feitos = S.lista.filter(x => S.conf[x]).length;
      let t = j.novos.length ? j.novos.length + ' pedido(s) novo(s) incluído(s) na lista' + (j.jaBipados ? ' (' + j.jaBipados + ' já tinha(m) sido bipado(s) e ficou(aram) como conferido(s))' : '') + '.' : 'Nenhum pedido novo em "Esperando Expedição".';
      t += ' Agora: ' + feitos + ' de ' + S.lista.length + ' conferidos.';
      if (j.sumiram.length) t += ' Atenção: ' + j.sumiram.length + ' que falta(m) não está(ão) mais em "Esperando Expedição": ' + j.sumiram.slice(0, 8).map(x => '#' + x).join(', ') + (j.sumiram.length > 8 ? '...' : '') + '.';
      bip(j.novos.length ? 'ok' : 'rep'); pinta(j.sumiram.length ? 'rep' : j.novos.length ? 'ok' : 'inf', t); inp.focus();
    };
    let tAuto = null;
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); clearTimeout(tAuto); processar(); } });
    // leitor sem Enter no fim: processa sozinho quando chega um código BR completo e a digitação para
    inp.addEventListener('input', () => { clearTimeout(tAuto); if (/^\s*BR\d{9,16}[A-Z]?\s*$/i.test(inp.value)) tAuto = setTimeout(processar, 350); });

    const planilha = () => {
      const P = window.__centralPlan; if (!P || !P.empacotar) { alert('A parte de planilhas não carregou. Recarregue a página (F5).'); return; }
      const est = P.novoEstilo(); const St = o => est.get(o); const m = brs();
      const cab = St({ b: true, color: 'FFFFFFFF', fill: 'FF3A1F6D', borda: true, h: 'center' });
      const ok = St({ color: 'FFFFFFFF', fill: 'FF16856A', borda: true }), falta = St({ color: 'FF7A1D12', fill: 'FFFDE2E0', borda: true });
      const p = P.novaPlanilha('Conferência', 'FF16856A'); const temAdd = S.add && Object.keys(S.add).length; p.larguras = temAdd ? [8, 14, 22, 16, 12, 30] : [8, 14, 22, 16, 12]; p.congelar = [0, 1];
      p.linhas.push(['Ordem', 'Pedido', 'Código BR', 'Situação', 'Hora'].concat(temAdd ? ['Observação'] : []).map(t => P.cel(t, cab)));
      S.lista.forEach((id, i) => { const c = S.conf[id]; const s = c ? ok : falta; p.linhas.push([P.cel(i + 1, s), P.cel(Number(id), s), P.cel(m[id] ? m[id].br : '', s), P.cel(c ? (c.m ? 'Conferido (à mão)' : 'Conferido') : 'FALTOU', s), P.cel(c ? hora(c.t) : '', s)].concat(temAdd ? [P.cel(S.add[id] ? 'Incluído ao ler de novo às ' + hora(S.add[id]).slice(0, 5) : '', s)] : [])); });
      const planilhas = [p];
      if (S.fora.length) { const f = P.novaPlanilha('Fora da lista', 'FFB3261E'); f.larguras = [16, 12]; f.linhas.push(['Pedido bipado', 'Hora'].map(t => P.cel(t, cab))); S.fora.forEach(x => f.linhas.push([P.cel(x.id ? Number(x.id) : x.cod, falta), P.cel(hora(x.t), falta)])); planilhas.push(f); }
      const d = new Date(), z = n => String(n).padStart(2, '0');
      P.baixar('Conferencia-despacho-' + z(d.getDate()) + '-' + z(d.getMonth() + 1) + '-' + z(d.getHours()) + 'h' + z(d.getMinutes()) + '.xlsx', P.empacotar({ planilhas, est }));
      try { if (window.__centralReg) window.__centralReg.add({ k: 'conferencia', t0: S.t0, t: Date.now(), n: S.lista.filter(x => S.conf[x]).length }); } catch (x) {}
    };
    const bLer = btn('Ler de novo (incluir pedidos novos)', lerDeNovo); bLer.title = 'Lê outra vez a aba Despacho ("Esperando Expedição") e inclui os pedidos que entraram depois. O que já foi conferido continua guardado.';
    rod.append(
      bLer,
      btn('Desfazer o último', () => { if (S.ult && S.conf[S.ult]) { const u = S.ult; delete S.conf[u]; S.ult = null; gravar(S); desenhar(); pinta('inf', 'Desfeito: o pedido #' + u + ' voltou para "Faltam".'); } inp.focus(); }),
      btn('Copiar os que faltam', () => { const f = S.lista.filter(id => !S.conf[id]); navigator.clipboard.writeText(f.join('\n')); pinta('inf', f.length + ' pedido(s) que faltam copiados.'); inp.focus(); }),
      btn('Baixar planilha (.xlsx)', planilha, 'pri'),
      btn('Nova conferência', () => { if (confirm('Apagar esta conferência (' + S.lista.filter(x => S.conf[x]).length + ' de ' + S.lista.length + ' conferidos) e começar outra?')) { S = null; gravar(null); telaInicio(); } }, 'per')
    );
    desenhar(); setTimeout(() => inp.focus(), 50);
    const n0 = S.lista.filter(x => S.conf[x]).length; if (n0) pinta('inf', 'Conferência retomada: ' + n0 + ' de ' + S.lista.length + ' já conferidos. Continue bipando.');
  };

  if (S && S.lista && S.lista.length) telaBipar(); else telaInicio();
};
window.__centralConf = { abrir, interpretar };
})();
