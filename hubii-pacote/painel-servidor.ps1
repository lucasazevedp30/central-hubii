# Central Hubii - painel local (versao 1)
# Liga uma pagina que so abre NESTE computador (http://localhost:8765) e abre a janela do painel.
# Os botoes do painel rodam os mesmos .bat da Central; a extensao do Chrome manda os numeros do dia.
# So usa a internet para buscar atualizacao (GitHub), e so quando o painel pede. Para desligar: botao "Desligar painel" ou feche esta janela.
param([int]$Porta = 8765, [switch]$SemJanela, [switch]$Reinicio)

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
# Se o Chrome nao estiver no lugar padrao, procura em outros lugares e, por ultimo, usa o Brave (para testes em casa).
if (-not (Test-Path $chrome)) {
    $outro = @("${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe", "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe", "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe", "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if ($outro) { $chrome = $outro }
}
$perfil = 'Profile 3'
$urlPendencias = 'https://prod.onepet.com.br/home.php?p=caixa&s=pendencias'
$base = "http://localhost:$Porta/"
$ProgressPreference = 'SilentlyContinue'   # downloads ficam muito mais rapidos sem a barra de progresso
try { $Host.UI.RawUI.WindowTitle = 'Central Hubii - painel (pode minimizar, nao feche)' } catch { }

function AbrirJanelaPainel {
    # Abre no Edge em modo "aplicativo" (janela propria, sem barra de endereco).
    # Usa o Edge de proposito: algumas rotinas fecham o Chrome, e o painel nao pode fechar junto.
    $edges = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")
    $edge = $edges | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    try {
        if ($edge) { Start-Process -FilePath $edge -ArgumentList @("--app=$base", '--window-size=1200,880', '--no-first-run') }
        elseif (Test-Path $chrome) { Start-Process -FilePath $chrome -ArgumentList @("--app=$base", '--window-size=1200,880') }
        else { Start-Process $base }
    } catch { Start-Process $base }
}

# ---------- ligar o servidor (ou, se ja estiver ligado, so abrir a janela)
$srv = New-Object System.Net.HttpListener
$srv.Prefixes.Add($base)
if ($Reinicio) {
    # depois de uma atualizacao: o painel antigo ainda pode estar fechando; tenta por ate 20 s
    for ($i = 0; $i -lt 40 -and -not $srv.IsListening; $i++) {
        try { $srv.Start() } catch { Start-Sleep -Milliseconds 500; $srv = New-Object System.Net.HttpListener; $srv.Prefixes.Add($base) }
    }
}
try { if (-not $srv.IsListening) { $srv.Start() } }
catch {
    $jaLigado = $false
    try { $r = Invoke-WebRequest -UseBasicParsing -Uri ($base + 'api/ping') -TimeoutSec 3; $jaLigado = ($r.Content -match 'central-hubii') } catch { }
    if ($jaLigado) { if (-not $SemJanela) { AbrirJanelaPainel }; exit 0 }
    Write-Host ''
    Write-Host 'NAO FOI POSSIVEL ligar o painel.' -ForegroundColor Red
    Write-Host ('Motivo: ' + $_.Exception.Message)
    Write-Host "Outro programa pode estar usando a porta $Porta. Me envie um print desta janela."
    Read-Host 'Aperte Enter para fechar'
    exit 1
}

Write-Host "Painel da Central Hubii ligado em $base" -ForegroundColor Green
Write-Host 'Pode minimizar esta janela. Para desligar o painel, feche-a (ou use "Desligar painel").'
if (-not $SemJanela) { AbrirJanelaPainel }

# ---------- historico por pedido: um arquivo neste computador (fora da pasta da Central, para nao se perder ao atualizar)
$histDir = Join-Path $env:LOCALAPPDATA 'CentralHubii'
if (-not $env:LOCALAPPDATA) { $histDir = Join-Path $dir 'dados' }
$histArq = Join-Path $histDir 'historico.ndjson'
$utf8 = New-Object System.Text.UTF8Encoding($false)
try { if (-not (Test-Path $histDir)) { New-Item -ItemType Directory -Path $histDir -Force | Out-Null } } catch { }
function CompactarHistorico {
    # cada linha e o registro completo de um pedido vindo de um Chrome; guarda so a ultima de cada (Chrome, pedido)
    # e descarta pedidos sem movimento ha mais de 400 dias
    try {
        if (-not (Test-Path $histArq)) { return }
        if ((Get-Item $histArq).Length -lt 2MB) { return }
        $ult = [ordered]@{}
        $limite = [DateTimeOffset]::Now.AddDays(-400).ToUnixTimeMilliseconds()
        foreach ($l in [System.IO.File]::ReadAllLines($histArq, $utf8)) {
            if (-not $l.StartsWith('{')) { continue }
            $f = ''; if ($l -match '"fonte":"([a-z0-9]+)"') { $f = $Matches[1] }
            if (-not ($l -match '"id":"(\d+)"')) { continue }
            $k = $f + '|' + $Matches[1]
            if ($l -match '"u":(\d+)') { if ([int64]$Matches[1] -lt $limite) { continue } }
            if ($ult.Contains($k)) { $ult.Remove($k) }
            $ult[$k] = $l
        }
        $tmp = $histArq + '.novo'
        [System.IO.File]::WriteAllLines($tmp, [string[]]@($ult.Values), $utf8)
        Copy-Item $histArq ($histArq + '.anterior') -Force
        Move-Item $tmp $histArq -Force
    } catch { }
}
CompactarHistorico
$bkDir = Join-Path $histDir 'backups'
$pendDir = Join-Path $histDir 'pendencias'
foreach ($d in @($bkDir, $pendDir)) { try { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null } } catch { } }
# apaga partes de backup e restauracoes com mais de 30 dias
try { Get-ChildItem $bkDir -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force -ErrorAction SilentlyContinue } catch { }
$restResult = @{}
$verDir = Join-Path $histDir 'versoes'
$atuDir = Join-Path $histDir 'atualizacao'
foreach ($d in @($verDir, $atuDir)) { try { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null } } catch { } }
$reiniciar = $false
function LerVersao($pasta) { try { return [version](((Get-Content -Raw -Encoding UTF8 (Join-Path $pasta 'extensao-central-hubii\manifest.json')) | ConvertFrom-Json).version) } catch { return $null } }
function RotinaRodando {
    foreach ($k in @($fontes.Keys)) { $f = $fontes[$k]; if (((Get-Date) - $f.t).TotalSeconds -lt 30 -and $f.json -match '"rodando":true') { return $true } }
    try { if (@(Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction Stop | Where-Object { $_.CommandLine -like '*ajudante-etiquetas*' }).Count) { return $true } } catch { }
    return $false
}
function GuardarVersaoAtual {
    # copia a pasta atual (menos a pasta de testes) para %LOCALAPPDATA%\CentralHubii\versoes, e mantem so as 3 ultimas
    $v = LerVersao $dir; if (-not $v) { $v = '0.0.0' }
    $dest = Join-Path $verDir ("$v-" + (Get-Date).ToString('yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Get-ChildItem $dir -Force | Where-Object { $_.Name -ne 'teste-fake' } | ForEach-Object { Copy-Item $_.FullName -Destination $dest -Recurse -Force }
    Get-ChildItem $verDir -Directory | Sort-Object LastWriteTime -Descending | Select-Object -Skip 3 | ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
    return $dest
}
function CopiarPacote($origem) {
    Get-ChildItem $origem -Force | ForEach-Object { Copy-Item $_.FullName -Destination $dir -Recurse -Force }
}
function PedirRecarregar {
    # o painel reinicia logo depois: deixa anotado para o painel novo mandar as extensoes se recarregarem
    try { [System.IO.File]::WriteAllText((Join-Path $atuDir 'recarregar.txt'), [guid]::NewGuid().ToString('N'), $utf8) } catch { }
    $script:reiniciar = $true
}
function InstalarZip($bytes, [bool]$confirmado) {
    if (RotinaRodando) { return @{ ok = $false; msg = 'Tem uma rotina rodando (descritivos, etiquetas, baixa ou o ajudante de etiquetas). Espere terminar, feche o ajudante e tente de novo.' } }
    $zip = Join-Path $atuDir 'novo.zip'; $tmp = Join-Path $atuDir 'extraido'
    [System.IO.File]::WriteAllBytes($zip, $bytes)
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    try { Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue; [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $tmp) }
    catch { return @{ ok = $false; msg = 'Esse arquivo não é um zip válido.' } }
    $man = Get-ChildItem $tmp -Recurse -Filter manifest.json -File | Where-Object { $_.Directory.Name -eq 'extensao-central-hubii' } | Select-Object -First 1
    if (-not $man) { return @{ ok = $false; msg = 'Esse zip não é um pacote da Central Hubii (não achei a extensão dentro dele).' } }
    $raiz = $man.Directory.Parent.FullName
    if (-not (Test-Path (Join-Path $raiz 'painel-servidor.ps1'))) { return @{ ok = $false; msg = 'Esse zip tem só a extensão. Use o pacote completo (hubii-central-x.x.x.zip).' } }
    $nova = LerVersao $raiz; $atual = LerVersao $dir
    if (-not $nova) { return @{ ok = $false; msg = 'Não consegui ler a versão do pacote.' } }
    if ($atual -and $nova -lt $atual) { return @{ ok = $false; msg = "Esse pacote é a versão $nova, mais antiga que a instalada ($atual). Para voltar uma versao, use 'Voltar à versão anterior'." } }
    if ($atual -and $nova -eq $atual -and -not $confirmado) { return @{ ok = $false; confirmar = "A versão $nova já está instalada. Instalar de novo mesmo assim?" } }
    $copia = GuardarVersaoAtual
    try { CopiarPacote $raiz } catch { try { CopiarPacote $copia } catch { }; return @{ ok = $false; msg = 'Não consegui trocar os arquivos (algum arquivo em uso?). Nada mudou. Detalhe: ' + $_.Exception.Message } }
    try { Remove-Item $tmp -Recurse -Force; Remove-Item $zip -Force } catch { }
    PedirRecarregar
    return @{ ok = $true; versao = "$nova"; anterior = "$atual"; msg = "Versão $nova instalada. O painel vai reiniciar e as extensões vão se recarregar sozinhas." }
}
function VoltarVersao([bool]$confirmado) {
    if (RotinaRodando) { return @{ ok = $false; msg = 'Tem uma rotina rodando. Espere terminar e tente de novo.' } }
    $atual = LerVersao $dir
    $ult = Get-ChildItem $verDir -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Where-Object { (LerVersao $_.FullName) -ne $atual } | Select-Object -First 1
    if (-not $ult) { return @{ ok = $false; msg = 'Não há versão anterior guardada.' } }
    $v = LerVersao $ult.FullName
    if (-not $confirmado) { return @{ ok = $false; confirmar = "Voltar da versão $atual para a $v (guardada em " + $ult.LastWriteTime.ToString('dd/MM HH:mm') + ')? Seus dados não são mexidos.' } }
    [void](GuardarVersaoAtual)
    try { CopiarPacote $ult.FullName } catch { return @{ ok = $false; msg = 'Não consegui trocar os arquivos: ' + $_.Exception.Message } }
    PedirRecarregar
    return @{ ok = $true; versao = "$v"; msg = "Voltou para a versão $v. O painel vai reiniciar e as extensões vão se recarregar sozinhas." }
}
# ---------- atualizacao pela internet (versoes publicadas no GitHub)
# O endereco fica em atualizacao-online.txt (dono/repositorio). Vazio = desligado.
# No repositorio, versao.json diz qual e a ultima versao e onde esta o zip (pasta versoes/).
# So baixa; quem instala e o mesmo InstalarZip do botao "Instalar de um arquivo .zip" (mesmas conferencias).
$repoOnline = ''
try { $repoOnline = ([System.IO.File]::ReadAllText((Join-Path $dir 'atualizacao-online.txt'), $utf8)).Trim() } catch { }
if ($repoOnline -notmatch '^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$') { $repoOnline = '' }
$rawBase = "https://raw.githubusercontent.com/$repoOnline/main/"
$online = @{ t = [datetime]::MinValue; r = $null }
function Web($url, $arquivo) {
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
    $p = @{ Uri = $url; UseBasicParsing = $true; TimeoutSec = 20; Headers = @{ 'User-Agent' = 'central-hubii'; 'Cache-Control' = 'no-cache' } }
    if ($arquivo) { $p.TimeoutSec = 180; $p.OutFile = $arquivo; Invoke-WebRequest @p | Out-Null; return }
    # le como texto UTF-8 (o Invoke-RestMethod do PowerShell 5.1 pode estragar os acentos)
    $r = Invoke-WebRequest @p
    $b = $r.RawContentStream.ToArray()
    return ([System.Text.Encoding]::UTF8.GetString($b).TrimStart([char]0xFEFF) | ConvertFrom-Json)
}
function BuscarOnline([bool]$forcar) {
    if (-not $repoOnline) { return @{ ok = $false; desligado = $true; msg = 'A atualização pela internet ainda não está ligada nesta versão.' } }
    if (-not $forcar -and $online.r -and ((Get-Date) - $online.t).TotalMinutes -lt 30) { return $online.r }
    $atual = LerVersao $dir
    try { $inf = Web ($rawBase + 'versao.json?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) $null }
    catch {
        $cod = 0; try { $cod = [int]$_.Exception.Response.StatusCode } catch { }
        if ($cod -eq 404) { $r = @{ ok = $false; msg = 'Ainda não há nenhuma versão publicada na internet.' } }
        else { $r = @{ ok = $false; msg = 'Não consegui falar com o GitHub (sem internet ou bloqueado nesta rede). Detalhe: ' + $_.Exception.Message } }
        $online.t = Get-Date; $online.r = $r; return $r
    }
    $nova = $null; try { $nova = [version]([string]$inf.versao) } catch { }
    $arq = [string]$inf.arquivo; $sha = ([string]$inf.sha256).ToLower()
    if (-not $nova -or $arq -notmatch '^versoes/hubii-central-[\d.]+\.zip$' -or $sha -notmatch '^[a-f0-9]{64}$') { $r = @{ ok = $false; msg = 'A versão publicada na internet está incompleta. Avise o Claude.' } }
    else {
        $txt = [string]$inf.novidades; if ($txt.Length -gt 3000) { $txt = $txt.Substring(0, 3000) + '...' }
        $data = ''; try { $data = ([datetime]$inf.data).ToLocalTime().ToString('dd/MM/yyyy HH:mm') } catch { }
        $r = @{ ok = $true; atual = "$atual"; nova = "$nova"; temNova = [bool]($atual -and $nova -gt $atual); novidades = $txt; data = $data; tamanho = [int64]$inf.tamanho; url = ($rawBase + $arq); sha = $sha }
    }
    $online.t = Get-Date; $online.r = $r; return $r
}
function InstalarOnline([bool]$confirmado) {
    if (RotinaRodando) { return @{ ok = $false; msg = 'Tem uma rotina rodando (descritivos, etiquetas, baixa ou o ajudante de etiquetas). Espere terminar, feche o ajudante e tente de novo.' } }
    $info = BuscarOnline $true
    if (-not $info.ok) { return $info }
    if (-not $info.temNova -and -not $confirmado) { return @{ ok = $false; confirmar = "A versão da internet ($($info.nova)) é a mesma que já está instalada. Instalar de novo mesmo assim?" } }
    if (-not $info.url.StartsWith($rawBase)) { return @{ ok = $false; msg = 'Endereço do pacote estranho; não baixei nada.' } }
    $arq = Join-Path $atuDir 'baixado.zip'
    try { [void](Web $info.url $arq) } catch { return @{ ok = $false; msg = 'Não consegui baixar o pacote. Nada mudou. Detalhe: ' + $_.Exception.Message } }
    $bytes = [System.IO.File]::ReadAllBytes($arq); Remove-Item $arq -Force -ErrorAction SilentlyContinue
    # confere a "impressao digital" (SHA-256) do pacote: se o arquivo chegou corrompido ou trocado, nao instala
    $esperado = $info.sha
    if (-not $esperado) { return @{ ok = $false; msg = 'O pacote da internet veio sem a conferência (SHA-256). Por segurança não instalei. Nada mudou.' } }
    $h = [System.Security.Cryptography.SHA256]::Create()
    $calc = ([System.BitConverter]::ToString($h.ComputeHash($bytes)) -replace '-', '').ToLower()
    if ($calc -ne $esperado) { return @{ ok = $false; msg = 'O pacote baixado não confere (pode ter chegado corrompido). Não instalei; nada mudou. Tente de novo mais tarde.' } }
    return (InstalarZip $bytes $true)
}
# ---------- planilha na nuvem (Google): envia o historico de pedidos para uma planilha e restaura dela
# Fica desligada ate a pessoa configurar (Ajuda e backup > Planilha na nuvem). Envia so numero do pedido, produtos,
# quantidades, horas e codigo BR (nada de nome, CPF, endereco ou valor). Config e estado ficam em %LOCALAPPDATA%\CentralHubii.
$nuvemArq = Join-Path $histDir 'nuvem.json'
$nuvemEstArq = Join-Path $histDir 'nuvem-estado.json'
$nuvemRx = '^https://script\.google\.com/(macros/s/[A-Za-z0-9_-]+|a/macros/[A-Za-z0-9.-]+/s/[A-Za-z0-9_-]+)/exec$'
$nuvem = @{ suja = $true; ultimaTentativa = (Get-Date); espera = 30; ok = $null; erro = ''; faltam = 0; ligada = $false }
function NuvemLerArq { try { if (Test-Path $nuvemArq) { return ([System.IO.File]::ReadAllText($nuvemArq, $utf8) | ConvertFrom-Json) } } catch { }; return $null }
function NuvemGravarCfg($c) { [System.IO.File]::WriteAllText($nuvemArq, ($c | ConvertTo-Json -Compress), $utf8) }
function NuvemChave {
    # a chave e criada uma vez; o script do Google leva a mesma (so quem tem a chave grava ou le)
    $c = NuvemLerArq
    if ($c -and ([string]$c.chave) -match '^[a-f0-9]{32}$') { return $c }
    $n = [pscustomobject]@{ url = ''; chave = [guid]::NewGuid().ToString('N'); loja = 'PF19 Américas' }
    NuvemGravarCfg $n; return $n
}
function NuvemCfg { $c = NuvemLerArq; if ($c -and ([string]$c.url) -match $nuvemRx -and ([string]$c.chave) -match '^[a-f0-9]{32}$') { return $c }; return $null }
function NuvemEstadoLer { try { if (Test-Path $nuvemEstArq) { return ([System.IO.File]::ReadAllText($nuvemEstArq, $utf8) | ConvertFrom-Json) } } catch { }; return [pscustomobject]@{ ultimoU = 0 } }
function NuvemEstadoGravar([int64]$u) { try { [System.IO.File]::WriteAllText($nuvemEstArq, (@{ ultimoU = $u } | ConvertTo-Json -Compress), $utf8) } catch { } }
function NuvemHttp($metodo, $url, [string]$corpo) {
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
    $p = @{ Uri = $url; UseBasicParsing = $true; TimeoutSec = 60; Method = $metodo; Headers = @{ 'User-Agent' = 'central-hubii' } }
    if ($metodo -eq 'Post') { $p.Body = [System.Text.Encoding]::UTF8.GetBytes($corpo); $p.ContentType = 'application/json; charset=utf-8' }
    $r = Invoke-WebRequest @p
    $txt = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    try { return ($txt.TrimStart([char]0xFEFF) | ConvertFrom-Json) }
    catch { throw 'O Google não devolveu dados do script. Confira, na implantação do Apps Script, se "Quem pode acessar" está como "Qualquer pessoa".' }
}
function NuvemMsgErro($e) {
    $m = [string]$e
    if ($m -eq 'chave') { return 'A chave não bate. Copie o código do script de novo (o botão "Copiar código do script" já leva a chave certa), cole na planilha, salve e implante uma nova versão.' }
    return 'Não consegui falar com a planilha: ' + $m
}
function NuvemEnviar {
    $cfg = NuvemCfg
    if (-not $cfg) { return @{ ok = $false; msg = 'A planilha na nuvem ainda não foi configurada.' } }
    try {
        $ultU = [int64](NuvemEstadoLer).ultimoU
        $lista = New-Object System.Collections.ArrayList
        if (Test-Path $histArq) {
            foreach ($l in [System.IO.File]::ReadAllLines($histArq, $utf8)) {
                if (-not $l.StartsWith('{') -or -not $l.EndsWith('}')) { continue }
                if ($l -match '"u":(\d+)') { $u = [int64]$Matches[1] } else { continue }
                if ($u -gt $ultU) { [void]$lista.Add([pscustomobject]@{ u = $u; l = $l }) }
            }
        }
        $ord = @($lista | Sort-Object u)
        $enviados = 0; $i = 0; $lotes = 0
        while ($i -lt $ord.Count -and $lotes -lt 5) {
            $j = [Math]::Min($i + 99, $ord.Count - 1)
            while ($j + 1 -lt $ord.Count -and $ord[$j + 1].u -eq $ord[$j].u) { $j++ }   # nao corta no meio de registros com o mesmo horario
            $cab = (@{ acao = 'historico'; chave = [string]$cfg.chave; loja = [string]$cfg.loja; pc = [string]$env:COMPUTERNAME } | ConvertTo-Json -Compress)
            $corpo = $cab.Substring(0, $cab.Length - 1) + ',"registros":[' + ((@($ord[$i..$j]) | ForEach-Object { $_.l }) -join ',') + ']}'
            $r = NuvemHttp 'Post' ([string]$cfg.url) $corpo
            if (-not $r.ok) { throw ([string]$r.erro) }
            NuvemEstadoGravar ([int64]$ord[$j].u)
            $enviados += ($j - $i + 1); $i = $j + 1; $lotes++
        }
        $nuvem.ok = Get-Date; $nuvem.erro = ''; $nuvem.faltam = ($ord.Count - $i)
        return @{ ok = $true; enviados = $enviados; faltam = ($ord.Count - $i); msg = $(if ($enviados) { "Enviado: $enviados registro(s)" + $(if ($ord.Count - $i) { '; faltam ' + ($ord.Count - $i) } else { '.' }) } else { 'Tudo já estava na planilha.' }) }
    } catch {
        $m = NuvemMsgErro $_.Exception.Message; $nuvem.erro = $m
        return @{ ok = $false; msg = $m }
    }
}
function NuvemTique {
    # chamado a cada volta do servidor: envia o que for novo, no maximo a cada 5 minutos (20 s enquanto ainda faltar)
    if (-not $nuvem.suja -or -not $nuvem.ligada) { return }
    if (((Get-Date) - $nuvem.ultimaTentativa).TotalSeconds -lt $nuvem.espera) { return }
    $nuvem.ultimaTentativa = Get-Date
    $r = NuvemEnviar
    if ($r.ok) { if ($r.faltam -gt 0) { $nuvem.espera = 20 } else { $nuvem.suja = $false; $nuvem.espera = 300 } } else { $nuvem.espera = 600 }
}
function NuvemTestar {
    $cfg = NuvemCfg
    if (-not $cfg) { return @{ ok = $false; msg = 'Cole o endereço do script do Google (termina em /exec).' } }
    try {
        $r = NuvemHttp 'Get' (([string]$cfg.url) + '?chave=' + $cfg.chave + '&acao=testar') $null
        if (-not $r.ok) { throw ([string]$r.erro) }
        return @{ ok = $true; msg = 'Conectado à planilha "' + [string]$r.planilha + '".' }
    } catch { return @{ ok = $false; msg = (NuvemMsgErro $_.Exception.Message) } }
}
function NuvemSalvar([string]$entrada, [string]$loja) {
    # aceita o endereco do script ou o "codigo de conexao" (endereco#chave) copiado de outro computador
    $entrada = $entrada.Trim(); $chaveNova = ''
    if ($entrada.Contains('#')) { $pt = $entrada.Split('#'); $entrada = $pt[0].Trim(); $chaveNova = $pt[1].Trim().ToLower() }
    if ($entrada -notmatch $nuvemRx) { return @{ ok = $false; msg = 'Esse endereço não parece ser de um script do Google. Ele começa com https://script.google.com/ e termina com /exec.' } }
    if ($chaveNova -and $chaveNova -notmatch '^[a-f0-9]{32}$') { return @{ ok = $false; msg = 'A chave depois do # não parece certa (são 32 letras e números).' } }
    $c = NuvemChave; $c.url = $entrada
    if ($chaveNova) { $c.chave = $chaveNova }
    if ($loja.Trim()) { $c.loja = $loja.Trim().Substring(0, [Math]::Min(60, $loja.Trim().Length)) }
    NuvemGravarCfg $c; $nuvem.ligada = $true; $nuvem.suja = $true; $nuvem.espera = 0; $nuvem.erro = ''
    return (NuvemTestar)
}
function NuvemDesligar { $c = NuvemChave; $c.url = ''; NuvemGravarCfg $c; $nuvem.ligada = $false; $nuvem.erro = ''; return @{ ok = $true; msg = 'Planilha na nuvem desligada. Nada mais será enviado (o que já está na planilha continua lá).' } }
function NuvemRestaurar {
    $cfg = NuvemCfg
    if (-not $cfg) { return @{ ok = $false; msg = 'A planilha na nuvem ainda não foi configurada.' } }
    try {
        $desde = 2; $pag = 0; $linhas = New-Object System.Collections.ArrayList; $maxU = [int64]0
        while ($desde -and $pag -lt 400) {
            $q = ([string]$cfg.url) + '?chave=' + $cfg.chave + '&acao=historico&desde=' + $desde + '&limite=200&loja=' + [uri]::EscapeDataString([string]$cfg.loja)
            $r = NuvemHttp 'Get' $q $null
            if (-not $r.ok) { throw ([string]$r.erro) }
            foreach ($x in @($r.registros)) {
                $t = [string]$x
                if (-not $t.StartsWith('{') -or -not $t.EndsWith('}') -or $t.Length -ge 20000 -or $t -match "[\r\n]" -or $t -notmatch '"id":"\d{5,9}"') { continue }
                $t = '{"fonte":"nuvem",' + $t.Substring(1)
                [void]$linhas.Add($t)
                if ($t -match '"u":(\d+)') { $maxU = [Math]::Max($maxU, [int64]$Matches[1]) }
            }
            $desde = $r.proximo; $pag++
        }
        if ($linhas.Count) { [System.IO.File]::AppendAllText($histArq, (($linhas -join "`n") + "`n"), $utf8) }
        # o que veio da planilha nao precisa voltar para ela
        if ($maxU -gt [int64](NuvemEstadoLer).ultimoU) { NuvemEstadoGravar $maxU }
        return @{ ok = $true; n = $linhas.Count; msg = "Restaurado da planilha: $($linhas.Count) pedido(s). Abra Histórico de pedidos ou Compra contínua para ver." }
    } catch { return @{ ok = $false; msg = (NuvemMsgErro $_.Exception.Message) } }
}
function NuvemResumo {
    $ok = ''; if ($nuvem.ok) { $ok = ([datetime]$nuvem.ok).ToString('HH:mm') }
    $c = NuvemLerArq
    return @{ ligada = [bool]$nuvem.ligada; ok = $ok; erro = [string]$nuvem.erro; faltam = [int]$nuvem.faltam; loja = $(if ($c) { [string]$c.loja } else { 'PF19 Américas' }); url = $(if ($c) { [string]$c.url } else { '' }); codigo = $(if ($c -and [string]$c.url) { [string]$c.url + '#' + [string]$c.chave } else { '' }) }
}
$nuvem.ligada = [bool](NuvemCfg)

function NovaOrdem($acao, $id, $seg) { if (-not $id) { $id = [guid]::NewGuid().ToString('N') }; [void]$ordens.Add(@{ id = $id; acao = $acao; t = Get-Date; seg = $seg; entregues = @{} }); return $id }
function JuntarArquivos($filtro, $prefixo) {
    # monta {"<fonte>": <conteudo do arquivo>, ...} sem reler o JSON (os arquivos ja sao JSON valido)
    $partes = @()
    foreach ($f in @(Get-ChildItem $filtro -File -ErrorAction SilentlyContinue)) {
        $nome = $f.BaseName; if ($prefixo) { $nome = $nome.Substring($prefixo.Length) }
        if ($nome -notmatch '^[a-z0-9]{3,20}$') { continue }
        $partes += ('"' + $nome + '":' + [System.IO.File]::ReadAllText($f.FullName, $utf8))
    }
    return ('{' + ($partes -join ',') + '}')
}

# ---------- estado guardado em memoria
$fontes = @{}          # cada Chrome com a extensao: id -> @{ t = data; json = texto }
$ordens = New-Object System.Collections.ArrayList   # pedidos de "parar" para a extensao
$pr = Join-Path $atuDir 'recarregar.txt'
if (Test-Path $pr) {
    # o painel acabou de ser atualizado: cada Chrome com a extensao se recarrega uma vez (ate 10 minutos)
    $rid = ([System.IO.File]::ReadAllText($pr, $utf8)).Trim(); Remove-Item $pr -Force -ErrorAction SilentlyContinue
    if ($rid -match '^[a-f0-9]{32}$') { [void]$ordens.Add(@{ id = $rid; acao = 'recarregar'; t = Get-Date; seg = 600; entregues = @{} }) }
}
$cache = @{ t = [datetime]::MinValue; imp = $null; proc = $null }

function VersaoPasta {
    try { return ((Get-Content -Raw -Encoding UTF8 (Join-Path $dir 'extensao-central-hubii\manifest.json')) | ConvertFrom-Json).version } catch { return '' }
}

function LerComputador {
    if (((Get-Date) - $cache.t).TotalSeconds -lt 6 -and $cache.imp) { return }
    $imp = [ordered]@{ mp = 'desconhecido'; argox = 'desconhecido'; padrao = '' }
    try {
        $l = @(Get-CimInstance Win32_Printer -ErrorAction Stop)
        $d = $l | Where-Object { $_.Default } | Select-Object -First 1
        if ($d) { $imp.padrao = [string]$d.Name }
        $mp = $l | Where-Object { $_.Name -eq 'MP-4200 TH' } | Select-Object -First 1
        $imp.mp = if (-not $mp) { 'ausente' } elseif ($mp.WorkOffline -or $mp.PrinterStatus -eq 7) { 'offline' } else { 'ok' }
        $ax = $l | Where-Object { $_.Name -like 'Argox*' } | Select-Object -First 1
        $imp.argox = if (-not $ax) { 'ausente' } elseif ($ax.WorkOffline -or $ax.PrinterStatus -eq 7) { 'offline' } else { 'ok' }
    } catch { }
    $proc = [ordered]@{ ajudante = $false; chromeCentral = $false; chrome = $false }
    try {
        $ps = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe' OR Name='chrome.exe' OR Name='brave.exe'" -ErrorAction Stop)
        $proc.ajudante = [bool]($ps | Where-Object { $_.Name -notin @('chrome.exe', 'brave.exe') -and $_.CommandLine -like '*ajudante-etiquetas*' })
        $proc.chromeCentral = [bool]($ps | Where-Object { $_.Name -in @('chrome.exe', 'brave.exe') -and $_.CommandLine -like '*CentralHubiiChrome*' })
        $proc.chrome = [bool]($ps | Where-Object { $_.Name -in @('chrome.exe', 'brave.exe') })
    } catch {
        try { $proc.chrome = [bool](Get-Process -Name chrome, brave -ErrorAction SilentlyContinue) } catch { }
    }
    $cache.imp = $imp; $cache.proc = $proc; $cache.t = Get-Date
}

function Responder($ctx, [int]$codigo, [string]$texto, [string]$tipo) {
    try {
        $b = [System.Text.Encoding]::UTF8.GetBytes($texto)
        $ctx.Response.StatusCode = $codigo
        $ctx.Response.ContentType = "$tipo; charset=utf-8"
        $ctx.Response.Headers.Add('Cache-Control', 'no-store')
        $ctx.Response.ContentLength64 = $b.Length
        $ctx.Response.OutputStream.Write($b, 0, $b.Length)
    } catch { }
    try { $ctx.Response.OutputStream.Close() } catch { }
}
function Json($o) { return ($o | ConvertTo-Json -Depth 6 -Compress) }

function Rodar($arquivo) {
    $p = Join-Path $dir $arquivo
    if (-not (Test-Path $p)) { return @{ ok = $false; msg = "Nao encontrei $arquivo na pasta da Central." } }
    Start-Process -FilePath $p -WorkingDirectory $dir
    return @{ ok = $true; msg = "Abrindo $arquivo..." }
}
# Coletar, Verificar e Baixa abrem no Chrome da Central (o mesmo das impressoes), que ja roda no "modo segundo plano".
# Assim o Chrome do pessoal nunca e fechado nem precisa ser reaberto.
$raizCentral = Join-Path $env:LOCALAPPDATA 'CentralHubiiChrome'
function ChromeCentral([string[]]$urls, [string]$oque, [bool]$aba) {
    if (-not (Test-Path $chrome)) { return @{ ok = $false; msg = 'Navegador nao encontrado (nem Chrome nem Brave).' } }
    if (-not (Test-Path (Join-Path $raizCentral 'Default\Preferences'))) { return @{ ok = $false; msg = 'O Chrome da Central ainda nao foi preparado neste computador. Clique uma vez em Imprimir descritivos (ele mostra o passo a passo da primeira vez) e depois tente de novo.' } }
    $aberto = $false
    try { $aberto = [bool](@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='brave.exe'" -ErrorAction Stop | Where-Object { $_.CommandLine -like '*CentralHubiiChrome*' }).Count) } catch { }
    # as mesmas opcoes do Descritivos.bat (so valem quando o Chrome da Central e aberto agora; se ja estava aberto, ele ja tem)
    $args0 = @("--user-data-dir=`"$raizCentral`"", '--profile-directory=Default', '--kiosk-printing', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion', '--no-first-run', '--no-default-browser-check', '--hide-crash-restore-bubble')
    if ($aberto -and $aba) {
        # ja aberto: so uma aba nova na janela que esta em uso (sem abrir outra janela)
        foreach ($u in $urls) { Start-Process -FilePath $chrome -ArgumentList @("--user-data-dir=`"$raizCentral`"", '--profile-directory=Default', $u) }
        return @{ ok = $true; msg = "Abrindo $oque numa aba nova do Chrome da Central. Enquanto a rotina roda, fique nessa aba (a rotina pausa se a aba ficar escondida)." }
    }
    $n = 0
    foreach ($u in $urls) {
        if ($n -gt 0) { Start-Sleep -Seconds $(if ($aberto) { 1 } else { 3 }) }
        Start-Process -FilePath $chrome -ArgumentList ($args0 + @('--new-window', $u)); $n++
    }
    return @{ ok = $true; msg = "Abrindo $oque no Chrome da Central (o Chrome do pessoal nao e mexido). Se pedir login, entre uma vez: ele lembra." }
}

function Acao($a, [bool]$confirmado, $dados) {
    switch ($a) {
        'descritivos' { return (Rodar 'Descritivos.bat') }
        'etiquetas'   { return (Rodar 'Etiquetas.bat') }
        'reimprimir'  { return (Rodar 'Reimprimir-Descritivos.bat') }
        'voltarmp'    { $cache.t = [datetime]::MinValue; return (Rodar 'Voltar-MP.bat') }
        'centralantiga' { return (Rodar 'Central-antiga.bat') }
        'verificar'   { return (ChromeCentral @('https://hub.hubii.co/pedidos', 'https://onehub.onepet.com.br/onehub') 'o Hubii e o OneHub (uma janela cada)') }
        'coletar'     { return (ChromeCentral @($urlPendencias + '&central=coletar') 'as Pendencias do OnePet' $true) }
        'baixa'       { return (ChromeCentral @($urlPendencias) 'as Pendencias do OnePet (Baixa Hubii)') }
        'extensoes'   { if (Test-Path $chrome) { Start-Process -FilePath $chrome -ArgumentList @("--profile-directory=`"$perfil`"", '--new-window', 'chrome://extensions') }; return @{ ok = $true; msg = 'Abrindo as extensoes do Chrome...' } }
        'abrirpedido' {
            $id = [string]$dados.id
            if (-not ($id -match '^\d{5,9}$')) { return @{ ok = $false; msg = 'Numero de pedido invalido.' } }
            if (-not (Test-Path $chrome)) { return @{ ok = $false; msg = 'Chrome nao encontrado.' } }
            Start-Process -FilePath $chrome -ArgumentList @("--profile-directory=`"$perfil`"", "https://hub.hubii.co/pedidos?search=$id")
            return @{ ok = $true; msg = "Abrindo o pedido $id no Hubii (Chrome)..." }
        }
        'voltarversao' { return (VoltarVersao $confirmado) }
        'nuvemsalvar'    { return (NuvemSalvar ([string]$dados.url) ([string]$dados.loja)) }
        'nuvemtestar'    { return (NuvemTestar) }
        'nuvemenviar'    { $nuvem.suja = $true; return (NuvemEnviar) }
        'nuvemrestaurar' { return (NuvemRestaurar) }
        'nuvemdesligar'  { return (NuvemDesligar) }
        'instalaronline' { return (InstalarOnline $confirmado) }
        'backup'      { $id = NovaOrdem 'backup' $null 90; return @{ ok = $true; id = $id; msg = 'Pedindo os dados a cada Chrome com a extensao...' } }
        'parar'       { [void]$ordens.Add(@{ id = [guid]::NewGuid().ToString('N'); acao = 'parar'; t = Get-Date; entregues = @{} }); return @{ ok = $true; msg = 'Pedido de parada enviado. A rotina termina o pedido atual e para.' } }
        default       { return @{ ok = $false; msg = 'Acao desconhecida.' } }
    }
}

# ---------- atender os pedidos da pagina e da extensao
$ligado = $true
while ($ligado -and $srv.IsListening) {
    try { NuvemTique } catch { }
    try { $ctx = $srv.GetContext() } catch { break }
    $req = $ctx.Request
    $rota = $req.Url.AbsolutePath
    try {
        if ($req.HttpMethod -eq 'GET') {
            if ($rota -eq '/' -or $rota -eq '/index.html') {
                $html = Get-Content -Raw -Encoding UTF8 (Join-Path $dir 'painel.html')
                Responder $ctx 200 $html 'text/html'
            }
            elseif ($rota -eq '/api/historico') {
                $txt = ''
                if (Test-Path $histArq) { $txt = [System.IO.File]::ReadAllText($histArq, $utf8) }
                Responder $ctx 200 $txt 'text/plain'
            }
            elseif ($rota -eq '/ext/planilha.js') {
                $js = [System.IO.File]::ReadAllText((Join-Path $dir 'extensao-central-hubii\planilha.js'), $utf8)
                Responder $ctx 200 $js 'application/javascript'
            }
            elseif ($rota -eq '/api/pend') {
                Responder $ctx 200 (JuntarArquivos (Join-Path $pendDir 'pend-*.json') 'pend-') 'application/json'
            }
            elseif ($rota -eq '/api/backup-partes') {
                $bid = [string]$req.QueryString['id']
                if ($bid -notmatch '^[a-f0-9]{32}$') { Responder $ctx 400 'id invalido' 'text/plain'; continue }
                Responder $ctx 200 (JuntarArquivos (Join-Path $bkDir "parte-$bid-*.json") "parte-$bid-") 'application/json'
            }
            elseif ($rota -eq '/api/restaurar-dados') {
                $rid = [string]$req.QueryString['id']; $p = Join-Path $bkDir "restaurar-$rid.json"
                if ($rid -notmatch '^[a-f0-9]{32}$' -or -not (Test-Path $p)) { Responder $ctx 404 'nao encontrado' 'text/plain'; continue }
                Responder $ctx 200 ([System.IO.File]::ReadAllText($p, $utf8)) 'application/json'
            }
            elseif ($rota -eq '/api/restaurar-status') {
                $rid = [string]$req.QueryString['id']; $r = @{}
                if ($restResult.ContainsKey($rid)) { $r = $restResult[$rid] }
                Responder $ctx 200 (Json @{ fontes = $r }) 'application/json'
            }
            elseif ($rota -eq '/manifest.webmanifest') {
                $m = '{"name":"Central Hubii","short_name":"Central Hubii","start_url":"/","display":"standalone","background_color":"#1B1F48","theme_color":"#1B1F48","icons":[{"src":"/logos/central-192.png","sizes":"192x192","type":"image/png"},{"src":"/logos/central-512.png","sizes":"512x512","type":"image/png"}]}'
                Responder $ctx 200 $m 'application/manifest+json'
            }
            elseif ($rota -eq '/api/online') { Responder $ctx 200 (Json (BuscarOnline ($req.QueryString['forcar'] -eq '1'))) 'application/json' }
            elseif ($rota -eq '/api/nuvem') { Responder $ctx 200 (Json (NuvemResumo)) 'application/json' }
            elseif ($rota -eq '/api/nuvem-script') {
                $pg = Join-Path (Join-Path $dir 'nuvem') 'central-planilha.gs'
                if (-not (Test-Path $pg)) { Responder $ctx 404 'script nao encontrado' 'text/plain'; continue }
                $ch = NuvemChave
                Responder $ctx 200 (([System.IO.File]::ReadAllText($pg, $utf8)).Replace('__CHAVE__', [string]$ch.chave)) 'text/plain'
            }
            elseif ($rota -eq '/api/novidades') {
                $pn = Join-Path $dir 'novidades.json'
                if (Test-Path $pn) { Responder $ctx 200 ([System.IO.File]::ReadAllText($pn, $utf8)) 'application/json' } else { Responder $ctx 200 '{"versoes":[],"anteriores":[]}' 'application/json' }
            }
            elseif ($rota -eq '/api/ping') { Responder $ctx 200 '{"app":"central-hubii"}' 'application/json' }
            elseif ($rota -eq '/api/estado') {
                LerComputador
                $agora = Get-Date
                $lista = @()
                foreach ($k in @($fontes.Keys)) {
                    $f = $fontes[$k]; $idade = [int]($agora - $f.t).TotalSeconds
                    if ($idade -gt 3600) { $fontes.Remove($k); continue }
                    $lista += ('{"idade":' + $idade + ',"d":' + $f.json + '}')
                }
                $o = [ordered]@{ app = 'central-hubii'; hora = $agora.ToString('HH:mm:ss'); data = $agora.ToString('dd/MM/yyyy'); pc = $env:COMPUTERNAME; versaoPasta = (VersaoPasta); impressoras = $cache.imp; processos = $cache.proc; nuvem = (NuvemResumo) }
                $j = Json $o
                $j = $j.Substring(0, $j.Length - 1) + ',"fontes":[' + ($lista -join ',') + ']}'
                Responder $ctx 200 $j 'application/json'
            }
            elseif ($rota -match '^/logos/([a-z0-9\-]+\.png)$') {
                $p = Join-Path $dir ('logos\' + $Matches[1])
                if (Test-Path $p) {
                    $b = [System.IO.File]::ReadAllBytes($p)
                    $ctx.Response.ContentType = 'image/png'; $ctx.Response.ContentLength64 = $b.Length
                    $ctx.Response.OutputStream.Write($b, 0, $b.Length); $ctx.Response.OutputStream.Close()
                } else { Responder $ctx 404 'nao encontrado' 'text/plain' }
            }
            else { Responder $ctx 404 'nao encontrado' 'text/plain' }
            continue
        }
        if ($req.HttpMethod -ne 'POST') { Responder $ctx 405 'metodo nao permitido' 'text/plain'; continue }
        # So aceita pedidos da propria pagina do painel e da extensao (cabecalho proprio: outros sites nao conseguem enviar).
        if ($req.Headers['X-Central'] -ne '1') { Responder $ctx 403 'proibido' 'text/plain'; continue }
        if ($rota -eq '/api/atualizar') {
            if ($req.ContentLength64 -gt 100MB) { Responder $ctx 413 'grande demais' 'text/plain'; continue }
            $ms = New-Object System.IO.MemoryStream; $req.InputStream.CopyTo($ms)
            $r = InstalarZip $ms.ToArray() ($req.QueryString['confirmado'] -eq '1')
            Responder $ctx 200 (Json $r) 'application/json'
            if ($reiniciar) { break }
            continue
        }
        $leitor = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $corpo = $leitor.ReadToEnd(); $leitor.Close()
        $limite = 6MB; if ($rota -match '^/api/(backup-ext|restaurar|restaurar-hist)$') { $limite = 80MB }
        if ($corpo.Length -gt $limite) { Responder $ctx 413 'grande demais' 'text/plain'; continue }

        # ---- rotas que recebem arquivos grandes: nao passam pelo leitor de JSON do PowerShell
        if ($rota -eq '/api/backup-ext') {
            $cab = $corpo.Substring(0, [Math]::Min(300, $corpo.Length))
            if (-not ($cab -match '"id":"([a-f0-9]{32})"' )) { Responder $ctx 400 'id invalido' 'text/plain'; continue }; $bid = $Matches[1]
            if (-not ($cab -match '"fonte":"([a-z0-9]{3,20})"')) { Responder $ctx 400 'fonte invalida' 'text/plain'; continue }; $bf = $Matches[1]
            [System.IO.File]::WriteAllText((Join-Path $bkDir "parte-$bid-$bf.json"), $corpo, $utf8)
            Responder $ctx 200 '{"ok":true}' 'application/json'; continue
        }
        if ($rota -eq '/api/restaurar') {
            if (-not $corpo.TrimStart().StartsWith('{')) { Responder $ctx 400 'arquivo invalido' 'text/plain'; continue }
            $rid = [guid]::NewGuid().ToString('N')
            [System.IO.File]::WriteAllText((Join-Path $bkDir "restaurar-$rid.json"), $corpo, $utf8)
            $restResult[$rid] = @{}
            [void](NovaOrdem 'restaurar' $rid 120)
            Responder $ctx 200 (Json @{ ok = $true; id = $rid }) 'application/json'; continue
        }
        if ($rota -eq '/api/restaurar-hist') {
            $boas = @($corpo -split "`n" | Where-Object { $_.StartsWith('{') -and $_.TrimEnd().EndsWith('}') -and $_.Length -lt 20000 -and $_ -match '"id":"\d{5,9}"' } | ForEach-Object { $_.TrimEnd() })
            if ($boas.Count) { [System.IO.File]::AppendAllText($histArq, (($boas -join "`n") + "`n"), $utf8) }
            Responder $ctx 200 (Json @{ ok = $true; n = $boas.Count }) 'application/json'; continue
        }

        $dados = $null; try { $dados = $corpo | ConvertFrom-Json } catch { }

        if ($rota -eq '/api/ext') {
            $id = [string]$dados.fonte
            if (-not ($id -match '^[a-z0-9]{3,20}$')) { Responder $ctx 400 'fonte invalida' 'text/plain'; continue }
            $histOk = $false; $pendOk = $false; $enxugar = $false
            if ($dados.hist -and @($dados.hist).Count) {
                $boas = @(@($dados.hist) | Where-Object { $_ -is [string] -and $_.StartsWith('{') -and $_.EndsWith('}') -and $_.Length -lt 20000 -and $_ -notmatch "[\r\n]" -and $_ -match '"id":"\d{5,9}"' })
                try { if ($boas.Count) { [System.IO.File]::AppendAllText($histArq, (($boas -join "`n") + "`n"), $utf8); $nuvem.suja = $true }; $histOk = $true } catch { $histOk = $false }
                $dados.hist = @(); $enxugar = $true
            }
            if ($dados.pendDados) {
                try { [System.IO.File]::WriteAllText((Join-Path $pendDir "pend-$id.json"), ($dados.pendDados | ConvertTo-Json -Depth 6 -Compress), $utf8); $pendOk = $true } catch { }
                $dados.pendDados = $null; $enxugar = $true
            }
            # o painel nao precisa guardar listas grandes na memoria: tira do corpo antes de guardar o estado do Chrome
            if ($enxugar) { $corpo = ($dados | ConvertTo-Json -Depth 8 -Compress) }
            $fontes[$id] = @{ t = Get-Date; json = $corpo }
            $agora = Get-Date; $entregar = @()
            foreach ($o in @($ordens)) {
                $ttl = 40; if ($o.seg) { $ttl = $o.seg }
                if (($agora - $o.t).TotalSeconds -gt $ttl) { $ordens.Remove($o); continue }
                if (-not $o.entregues.ContainsKey($id)) { $o.entregues[$id] = $true; $entregar += @{ id = $o.id; acao = $o.acao } }
            }
            Responder $ctx 200 (Json @{ ok = $true; histOk = $histOk; pendOk = $pendOk; ordens = @($entregar) }) 'application/json'
        }
        elseif ($rota -eq '/api/restaurar-ok') {
            $rid = [string]$dados.id
            if ($restResult.ContainsKey($rid)) { $restResult[$rid][[string]$dados.fonte] = [int]$dados.n }
            Responder $ctx 200 '{"ok":true}' 'application/json'
        }
        elseif ($rota -eq '/api/acao') {
            $a = [string]$dados.acao
            if ($a -eq 'desligar') { Responder $ctx 200 (Json @{ ok = $true; msg = 'Painel desligado.' }) 'application/json'; $ligado = $false; continue }
            $r = Acao $a ([bool]$dados.confirmado) $dados
            Responder $ctx 200 (Json $r) 'application/json'
            if ($reiniciar) { break }
        }
        else { Responder $ctx 404 'nao encontrado' 'text/plain' }
    } catch {
        Responder $ctx 500 (Json @{ ok = $false; msg = ('Erro no painel: ' + $_.Exception.Message) }) 'application/json'
    }
}
try { $srv.Stop(); $srv.Close() } catch { }
if ($reiniciar) {
    # liga o painel novo (com os arquivos novos) e fecha este
    $exe = (Get-Process -Id $PID).Path
    $argsNovo = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + (Join-Path $dir 'painel-servidor.ps1') + '"'), '-SemJanela', '-Reinicio')
    try { Start-Process -FilePath $exe -WindowStyle Minimized -ArgumentList $argsNovo -ErrorAction Stop } catch { Start-Process -FilePath $exe -ArgumentList $argsNovo }
}
