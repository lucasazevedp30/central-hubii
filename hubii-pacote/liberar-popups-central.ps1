# Libera os pop-ups (abas novas) para o Hubii no Chrome DA CENTRAL.
# Sem isso o Chrome bloqueia a aba da etiqueta/descritivo quando o clique e feito pela Central
# (so um clique feito por voce conta como "permitido"). Mexe SO no perfil do Chrome da Central.
# Precisa rodar com o Chrome da Central FECHADO. Saida: 0 = ok; 2 = Chrome da Central aberto; 3 = perfil nao achado; 4 = erro.
param(
    [string]$Raiz = (Join-Path $env:LOCALAPPDATA 'CentralHubiiChrome'),
    [string]$Perfil = 'Default',
    [string]$Chave = 'https://hub.hubii.co:443,*'
)
$ErrorActionPreference = 'Stop'
try {
    $abertos = @()
    try { $abertos = @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='brave.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($Raiz.TrimEnd('\'), [System.StringComparison]::OrdinalIgnoreCase) -ge 0 }) } catch { }
    if ($abertos.Count -gt 0) { Write-Host '    Chrome da Central ainda aberto: nao mexi nos pop-ups.'; exit 2 }
    $arq = Join-Path (Join-Path $Raiz $Perfil) 'Preferences'
    if (-not (Test-Path -LiteralPath $arq)) { Write-Host "    Nao achei o perfil em: $arq"; exit 3 }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $txt = [System.IO.File]::ReadAllText($arq, $utf8)
    $obj = $txt | ConvertFrom-Json
    function Garantir($pai, $nome) {
        if (-not ($pai.PSObject.Properties.Name -contains $nome)) { $pai | Add-Member -NotePropertyName $nome -NotePropertyValue ([pscustomobject]@{}) }
        return $pai.$nome
    }
    $p = Garantir $obj 'profile'
    $cs = Garantir $p 'content_settings'
    $ex = Garantir $cs 'exceptions'
    $po = Garantir $ex 'popups'
    $valor = [pscustomobject]@{ last_modified = '13370000000000000'; setting = 1 }
    if ($po.PSObject.Properties.Name -contains $Chave) {
        if ($po.$Chave.setting -eq 1) { Write-Host '    Pop-ups ja estavam liberados para o Hubii.'; exit 0 }
        $po.$Chave = $valor
    } else {
        $po | Add-Member -NotePropertyName $Chave -NotePropertyValue $valor
    }
    $novo = $obj | ConvertTo-Json -Compress -Depth 100
    $null = $novo | ConvertFrom-Json
    [System.IO.File]::Copy($arq, $arq + '.central-bak2', $true)
    [System.IO.File]::WriteAllText($arq, $novo, $utf8)
    Write-Host '    Pop-ups liberados para o Hubii no Chrome da Central.'
    exit 0
} catch {
    Write-Host ('    Nao consegui liberar os pop-ups automaticamente: ' + $_.Exception.Message)
    Write-Host '    Faca uma vez a mao: no Chrome da Central abra chrome://settings/content/popups e, em "Permitido enviar pop-ups", adicione https://hub.hubii.co'
    exit 4
}
