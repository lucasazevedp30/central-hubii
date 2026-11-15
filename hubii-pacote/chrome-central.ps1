# Controla SO o Chrome da Central (o que foi aberto com --user-data-dir apontando para a pasta da Central).
# O Chrome normal (de todo mundo) nunca e tocado.
# -Acao Rodando : sai com 0 se o Chrome da Central esta aberto, 1 se nao
# -Acao Fechar  : fecha o Chrome da Central (primeiro com educacao, depois a forca)
param(
    [Parameter(Mandatory = $true)][ValidateSet('Rodando', 'Fechar')][string]$Acao,
    [string]$Raiz = (Join-Path $env:LOCALAPPDATA 'CentralHubiiChrome')
)
$ErrorActionPreference = 'SilentlyContinue'
function ProcessosDaCentral {
    $chave = $Raiz.TrimEnd('\')
    @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='brave.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($chave, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 })
}
if ($Acao -eq 'Rodando') {
    if ((ProcessosDaCentral).Count -gt 0) { exit 0 } else { exit 1 }
}
$lista = ProcessosDaCentral
if ($lista.Count -eq 0) { exit 0 }
foreach ($p in $lista) {
    try { $g = Get-Process -Id $p.ProcessId; if ($g.MainWindowHandle -ne 0) { [void]$g.CloseMainWindow() } } catch { }
}
for ($i = 0; $i -lt 12; $i++) { Start-Sleep -Milliseconds 500; if ((ProcessosDaCentral).Count -eq 0) { exit 0 } }
foreach ($p in (ProcessosDaCentral)) { try { Stop-Process -Id $p.ProcessId -Force } catch { } }
Start-Sleep -Seconds 2
if ((ProcessosDaCentral).Count -eq 0) { exit 0 } else { exit 1 }
