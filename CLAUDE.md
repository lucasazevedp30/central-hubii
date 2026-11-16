# Central Hubii — instruções para o Claude

Automação de impressão e pendências da Pet Fun (unidade PF19 Américas) para pedidos da Shopee
vendidos pelo Hubii. O código fica em `hubii-pacote/` (é exatamente o que vai dentro do zip).

## Como falar com o usuário
- Responder sempre em **português**, com passos curtos. O usuário **não programa**: prefere botões e
  passo a passo simples.
- **Perguntar antes** quando houver dúvida; não executar no escuro.
- Dizer sempre **o que foi testado só em simulação** (aqui não há Windows, Hubii, OnePet nem impressoras).
- Ações que não se desfazem (Faturar, Finalizar venda, cancelar) começam por teste pequeno e
  sempre mostram a lista para conferir antes de confirmar.
- Toda rotina deve poder parar e retomar sem repetir o que já foi feito.
- Relatórios de suporte sem dados pessoais. **Este repositório é público**: nunca colocar nomes de
  clientes, CPF, endereços, valores de pedidos, e-mails ou tokens em arquivos ou commits.

## Peças (ler antes de mexer)
| Peça | Arquivos |
|---|---|
| Painel local (http://localhost:8765, PowerShell HttpListener, abre no Edge `--app`) | `painel-servidor.ps1`, `painel.html`, `Painel.bat`, `Central-Hubii.bat` |
| Extensão do Chrome (Manifest V3, menu roxo no Hubii/OneHub/OnePet) | `extensao-central-hubii/` — `background.js` (conversa com o painel), `content.js`, `registro.js` (histórico por pedido), `planilha.js` (gera .xlsx; o painel reutiliza), `conferir.js` (bipe), `pend.js`/`coletar.js`/`onehub.js` (pendências), `baixa.js` |
| .bat | trocam a impressora padrão e abrem o navegador certo |
| Ajudantes .ps1 | `ajudante-etiquetas.ps1` (Ctrl+P/Ctrl+W, cada etiqueta só uma vez), `chrome-central.ps1`, `navegador-normal.ps1`, `limpar-impressora-chrome.ps1`, `liberar-popups-central.ps1` |
| Janela antiga (reserva) | `central-hubii.ps1` |

Dados ficam fora da pasta: `%LOCALAPPDATA%\CentralHubii` (historico.ndjson, pendencias, backups,
versoes, atualizacao) e no `chrome.storage.local` da extensão. Nunca mandar o usuário "Remover" a
extensão (apaga os dados); recarregar sempre da mesma pasta.

## Regras de negócio que não podem quebrar
- Nunca imprimir descritivo nem etiqueta repetidos; botão Faturar desativado = já faturado, pular.
- Etiquetas saem na mesma ordem dos descritivos.
- "Esperando NFe do Hub" nunca é autorizado para baixa. Em trânsito/entregue/extraviado = dar baixa.
  Pedido invisível (no OneHub, não no Hubii) e cancelado, ou cancelado no Hubii = cancelar.
- Códigos BR podem terminar com letra.
- A decisão de cancelar ou dar baixa é sempre do usuário.

## Detalhes técnicos
- PowerShell **5.1** no Windows: arquivos `.ps1` salvos em **UTF-8 com BOM** (acentos). `painel.html`,
  `.js` e `manifest.json` **sem BOM**. Perfil "Profile 3" tem espaço: vai entre aspas nos argumentos.
- Chrome no lugar padrão, senão Program Files (x86), `%LOCALAPPDATA%`, e por último o Brave.
- Todo POST do painel exige o cabeçalho `X-Central: 1`.

## Como entregar uma versão nova
1. Aumentar a versão em `hubii-pacote/extensao-central-hubii/manifest.json` e no rótulo
   `'versão x.y.z'` de `hubii-pacote/central-hubii.ps1`.
2. Testar o que der: `pwsh` para conferir sintaxe dos `.ps1` e rodar o servidor; Playwright para o
   `painel.html`. (No Linux o servidor procura `extensao-central-hubii\manifest.json` com barra
   invertida no nome: criar uma cópia com esse nome numa pasta de teste.)
3. Commit e `./publicar.sh notas.md` (notas = "O que mudou", em português, curto). Ele cria
   `versoes/hubii-central-x.y.z.zip` (com `hubii-pacote/` no topo), atualiza `versao.json` (versão,
   arquivo, SHA-256, novidades), faz commit e envia. A Central na loja lê
   `raw.githubusercontent.com/<repo>/main/versao.json`, avisa na aba Hoje e o usuário clica em
   "Instalar a versão nova". (Releases do GitHub não podem ser criadas por estas sessões; por isso a pasta
   `versoes/`. Não apagar `versao.json` nem o zip da última versão.)
4. `hubii-pacote/atualizacao-online.txt` precisa continuar com `lucasazevedp30/central-hubii`, senão a
   atualização pela internet se desliga nas lojas.
5. Também dá para mandar o zip para o usuário instalar por "Instalar de um arquivo .zip".

## Em aberto
- Alertas de compra (limite escolhido pelo usuário) depois de uma semana de dados.
- Configuração por loja + instalador, se a ideia de levar a outras lojas avançar
  (hoje perfil do Chrome, impressoras e endereços estão fixos no código).
- "Retomar de onde parou" em todas as rotinas.
