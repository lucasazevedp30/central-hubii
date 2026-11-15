(() => {
if (window.top !== window || window.__centralOneHub) return;
window.__centralOneHub = true;
const usa = (g, nome) => () => { if (window[g]) window[g][nome](); else alert('Esta função não carregou. Recarregue a página (F5).'); };
const mk = () => {
  if (document.getElementById('central-lanc') || !window.__centralUI) return;
  const l = window.__centralUI.lancador([
    { nome: 'Pendências', itens: [
      { nome: 'Consultar OneHub', dica: 'Só leitura, não altera nada', icone: 'globo', f: () => { const f = window.__centralBM && window.__centralBM.onehub; if (!f) { alert('Esta rotina não carregou. Recarregue a página (F5).'); return; } f().catch(e => alert('Erro: ' + e.message)); } },
      { nome: 'Planilha de pendências', dica: 'Gera o .xlsx com a confiabilidade', icone: 'planilha', f: usa('__centralPlan', 'abrir') } ] },
    { nome: 'Acompanhamento', itens: [
      { nome: 'Relatório de desempenho', dica: 'Tempo poupado, fechamento do mês', icone: 'grafico', f: usa('__centralReg', 'abrirRelatorio') },
      { nome: 'Suporte', dica: 'Copia um relatório sem dados de clientes', icone: 'ajuda', f: usa('__centralSup', 'abrir') } ] }
  ]);
  document.body.appendChild(l);
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mk); else mk();
})();
