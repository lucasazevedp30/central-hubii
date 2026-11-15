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
# So baixa; quem instala e o mesmo InstalarZip do botao "Instalar de um arquivo .zip" (mesmas conferencias).
$repoOnline = ''
try { $repoOnline = ([System.IO.File]::ReadAllText((Join-Path $dir 'atualizacao-online.txt'), $utf8)).Trim() } catch { }
if ($repoOnline -notmatch '^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$') { $repoOnline = '' }
$online = @{ t = [datetime]::MinValue; r = $null }
function Web($url, $arquivo) {
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
    $p = @{ Uri = $url; UseBasicParsing = $true; TimeoutSec = 20; Headers = @{ 'User-Agent' = 'central-hubii'; 'Accept' = 'application/vnd.github+json' } }
    if ($arquivo) { $p.TimeoutSec = 180; $p.OutFile = $arquivo; Invoke-WebRequest @p | Out-Null; return }
    return (Invoke-RestMethod @p)
}
function BuscarOnline([bool]$forcar) {
    if (-not $repoOnline) { return @{ ok = $false; desligado = $true; msg = 'A atualização pela internet ainda não está ligada nesta versão.' } }
    if (-not $forcar -and $online.r -and ((Get-Date) - $online.t).TotalMinutes -lt 30) { return $online.r }
    $atual = LerVersao $dir
    try { $rel = Web "https://api.github.com/repos/$repoOnline/releases/latest" $null }
    catch {
        $cod = 0; try { $cod = [int]$_.Exception.Response.StatusCode } catch { }
        if ($cod -eq 404) { $r = @{ ok = $false; msg = 'Ainda não há nenhuma versão publicada na internet.' } }
        else { $r = @{ ok = $false; msg = 'Não consegui falar com o GitHub (sem internet ou bloqueado nesta rede). Detalhe: ' + $_.Exception.Message } }
        $online.t = Get-Date; $online.r = $r; return $r
    }
    $nova = $null; try { $nova = [version](([string]$rel.tag_name) -replace '^[vV]', '') } catch { }
    $zipA = @($rel.assets) | Where-Object { $_.name -match '^hubii-central-[\d.]+\.zip$' } | Select-Object -First 1
    $shaA = $null; if ($zipA) { $shaA = @($rel.assets) | Where-Object { $_.name -eq ($zipA.name + '.sha256') } | Select-Object -First 1 }
    if (-not $nova -or -not $zipA) { $r = @{ ok = $false; msg = 'A versão publicada na internet está incompleta (sem o pacote). Avise o Claude.' } }
    else {
        $txt = [string]$rel.body; if ($txt.Length -gt 3000) { $txt = $txt.Substring(0, 3000) + '...' }
        $data = ''; try { $data = ([datetime]$rel.published_at).ToLocalTime().ToString('dd/MM/yyyy HH:mm') } catch { }
        $sha = ''; if ([string]$zipA.digest -match '^sha256:([a-f0-9]{64})$') { $sha = $Matches[1] }
        $r = @{ ok = $true; atual = "$atual"; nova = "$nova"; temNova = [bool]($atual -and $nova -gt $atual); novidades = $txt; data = $data; tamanho = [int64]$zipA.size; url = [string]$zipA.browser_download_url; sha = $sha; shaUrl = $(if ($shaA) { [string]$shaA.browser_download_url } else { '' }) }
    }
    $online.t = Get-Date; $online.r = $r; return $r
}
function InstalarOnline([bool]$confirmado) {
    if (RotinaRodando) { return @{ ok = $false; msg = 'Tem uma rotina rodando (descritivos, etiquetas, baixa ou o ajudante de etiquetas). Espere terminar, feche o ajudante e tente de novo.' } }
    $info = BuscarOnline $true
    if (-not $info.ok) { return $info }
    if (-not $info.temNova -and -not $confirmado) { return @{ ok = $false; confirmar = "A versão da internet ($($info.nova)) é a mesma que já está instalada. Instalar de novo mesmo assim?" } }
    if ($info.url -notmatch '^https://(github\.com|objects\.githubusercontent\.com)/') { return @{ ok = $false; msg = 'Endereço do pacote estranho; não baixei nada.' } }
    $arq = Join-Path $atuDir 'baixado.zip'
    try { [void](Web $info.url $arq) } catch { return @{ ok = $false; msg = 'Não consegui baixar o pacote. Nada mudou. Detalhe: ' + $_.Exception.Message } }
    $bytes = [System.IO.File]::ReadAllBytes($arq); Remove-Item $arq -Force -ErrorAction SilentlyContinue
    # confere a "impressao digital" (SHA-256) do pacote: se o arquivo chegou corrompido ou trocado, nao instala
    $esperado = $info.sha
    if (-not $esperado -and $info.shaUrl) {
        $s = Join-Path $atuDir 'baixado.sha256'
        try { [void](Web $info.shaUrl $s); $t = [System.IO.File]::ReadAllText($s); if ($t -match '([a-fA-F0-9]{64})') { $esperado = $Matches[1].ToLower() } } catch { }
        Remove-Item $s -Force -ErrorAction SilentlyContinue
    }
    if (-not $esperado) { return @{ ok = $false; msg = 'O pacote da internet veio sem a conferência (SHA-256). Por segurança não instalei. Nada mudou.' } }
    $h = [System.Security.Cryptography.SHA256]::Create()
    $calc = ([System.BitConverter]::ToString($h.ComputeHash($bytes)) -replace '-', '').ToLower()
    if ($calc -ne $esperado) { return @{ ok = $false; msg = 'O pacote baixado não confere (pode ter chegado corrompido). Não instalei; nada mudou. Tente de novo mais tarde.' } }
    return (InstalarZip $bytes $true)
}
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
function ChromeSegundoPlano($url, [bool]$confirmado, [bool]$semFechar) {
    if (-not (Test-Path $chrome)) { return @{ ok = $false; msg = 'Navegador nao encontrado (nem Chrome nem Brave).' } }
    $nome = if ($chrome -like '*brave*') { 'Brave' } else { 'Chrome' }
    $flags = @("--profile-directory=`"$perfil`"", '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion', '--new-window', $url)
    $aux = Join-Path $dir 'navegador-normal.ps1'
    & $aux -Acao Estado; $estado = $LASTEXITCODE
    if ($estado -eq 3 -and -not $semFechar) {
        if (-not $confirmado) { return @{ ok = $false; alternativa = $true; confirmar = "O $nome normal esta aberto no modo comum. Para a rotina continuar mesmo com a janela coberta ou minimizada, ele precisa ser fechado e reaberto (so o $nome normal; o da Central nao e mexido). Fechar e reabrir agora?" } }
        & $aux -Acao Fechar
    }
    Start-Process -FilePath $chrome -ArgumentList $flags
    if ($estado -eq 3 -and $semFechar) { return @{ ok = $true; msg = "Abrindo no $nome que ja estava aberto. Deixe a janela a vista enquanto a rotina roda." } }
    return @{ ok = $true; msg = "Abrindo o OnePet no $nome..." }
}

function Acao($a, [bool]$confirmado, $dados) {
    switch ($a) {
        'descritivos' { return (Rodar 'Descritivos.bat') }
        'etiquetas'   { return (Rodar 'Etiquetas.bat') }
        'reimprimir'  { return (Rodar 'Reimprimir-Descritivos.bat') }
        'voltarmp'    { $cache.t = [datetime]::MinValue; return (Rodar 'Voltar-MP.bat') }
        'centralantiga' { return (Rodar 'Central-antiga.bat') }
        'verificar'   { return (Rodar 'Pendencias.bat') }
        'coletar'     { return (ChromeSegundoPlano ($urlPendencias + '&central=coletar') $confirmado ([bool]$dados.semFechar)) }
        'baixa'       { return (ChromeSegundoPlano $urlPendencias $confirmado ([bool]$dados.semFechar)) }
        'extensoes'   { if (Test-Path $chrome) { Start-Process -FilePath $chrome -ArgumentList @("--profile-directory=`"$perfil`"", '--new-window', 'chrome://extensions') }; return @{ ok = $true; msg = 'Abrindo as extensoes do Chrome...' } }
        'abrirpedido' {
            $id = [string]$dados.id
            if (-not ($id -match '^\d{5,9}$')) { return @{ ok = $false; msg = 'Numero de pedido invalido.' } }
            if (-not (Test-Path $chrome)) { return @{ ok = $false; msg = 'Chrome nao encontrado.' } }
            Start-Process -FilePath $chrome -ArgumentList @("--profile-directory=`"$perfil`"", "https://hub.hubii.co/pedidos?search=$id")
            return @{ ok = $true; msg = "Abrindo o pedido $id no Hubii (Chrome)..." }
        }
        'voltarversao' { return (VoltarVersao $confirmado) }
        'instalaronline' { return (InstalarOnline $confirmado) }
        'backup'      { $id = NovaOrdem 'backup' $null 90; return @{ ok = $true; id = $id; msg = 'Pedindo os dados a cada Chrome com a extensao...' } }
        'parar'       { [void]$ordens.Add(@{ id = [guid]::NewGuid().ToString('N'); acao = 'parar'; t = Get-Date; entregues = @{} }); return @{ ok = $true; msg = 'Pedido de parada enviado. A rotina termina o pedido atual e para.' } }
        default       { return @{ ok = $false; msg = 'Acao desconhecida.' } }
    }
}

# ---------- atender os pedidos da pagina e da extensao
$ligado = $true
while ($ligado -and $srv.IsListening) {
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
                $o = [ordered]@{ app = 'central-hubii'; hora = $agora.ToString('HH:mm:ss'); data = $agora.ToString('dd/MM/yyyy'); pc = $env:COMPUTERNAME; versaoPasta = (VersaoPasta); impressoras = $cache.imp; processos = $cache.proc }
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
                try { if ($boas.Count) { [System.IO.File]::AppendAllText($histArq, (($boas -join "`n") + "`n"), $utf8) }; $histOk = $true } catch { $histOk = $false }
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
