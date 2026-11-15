# Controla SO o navegador normal (Chrome ou Brave do dia a dia). O navegador da Central
# (aberto com --user-data-dir apontando para CentralHubiiChrome) nunca e tocado.
# -Acao Estado : sai com 0 = fechado; 2 = aberto e ja no modo segundo plano (nao precisa fechar); 3 = aberto no modo comum
# -Acao Fechar : fecha so o navegador normal (primeiro com educacao, depois a forca)
param([Parameter(Mandatory = $true)][ValidateSet('Estado', 'Fechar')][string]$Acao)
$ErrorActionPreference = 'SilentlyContinue'
function Normais { @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='brave.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -notlike '*CentralHubiiChrome*' }) }
$lista = Normais
if ($Acao -eq 'Estado') {
    if (-not $lista.Count) { exit 0 }
    $principal = @($lista | Where-Object { $_.CommandLine -notlike '*--type=*' })
    if ($principal.Count -and @($principal | Where-Object { $_.CommandLine -notlike '*--disable-background-timer-throttling*' }).Count -eq 0) { exit 2 }
    exit 3
}
foreach ($p in $lista) { try { $g = Get-Process -Id $p.ProcessId; if ($g.MainWindowHandle -ne 0) { [void]$g.CloseMainWindow() } } catch { } }
for ($i = 0; $i -lt 10 -and (Normais).Count; $i++) { Start-Sleep -Milliseconds 500 }
Normais | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 2
exit 0
