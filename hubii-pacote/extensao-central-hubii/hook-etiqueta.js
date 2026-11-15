// Roda no mundo da página (MAIN) do Hubii: quando a página monta o PDF da etiqueta (blob),
// lê dele o número do pedido e o código de rastreio "BR..." (o mesmo do código de barras e dos QR codes)
// e avisa a Central, que guarda o par pedido + BR para a conferência por bipe. Nada sai do computador.
(() => {
  if (window.__centralHookEtq) return; window.__centralHookEtq = true;
  const latin1 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return s; };
  const inflar = async u8 => {
    const ds = new DecompressionStream('deflate');
    const w = ds.writable.getWriter(); w.write(u8).catch(() => {}); w.close().catch(() => {});
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  };
  const lerCmap = t => {
    const m = new Map(); const h = x => parseInt(x, 16);
    const uni = x => { let s = ''; for (let i = 0; i + 4 <= x.length; i += 4) s += String.fromCharCode(h(x.substr(i, 4))); return s; };
    (t.match(/beginbfchar[\s\S]*?endbfchar/g) || []).forEach(b => { for (const x of b.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) m.set(h(x[1]), uni(x[2])); });
    (t.match(/beginbfrange[\s\S]*?endbfrange/g) || []).forEach(b => {
      for (const x of b.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) { const a = h(x[1]), z = h(x[2]), d = h(x[3]); for (let c = a; c <= z && c - a < 512; c++) m.set(c, String.fromCharCode(d + c - a)); }
    });
    return m;
  };
  const decodificar = (conteudo, cmap) => conteudo.replace(/<([0-9A-Fa-f\s]{4,})>/g, (tudo, hx) => {
    hx = hx.replace(/\s+/g, ''); if (hx.length % 4) return tudo;
    let s = ''; for (let i = 0; i < hx.length; i += 4) s += cmap.get(parseInt(hx.substr(i, 4), 16)) || '\u0001'; // caractere sem mapa: marca para não juntar pedaços e inventar um código
    return '(' + s + ')';
  });
  const extrair = async buf => {
    const u8 = new Uint8Array(buf); const bruto = latin1(u8);
    if (bruto.slice(0, 5) !== '%PDF-') return null;
    const partes = []; const re = /stream\r?\n/g; let m;
    while ((m = re.exec(bruto))) {
      const ini = m.index + m[0].length; const fim = bruto.indexOf('endstream', ini); if (fim < 0) break;
      // o fim do stream pode ter uma quebra de linha sobrando; tenta com 0, 1 e 2 bytes a menos
      let ok = false;
      for (let corte = 0; corte <= 2 && !ok; corte++) { try { partes.push(latin1(await inflar(u8.subarray(ini, fim - corte)))); ok = true; } catch (e) {} }
      if (!ok) partes.push(bruto.slice(ini, fim));
      re.lastIndex = fim + 9;
    }
    const cmaps = partes.filter(p => /beginbf(char|range)/.test(p)).map(lerCmap);
    const textos = [];
    partes.filter(p => /\bT[jJ]\b/.test(p)).forEach(p => { textos.push(p); cmaps.forEach(c => textos.push(decodificar(p, c))); });
    const junto = textos.join('\n');
    const brs = [...new Set((junto.match(/(?<![A-Z0-9])BR\d{8,16}[A-Z]?(?![A-Za-z0-9])/g) || []))];
    const peds = [...new Set([...junto.matchAll(/PEDIDO\s*#\s*(\d{5,9})/gi)].map(x => x[1]))];
    return { brs, peds };
  };
  const orig = URL.createObjectURL;
  URL.createObjectURL = function (obj) {
    const url = orig.apply(this, arguments);
    try {
      if (obj instanceof Blob && obj.size > 500 && obj.size < 8e6 && (!obj.type || /pdf|octet/i.test(obj.type))) {
        obj.arrayBuffer().then(extrair).then(r => { if (r && r.brs.length) window.postMessage({ central: 'etiqueta', brs: r.brs, peds: r.peds }, location.origin); }).catch(() => {});
      }
    } catch (e) {}
    return url;
  };
  window.__centralEtqExtrair = extrair; // usado nos testes
})();
