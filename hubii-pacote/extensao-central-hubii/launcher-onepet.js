(() => {
if (window.top !== window || window.__centralOnePet) return;
window.__centralOnePet = true;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rodar = () => { const f = window.__centralBM && window.__centralBM.coletar; if (!f) { alert('A coleta não carregou. Recarregue a página (F5).'); return; } f().catch(e => alert('Erro: ' + e.message)); };
const usa = (g, nome) => () => { if (window[g]) window[g][nome](); else alert('Esta função não carregou. Recarregue a página (F5).'); };
const mk = () => {
  if (document.getElementById('central-lanc') || !window.__centralUI) return;
  const l = window.__centralUI.lancador([
    { nome: 'Pendências', itens: [
      { nome: 'Coletar pendências', dica: 'Lê nomes, valores, datas e códigos', icone: 'coletar', f: rodar },
      { nome: 'Planilha de pendências', dica: 'Gera o .xlsx com a confiabilidade', icone: 'planilha', f: usa('__centralPlan', 'abrir') } ] },
    { nome: 'Acompanhamento', itens: [
      { nome: 'Relatório de desempenho', dica: 'Tempo poupado, fechamento do mês', icone: 'grafico', f: usa('__centralReg', 'abrirRelatorio') },
      { nome: 'Suporte', dica: 'Copia um relatório sem dados de clientes', icone: 'ajuda', f: usa('__centralSup', 'abrir') } ] }
  ]);
  document.body.appendChild(l);
};
const iniciar = async () => {
  mk();
  let auto = false;
  try { const u = new URL(location.href); if (u.searchParams.get('central') === 'coletar') { auto = true; u.searchParams.delete('central'); history.replaceState(null, '', u.pathname + u.search + u.hash); } } catch (e) {}
  if (auto) { await sleep(2500); rodar(); }
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
