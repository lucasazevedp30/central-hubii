// Visual compartilhado da Central Hubii: cores, botões, avisos, menu único e faixa de andamento.
// Todas as telas usam isto, para parecerem do mesmo programa e terem o mesmo significado de cor.
(() => {
if (window.__centralUI) return;
const CSS = `
.cv, .cv * { box-sizing: border-box; font-family: "Segoe UI", system-ui, Arial, sans-serif; }
.cv-btn { height: 44px; padding: 0 20px; border-radius: 9px; border: 0; background: #5B3CC4; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; line-height: 1; }
.cv-btn:hover { background: #4A2FA8; }
.cv-btn:disabled { opacity: .5; cursor: not-allowed; }
.cv-btn.sec { background: #fff; color: #3A1F6D; border: 1px solid #B9B2DC; font-weight: 600; }
.cv-btn.sec:hover { background: #F3F0FB; }
.cv-btn.perigo { background: #fff; color: #A3261B; border: 2px solid #A3261B; }
.cv-btn.perigo:hover { background: #FDF1EF; }
.cv-btn.link { background: transparent; color: #3A1F6D; text-decoration: underline; padding: 0 12px; font-weight: 600; }
.cv-btn.peq { height: 38px; font-size: 14px; padding: 0 16px; }
.cv-chip { display: inline-block; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: #E6E0FA; color: #3A1F6D; white-space: nowrap; }
.cv-chip.verde { background: #E2F3E6; color: #0B6A2A; }
.cv-chip.amarelo { background: #FFF1CC; color: #7E5F00; }
.cv-chip.vermelho { background: #FDE3DF; color: #A3261B; }
.cv-chip.azul { background: #DCE6F8; color: #1F3E79; }
.cv-aviso { display: flex; gap: 10px; align-items: flex-start; border-radius: 10px; padding: 10px 14px; font-size: 14px; line-height: 1.45; background: #ECE9FB; color: #2D254D; }
.cv-aviso.ok { background: #E2F3E6; color: #0B3D1A; }
.cv-aviso.atencao { background: #FFF1CC; color: #5E4700; }
.cv-aviso.erro { background: #FDF1EF; color: #5E140E; }
.cv-faixa { position: fixed; right: 16px; bottom: 16px; width: min(460px, 94vw); z-index: 2147483647; background: #fff; color: #1B1740; border: 1px solid #DDD8F2; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 28px rgba(45,37,77,.35); }
.cv-faixa-topo { height: 6px; background: #5B3CC4; }
.cv-faixa.ok .cv-faixa-topo { background: #0B6A2A; }
.cv-faixa.parou .cv-faixa-topo { background: #A3261B; }
.cv-faixa.atencao .cv-faixa-topo { background: #B98900; }
.cv-faixa-corpo { padding: 14px 18px 16px; display: flex; flex-direction: column; gap: 10px; }
.cv-l1 { display: flex; align-items: center; gap: 10px; }
.cv-titulo { font-size: 16px; font-weight: 700; flex: 1; min-width: 0; }
.cv-cont { font-size: 24px; font-weight: 700; color: #3A1F6D; white-space: nowrap; }
.cv-cont small { font-size: 14px; font-weight: 600; color: #5A5480; }
.cv-trilho { height: 10px; border-radius: 6px; background: #ECE8F8; overflow: hidden; }
.cv-enche { height: 10px; width: 0; background: #5B3CC4; border-radius: 6px; transition: width .4s; }
.cv-faixa.ok .cv-enche { background: #0B6A2A; }
.cv-faixa.parou .cv-enche { background: #A3261B; }
.cv-info { display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; color: #5A5480; }
.cv-info b { color: #1B1740; }
.cv-msg { font-size: 13px; line-height: 1.4; color: #3a3560; word-break: break-word; }
.cv-stats { display: flex; gap: 8px; flex-wrap: wrap; }
.cv-stat { flex: 1 1 110px; background: #F1F9F3; border-radius: 9px; padding: 8px 12px; }
.cv-stat span { display: block; font-size: 12px; color: #5A5480; }
.cv-stat b { font-size: 18px; color: #0B6A2A; }
.cv-acoes { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.cv-lanc { position: fixed; left: 16px; bottom: 16px; z-index: 2147483647; }
.cv-lanc-btn { display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 18px 0 14px; border-radius: 22px; border: 0; background: #3A1F6D; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 6px 18px rgba(45,37,77,.4); }
.cv-lanc-btn:hover { background: #2D1757; }
.cv-menu { display: none; width: 330px; max-width: 92vw; max-height: 78vh; overflow: auto; margin-bottom: 8px; background: #fff; border: 1px solid #DDD8F2; border-radius: 14px; box-shadow: 0 12px 32px rgba(45,37,77,.28); padding: 8px 8px 10px; }
.cv-lanc.aberto .cv-menu { display: block; }
.cv-grupo { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #5A5480; padding: 10px 10px 4px; }
.cv-item { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 8px 10px; border: 0; border-radius: 9px; background: transparent; text-align: left; cursor: pointer; }
.cv-item:hover { background: #F6F5FC; }
.cv-ico { width: 32px; height: 32px; border-radius: 8px; background: #EEE9FB; color: #3A1F6D; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cv-item-t { display: flex; flex-direction: column; min-width: 0; }
.cv-item-n { font-size: 14px; font-weight: 600; color: #1B1740; }
.cv-item-d { font-size: 12px; color: #5A5480; }
.cv-janela { background: #fff; color: #1B1740; border-radius: 14px; box-shadow: 0 14px 40px rgba(45,37,77,.4); display: flex; flex-direction: column; overflow: hidden; }
.cv-topo { background: #3A1F6D; color: #fff; padding: 14px 20px; font-size: 17px; font-weight: 700; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
`;
const ICONES = {
  imprimir: 'M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z',
  etiqueta: 'M3 12V4h8l10 10-8 8L3 12zM7.5 8.5h.01',
  conferir: 'M5 12l5 5L20 7',
  planilha: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  grafico: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  ajuda: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01',
  menu: 'M4 7h16M4 12h16M4 17h16',
  coletar: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  globo: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20'
};
const css = () => {
  if (document.getElementById('central-visual')) return;
  const s = document.createElement('style'); s.id = 'central-visual'; s.textContent = CSS;
  (document.head || document.documentElement).appendChild(s);
};
const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const svg = (nome, tam) => {
  const ns = 'http://www.w3.org/2000/svg'; const s = document.createElementNS(ns, 'svg');
  s.setAttribute('width', tam || 18); s.setAttribute('height', tam || 18); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path'); p.setAttribute('d', ICONES[nome] || ICONES.conferir); s.appendChild(p); return s;
};
const botao = (texto, tipo, f, extra) => { const b = E('button', 'cv-btn' + (tipo ? ' ' + tipo : '') + (extra ? ' ' + extra : ''), texto); b.type = 'button'; if (f) b.onclick = f; return b; };
const dur = ms => { const s = Math.max(0, Math.round(ms / 1000)); if (s < 60) return s + ' s'; const m = Math.floor(s / 60); if (m < 60) return m + ' min ' + String(s % 60).padStart(2, '0') + ' s'; return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min'; };
const relogio = ms => { const s = Math.max(0, Math.round(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

// Menu único: grupos = [{nome, itens:[{nome, dica, icone, f}]}]
const lancador = grupos => {
  css();
  const velho = document.getElementById('central-lanc'); if (velho) velho.remove();
  const l = E('div', 'cv cv-lanc ch-lanc'); l.id = 'central-lanc';
  const m = E('div', 'cv-menu');
  grupos.forEach(g => {
    m.appendChild(E('div', 'cv-grupo', g.nome));
    g.itens.forEach(it => {
      const b = E('button', 'cv-item'); b.type = 'button';
      const ic = E('span', 'cv-ico'); ic.appendChild(svg(it.icone));
      const t = E('span', 'cv-item-t'); t.append(E('span', 'cv-item-n', it.nome), E('span', 'cv-item-d', it.dica || ''));
      b.append(ic, t); b.onclick = () => { l.classList.remove('aberto'); try { it.f(); } catch (e) { alert('Erro: ' + e.message); } };
      m.appendChild(b);
    });
  });
  const bm = E('button', 'cv-lanc-btn'); bm.type = 'button'; bm.append(svg('menu', 20), E('span', null, 'Central Hubii'));
  bm.onclick = () => l.classList.toggle('aberto');
  l.append(m, bm);
  const fora = e => { if (!l.isConnected) { document.removeEventListener('mousedown', fora, true); return; } if (!l.contains(e.target)) l.classList.remove('aberto'); };
  document.addEventListener('mousedown', fora, true);
  return l;
};

// Faixa de andamento: rodando / concluído / parou
const faixa = cfg => {
  css(); cfg = cfg || {};
  const el = E('div', 'cv cv-faixa ch-caixa'); el.setAttribute('role', 'status');
  const topo = E('div', 'cv-faixa-topo'); const corpo = E('div', 'cv-faixa-corpo');
  const chip = E('span', 'cv-chip', 'Rodando'); const tit = E('span', 'cv-titulo', cfg.titulo || 'Central Hubii'); const cont = E('span', 'cv-cont');
  const l1 = E('div', 'cv-l1'); l1.append(chip, tit, cont);
  const trilho = E('div', 'cv-trilho'); const enche = E('div', 'cv-enche'); trilho.appendChild(enche);
  const info = E('div', 'cv-info'); const iTempo = E('span'), iFalta = E('span'), iAtual = E('span'); info.append(iTempo, iFalta, iAtual);
  const msg = E('div', 'cv-msg'); const extra = E('div'); const acoes = E('div', 'cv-acoes');
  const bParar = botao('Parar', 'perigo', cfg.onParar, 'peq'); acoes.appendChild(bParar);
  corpo.append(l1, trilho, info, msg, extra, acoes); el.append(topo, corpo);
  const s = { n: 0, total: 0, atual: '', t0: Date.now(), fim: false, tf: 0 };
  const pinta = () => {
    const dt = (s.fim ? s.tf : Date.now()) - s.t0;
    cont.textContent = ''; if (s.total) { cont.append(String(s.n) + ' ', Object.assign(E('small'), { textContent: 'de ' + s.total })); }
    enche.style.width = (s.total ? Math.min(100, Math.round(100 * s.n / s.total)) : 0) + '%';
    iTempo.textContent = ''; iTempo.append('Tempo: ', Object.assign(E('b'), { textContent: relogio(dt) }));
    iFalta.textContent = '';
    if (!s.fim && s.n >= 2 && s.total > s.n) { const r = dt / s.n * (s.total - s.n); iFalta.append('Faltam cerca de ', Object.assign(E('b'), { textContent: r < 90000 ? Math.round(r / 1000) + ' s' : Math.round(r / 60000) + ' min' })); }
    iAtual.textContent = ''; if (s.atual && !s.fim) iAtual.append('Atual: ', Object.assign(E('b'), { textContent: s.atual }));
  };
  const timer = setInterval(() => { if (!el.isConnected) { clearInterval(timer); return; } pinta(); }, 1000);
  pinta();
  return {
    el,
    set(o) {
      if (o.titulo != null) tit.textContent = o.titulo;
      if (o.msg != null) msg.textContent = o.msg;
      ['n', 'total', 'atual'].forEach(k => { if (o[k] !== undefined) s[k] = o[k]; });
      pinta();
    },
    fim(estado, texto, o) {
      o = o || {}; s.fim = true; s.tf = Date.now(); clearInterval(timer);
      el.classList.remove('ok', 'parou', 'atencao'); el.classList.add(estado);
      chip.className = 'cv-chip ' + ({ ok: 'verde', parou: 'vermelho', atencao: 'amarelo' }[estado] || '');
      chip.textContent = { ok: 'Concluído', parou: 'Parou', atencao: 'Atenção' }[estado] || 'Fim';
      if (estado === 'ok' && s.total) s.n = s.total;
      msg.textContent = ''; const av = E('div', 'cv-aviso ' + ({ ok: 'ok', parou: 'erro', atencao: 'atencao' }[estado] || ''), texto); msg.appendChild(av);
      extra.textContent = '';
      if (o.stats && o.stats.length) { const st = E('div', 'cv-stats'); o.stats.forEach(x => { const c = E('div', 'cv-stat'); c.append(E('span', null, x[0]), E('b', null, x[1])); st.appendChild(c); }); extra.appendChild(st); }
      acoes.textContent = '';
      (o.acoes || []).forEach(a => acoes.appendChild(botao(a.t, a.tipo || 'sec', a.f, 'peq')));
      if (estado === 'parou' && window.__centralSup) acoes.appendChild(botao('Copiar relatório de suporte', 'link', () => window.__centralSup.abrir(), 'peq'));
      acoes.appendChild(botao('Fechar', 'sec', () => { el.remove(); if (o.aoFechar) o.aoFechar(); }, 'peq'));
      pinta();
    },
    remover() { clearInterval(timer); el.remove(); }
  };
};

window.__centralUI = { css, E, svg, botao, lancador, faixa, dur, ICONES };
})();
