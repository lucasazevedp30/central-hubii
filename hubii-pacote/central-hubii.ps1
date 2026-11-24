# Central Hubii - janela unica com os atalhos (Descritivos, Etiquetas, Pendencias, Baixa)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

try {
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
# Se o Chrome nao estiver no lugar padrao, procura em outros lugares e, por ultimo, usa o Brave (para testes em casa).
if (-not (Test-Path $chrome)) {
    $outro = @("${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe", "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe", "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe", "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if ($outro) { $chrome = $outro }
}
$perfil = 'Profile 3'
$urlPendencias = 'https://prod.onepet.com.br/home.php?p=caixa&s=pendencias'


function Cor($hex) { return [System.Drawing.ColorTranslator]::FromHtml($hex) }
$navy = Cor '#1B1F48'
$fundo = Cor '#F3F1FA'
$branco = Cor '#FFFFFF'
$acento = Cor '#5B3CC4'
$acentoClaro = Cor '#7258DB'
$roxoEscuro = Cor '#3A1F6D'
$texto = Cor '#1B1740'
$suave = Cor '#4A4570'
$muted = Cor '#5A5480'
$borda = Cor '#DDD8F2'
$chip = Cor '#EEE9FB'
$laranja = Cor '#FF6A2B'

function Rodar($arquivo) {
    $p = Join-Path $dir $arquivo
    if (-not (Test-Path $p)) {
        [System.Windows.Forms.MessageBox]::Show("Não encontrei $arquivo na pasta:`n$dir", 'Central Hubii') | Out-Null
        return
    }
    Start-Process -FilePath $p -WorkingDirectory $dir
}

function AbrirChrome($url) {
    if (-not (Test-Path $chrome)) {
        [System.Windows.Forms.MessageBox]::Show("Chrome não encontrado em:`n$chrome`nAjuste a linha `$chrome no inicio de central-hubii.ps1.", 'Central Hubii') | Out-Null
        return
    }
    Start-Process -FilePath $chrome -ArgumentList @("--profile-directory=`"$perfil`"", '--new-window', $url)
}

function AbrirChromeSegundoPlano($url) {
    if (-not (Test-Path $chrome)) { AbrirChrome $url; return }
    $flags = @("--profile-directory=`"$perfil`"", '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion', '--new-window', $url)
    if (Get-Process -Name chrome, brave -ErrorAction SilentlyContinue) {
        $r = [System.Windows.Forms.MessageBox]::Show("Para o Baixa/Coleta continuar rodando mesmo com a janela coberta por outras ou em segundo plano, o Chrome precisa ser fechado e reaberto neste modo.`n`nFechar o Chrome agora? (salve o que estiver fazendo)`n`nSim = fecha e reabre no modo segundo plano`nNão = abre normal (pode travar se a janela ficar escondida)", 'Central Hubii', 'YesNo')
        if ($r -ne 'Yes') { AbrirChrome $url; return }
        Get-Process -Name chrome, brave -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-Sleep -Seconds 3
    }
    Start-Process -FilePath $chrome -ArgumentList $flags
}


function Arredondar($ctl, $r) {
    try {
        $w = $ctl.Width; $h = $ctl.Height; $d = $r * 2
        $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
        $gp.AddArc(0, 0, $d, $d, 180, 90)
        $gp.AddArc($w - $d, 0, $d, $d, 270, 90)
        $gp.AddArc($w - $d, $h - $d, $d, $d, 0, 90)
        $gp.AddArc(0, $h - $d, $d, $d, 90, 90)
        $gp.CloseAllFigures()
        $ctl.Region = New-Object System.Drawing.Region($gp)
    } catch { }
}

function Rotulo($texto, $x, $y, $w, $h, $tam, $negrito, $cor) {
    $l = New-Object System.Windows.Forms.Label
    $l.Text = $texto
    $l.Location = New-Object System.Drawing.Point($x, $y)
    $l.Size = New-Object System.Drawing.Size($w, $h)
    $estilo = [System.Drawing.FontStyle]::Regular
    if ($negrito) { $estilo = [System.Drawing.FontStyle]::Bold }
    $l.Font = New-Object System.Drawing.Font('Segoe UI', $tam, $estilo)
    $l.ForeColor = $cor
    $l.BackColor = [System.Drawing.Color]::Transparent
    return $l
}

function Botao($texto, $x, $y, $w, $h, $corFundo, $corHover) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $texto
    $b.Location = New-Object System.Drawing.Point($x, $y)
    $b.Size = New-Object System.Drawing.Size($w, $h)
    $b.FlatStyle = 'Flat'
    $b.FlatAppearance.BorderSize = 0
    $b.BackColor = $corFundo
    $b.ForeColor = $branco
    $b.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
    $b.Cursor = [System.Windows.Forms.Cursors]::Hand
    $b.FlatAppearance.MouseOverBackColor = $corHover
    $b.FlatAppearance.MouseDownBackColor = $corHover
    return $b
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Central Hubii - Pet Fun'
try { $form.Icon = New-Object System.Drawing.Icon (Join-Path $dir 'logos\central.ico') } catch { }
$form.ClientSize = New-Object System.Drawing.Size(760, 560)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedSingle'
$form.MaximizeBox = $false
$form.BackColor = $fundo

# ---- cabecalho: faixa unica em degrade com Hubii (logo oficial), Shopee (texto) e Pet Fun (logo oficial)
$topo = New-Object System.Windows.Forms.Panel
$topo.Location = New-Object System.Drawing.Point(0, 0)
$topo.Size = New-Object System.Drawing.Size(760, 112)
$topo.BackColor = $navy
try {
    $topo.Add_Paint({
        param($quem, $ev)
        try {
            $c1 = [System.Drawing.ColorTranslator]::FromHtml('#2D1B5E')
            $c2 = [System.Drawing.ColorTranslator]::FromHtml('#121E38')
            $br = New-Object System.Drawing.Drawing2D.LinearGradientBrush($quem.ClientRectangle, $c1, $c2, 0.0)
            $ev.Graphics.FillRectangle($br, $quem.ClientRectangle)
            $br.Dispose()
        } catch { }
    })
} catch { }

function LogoNoTopo($arquivo, $nome, $x, $y, $w, $h) {
    try {
        $img = [System.Drawing.Image]::FromFile((Join-Path (Join-Path $dir 'logos') $arquivo))
        $pic = New-Object System.Windows.Forms.PictureBox
        $pic.Image = $img
        $pic.SizeMode = 'Zoom'
        $pic.Location = New-Object System.Drawing.Point($x, $y)
        $pic.Size = New-Object System.Drawing.Size($w, $h)
        $pic.BackColor = [System.Drawing.Color]::Transparent
        $topo.Controls.Add($pic)
    } catch {
        $topo.Controls.Add((Rotulo $nome $x 36 $w 40 18 $true $branco))
    }
}
LogoNoTopo 'hubii.png' 'Hubii' 26 8 200 96
$shopee = Rotulo 'Shopee' 270 28 220 56 28 $true $laranja
$shopee.TextAlign = 'MiddleCenter'
$topo.Controls.Add($shopee)
$sep1 = New-Object System.Windows.Forms.Panel
$sep1.Location = New-Object System.Drawing.Point(252, 34); $sep1.Size = New-Object System.Drawing.Size(1, 44); $sep1.BackColor = (Cor '#4A4F7C')
$sep2 = New-Object System.Windows.Forms.Panel
$sep2.Location = New-Object System.Drawing.Point(508, 34); $sep2.Size = New-Object System.Drawing.Size(1, 44); $sep2.BackColor = (Cor '#4A4F7C')
$topo.Controls.Add($sep1)
$topo.Controls.Add($sep2)
LogoNoTopo 'petfun.png' 'Pet Fun' 540 4 190 104
$form.Controls.Add($topo)

# ---- barra de abas (sublinhado na aba ativa)
$barra = New-Object System.Windows.Forms.Panel
$barra.Location = New-Object System.Drawing.Point(0, 112)
$barra.Size = New-Object System.Drawing.Size(760, 54)
$barra.BackColor = $branco
$form.Controls.Add($barra)
$filete = New-Object System.Windows.Forms.Panel
$filete.Location = New-Object System.Drawing.Point(0, 53)
$filete.Size = New-Object System.Drawing.Size(760, 1)
$filete.BackColor = $borda
$barra.Controls.Add($filete)
$sublinha = New-Object System.Windows.Forms.Panel
$sublinha.Size = New-Object System.Drawing.Size(120, 3)
$sublinha.Location = New-Object System.Drawing.Point(20, 50)
$sublinha.BackColor = $acento
$barra.Controls.Add($sublinha)
$bPainel = Botao 'Abrir painel' 526 9 118 36 $acento $acentoClaro
$bPainel.Font = New-Object System.Drawing.Font('Segoe UI', 9.5, [System.Drawing.FontStyle]::Bold)
$bPainel.Add_Click({ Rodar 'Painel.bat' })
$barra.Controls.Add($bPainel)
Arredondar $bPainel 10
$versao = Rotulo 'versão 2.25.0' 650 18 92 20 9 $false $muted
$versao.TextAlign = 'MiddleRight'
$barra.Controls.Add($versao)

$nomes = @('Impressão', 'Pendências', 'Baixa', 'Ajuda')
$abas = @()
$paineis = @()
for ($i = 0; $i -lt $nomes.Count; $i++) {
    $a = Botao $nomes[$i] (20 + $i * 124) 4 120 46 $branco $fundo
    $a.Font = New-Object System.Drawing.Font('Segoe UI', 10.5, [System.Drawing.FontStyle]::Bold)
    $a.ForeColor = $muted
    $barra.Controls.Add($a)
    $a.BringToFront()
    $abas += $a
    $p = New-Object System.Windows.Forms.Panel
    $p.Location = New-Object System.Drawing.Point(0, 166)
    $p.Size = New-Object System.Drawing.Size(760, 394)
    $p.BackColor = $fundo
    $p.Visible = $false
    $form.Controls.Add($p)
    $paineis += $p
}
$sublinha.BringToFront()

function Mostrar($n) {
    for ($j = 0; $j -lt $paineis.Count; $j++) {
        $paineis[$j].Visible = ($j -eq $n)
        if ($j -eq $n) { $abas[$j].ForeColor = $roxoEscuro } else { $abas[$j].ForeColor = $muted }
    }
    $sublinha.Location = New-Object System.Drawing.Point($abas[$n].Left, 50)
    $sublinha.BringToFront()
}
for ($i = 0; $i -lt $abas.Count; $i++) {
    $abas[$i].Tag = $i
    $abas[$i].Add_Click({ param($quem, $ev) Mostrar ([int]$quem.Tag) })
}

# texto com barra de rolagem: a barra aparece sozinha quando o texto nao cabe (roda do mouse tambem funciona)
function TextoRolavel($texto, $x, $y, $w, $h, $tam, $cor) {
    $cx = New-Object System.Windows.Forms.Panel
    $cx.Location = New-Object System.Drawing.Point($x, $y)
    $cx.Size = New-Object System.Drawing.Size($w, $h)
    $cx.BackColor = $branco
    $cx.AutoScroll = $true
    $lt = Rotulo $texto 0 0 ($w - 22) 10 $tam $false $cor
    $lt.AutoSize = $true
    $lt.MaximumSize = New-Object System.Drawing.Size(($w - 22), 0)
    $cx.Controls.Add($lt)
    try {
        $cx.Add_MouseEnter({ param($quem, $ev) try { [void]$quem.Focus() } catch { } })
        $lt.Add_MouseEnter({ param($quem, $ev) try { [void]$quem.Parent.Focus() } catch { } })
    } catch { }
    return $cx
}

function Cartao($painel, $x, $icone, $titulo, $texto, $botaoTexto, $acao) {
    $c = New-Object System.Windows.Forms.Panel
    $c.Location = New-Object System.Drawing.Point($x, 16)
    $c.Size = New-Object System.Drawing.Size(346, 322)
    $c.BackColor = $branco
    $bolha = New-Object System.Windows.Forms.Panel
    $bolha.Location = New-Object System.Drawing.Point(20, 18)
    $bolha.Size = New-Object System.Drawing.Size(48, 48)
    $bolha.BackColor = $chip
    $g = New-Object System.Windows.Forms.Label
    $g.Text = $icone
    $g.Font = New-Object System.Drawing.Font('Segoe MDL2 Assets', 18)
    $g.ForeColor = $acento
    $g.BackColor = [System.Drawing.Color]::Transparent
    $g.TextAlign = 'MiddleCenter'
    $g.Dock = 'Fill'
    $bolha.Controls.Add($g)
    $c.Controls.Add($bolha)
    Arredondar $bolha 14
    $c.Controls.Add((Rotulo $titulo 18 76 310 30 14.5 $true $texto_cor))
    $c.Controls.Add((TextoRolavel $texto 18 112 322 134 9.5 $suave))
    $b = Botao $botaoTexto 18 254 310 52 $acento $acentoClaro
    $b.Font = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
    $b.Add_Click($acao)
    $c.Controls.Add($b)
    Arredondar $b 12
    $painel.Controls.Add($c)
    Arredondar $c 16
}
$texto_cor = $texto
$icPrint = [string][char]0xE749
$icTag = [string][char]0xE1CB
$icBusca = [string][char]0xE721
$icOk = [string][char]0xE73E
$icBaixa = [string][char]0xE896
$icLista = [string][char]0xE8FD

# ---- aba Impressao
Cartao $paineis[0] 24 $icPrint 'Imprimir Descritivos' ("Fatura cada pedido e imprime o descritivo, um por um, sem você precisar clicar.`r`n`r`n1  Troca a impressora para a MP-4200 TH e abre o Chrome da Central (só o dele; o Chrome normal não é mexido)`r`n2  Abre o Hubii em Despacho (Esperando NFe do Hub) e mostra a lista`r`n3  Só fatura depois do seu Confirmar") 'Imprimir Descritivos' { Rodar 'Descritivos.bat' }
Cartao $paineis[0] 390 $icTag 'Imprimir Etiquetas' ("Imprime as etiquetas na mesma ordem dos descritivos, para não misturar pedidos.`r`n`r`n1  Troca a impressora para a Argox OS-214, liga o ajudante do Ctrl+P e abre o Chrome da Central`r`n2  Abre o Hubii em Despacho (Esperando Expedição) com a memória dos descritivos`r`n3  Só imprime depois do seu Confirmar. Ao terminar, feche a janela do ajudante: a MP volta a ser a padrão.") 'Imprimir Etiquetas' { Rodar 'Etiquetas.bat' }

$bRe = Botao 'Reimprimir descritivos (sem faturar)' 24 346 352 42 $branco $chip
$bRe.ForeColor = $roxoEscuro
$bRe.FlatAppearance.BorderSize = 1
$bRe.FlatAppearance.BorderColor = $borda
$bRe.Font = New-Object System.Drawing.Font('Segoe UI', 10.5, [System.Drawing.FontStyle]::Bold)
$bRe.Add_Click({ Rodar 'Reimprimir-Descritivos.bat' })
$paineis[0].Controls.Add($bRe)
Arredondar $bRe 12
$bMP = Botao 'Voltar a MP-4200 como padrão' 384 346 352 42 $branco $chip
$bMP.ForeColor = $roxoEscuro
$bMP.FlatAppearance.BorderSize = 1
$bMP.FlatAppearance.BorderColor = $borda
$bMP.Font = New-Object System.Drawing.Font('Segoe UI', 10.5, [System.Drawing.FontStyle]::Bold)
$bMP.Add_Click({ Rodar 'Voltar-MP.bat' })
$paineis[0].Controls.Add($bMP)
Arredondar $bMP 12

# ---- aba Pendencias
Cartao $paineis[1] 24 $icBusca 'Coletar pendências' ("Abre a tela de Pendências do OnePet e já inicia a coleta (nomes, valores, datas e links).`r`n`r`nDepois, para checar no Hubii e no OneHub, use o outro cartão.") 'Coletar pendências' { AbrirChromeSegundoPlano ($urlPendencias + '&central=coletar') }
Cartao $paineis[1] 390 $icOk 'Verificar no Hubii e OneHub' ("Abre o Painel Hubii e o OneHub, cada um na sua janela.`r`n`r`nUse o botão roxo 'Central Hubii' de cada página: Verificar pendências (Painel) e, no OneHub, Consultar OneHub.") 'Abrir Painel e OneHub' { Rodar 'Pendencias.bat' }
# ---- aba Baixa
Cartao $paineis[2] 24 $icBaixa 'Dar baixa nas pendências' ("Abre a tela de Pendências do OnePet no seu Chrome.`r`n`r`nO painel roxo 'Baixa Hubii' aparece nessa tela: clique em 'Carregar planilha' (confiabilidade mínima 9), escolha o modo (Teste 1, Teste 2 ou Completo) e clique em Iniciar.") 'Abrir Pendências do OnePet' { AbrirChromeSegundoPlano $urlPendencias }
Cartao $paineis[2] 390 $icLista 'Antes de começar' ("1. Extensão da Central instalada em chrome://extensions (só uma).`r`n2. Rode 'Coletar pendências' antes.`r`n3. Comece pelo Teste 1 com 2 ou 3 clientes.`r`n4. Depois o Teste 2 com 1 cliente.`r`n5. Só então o modo Completo.`r`n`r`nFinalizar venda não tem como desfazer.") 'Abrir extensoes do Chrome' { AbrirChrome 'chrome://extensions' }

# ---- aba Ajuda
$ajuda = "Como usar a Central`r`n`r`n- Impressão: Descritivos e Etiquetas fazem o que os .bat faziam e depois o Hubii lista os pedidos para você conferir e confirmar (precisa da extensão 'extensao-central-hubii' instalada no Chrome, uma vez só).`r`n- Reimprimir descritivos: se a impressora falhar no meio (sem papel, por exemplo), use o botão 'Reimprimir descritivos' na aba Impressão: o Hubii mostra a lista dos últimos descritivos, você marca só os que não saíram e eles são impressos de novo, sem faturar.`r`n- Pendências: 'Coletar' abre o OnePet e já coleta; 'Verificar' abre o Painel Hubii e o OneHub (botão roxo em cada página; substitui os favoritos).`r`n- Baixa: abre o OnePet, onde aparece o painel Baixa Hubii.`r`n`r`nDescritivos, Etiquetas e Reimprimir abrem um Chrome separado, só da Central (a impressão direta vale só nele). Se ele já estiver aberto, a Central pergunta antes de fechá-lo; o Chrome normal da loja nunca é fechado nem mexido, e nele a impressão continua normal, com escolha da impressora. Na primeira vez, o Chrome da Central pede para entrar no Hubii e carregar a extensão (uma vez só). Terminou as etiquetas? Feche a janela do ajudante, ou use 'Voltar a MP-4200 como padrão'.`r`n`r`nOs arquivos Descritivos.bat, Etiquetas.bat e Pendencias.bat continuam na pasta e funcionam sozinhos, se precisar.`r`n`r`nPara mudar o perfil do Chrome ou o caminho, edite o inicio de central-hubii.ps1."
$cAjuda = New-Object System.Windows.Forms.Panel
$cAjuda.Location = New-Object System.Drawing.Point(24, 16)
$cAjuda.Size = New-Object System.Drawing.Size(712, 346)
$cAjuda.BackColor = $branco
$cAjuda.Controls.Add((TextoRolavel $ajuda 22 18 680 312 10.5 $suave))
$paineis[3].Controls.Add($cAjuda)
Arredondar $cAjuda 16

Mostrar 0
# identidade propria na barra de tarefas (nao agrupa com o PowerShell e mostra o icone da Central)
try {
    Add-Type -Namespace Native -Name Id -MemberDefinition '[DllImport("shell32.dll")] public static extern void SetCurrentProcessExplicitAppUserModelID([System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.LPWStr)] string id);'
    [Native.Id]::SetCurrentProcessExplicitAppUserModelID('PetFun.CentralHubii')
} catch { }
$form.ShowIcon = $true
$form.ShowInTaskbar = $true
try {
    Add-Type -Namespace Native -Name Janela -MemberDefinition '[DllImport("kernel32.dll")] public static extern System.IntPtr GetConsoleWindow(); [DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr h, int c);'
    [void][Native.Janela]::ShowWindow([Native.Janela]::GetConsoleWindow(), 0)
} catch { }
[void]$form.ShowDialog()

} catch {
    $msg = ($_ | Out-String)
    try { Set-Content -Path (Join-Path $PSScriptRoot 'central-erro.txt') -Value $msg -Encoding UTF8 } catch { }
    Write-Host ''
    Write-Host 'A Central Hubii deu erro:' -ForegroundColor Red
    Write-Host $msg
    Write-Host 'O erro tambem foi salvo em central-erro.txt'
    exit 1
}
