# Esquece a "ultima impressora usada" do Chrome neste perfil, para que ele use a impressora padrao do Windows.
# O Chrome guarda a ultima impressora em Preferences > printing.print_preview_sticky_settings e ela
# passa na frente da impressora padrao. Este script tira so esse trecho (o resto do arquivo fica igual).
# Precisa rodar com o Chrome FECHADO (senao o Chrome reescreve o arquivo ao sair).
# Saida: 0 = ok (ou nada a limpar); 2 = Chrome aberto; 3 = nao achei o perfil; 4 = erro.
param(
    [string]$Perfil = 'Profile 3',
    [string]$Raiz = ''
)
$ErrorActionPreference = 'Stop'
try {
    $soCentral = [bool]$Raiz
    if (-not $Raiz) { $Raiz = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data' }
    if ($soCentral) {
        $abertos = @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='brave.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($Raiz.TrimEnd('\'), [System.StringComparison]::OrdinalIgnoreCase) -ge 0 })
        if ($abertos.Count -gt 0) { Write-Host '    Chrome da Central ainda aberto: nao mexi nas preferencias.'; exit 2 }
    } elseif (Get-Process -Name chrome, brave -ErrorAction SilentlyContinue) { Write-Host '    Chrome ainda aberto: nao mexi nas preferencias.'; exit 2 }
    $arq = Join-Path (Join-Path $Raiz $Perfil) 'Preferences'
    if (-not (Test-Path -LiteralPath $arq)) { Write-Host "    Nao achei o perfil '$Perfil' em: $arq"; exit 3 }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $txt = [System.IO.File]::ReadAllText($arq, $utf8)
    $m = [regex]::Match($txt, '"print_preview_sticky_settings":\{"appState":"((?:[^"\\]|\\.)*)"')
    if (-not $m.Success) { Write-Host '    Chrome nao tinha impressora lembrada: nada a limpar.'; exit 0 }
    $g = $m.Groups[1]
    $interno = [regex]::Unescape($g.Value)
    $obj = $interno | ConvertFrom-Json
    $tinha = @($obj.PSObject.Properties | Where-Object { $_.Name -in 'recentDestinations', 'selectedDestinationId' }).Count
    if ($tinha -eq 0) { Write-Host '    Chrome nao tinha impressora lembrada: nada a limpar.'; exit 0 }
    $antes = ''
    if ($obj.selectedDestinationId) { $antes = [string]$obj.selectedDestinationId }
    [void]$obj.PSObject.Properties.Remove('recentDestinations')
    [void]$obj.PSObject.Properties.Remove('selectedDestinationId')
    $novo = ($obj | ConvertTo-Json -Compress -Depth 20)
    $novoEsc = $novo.Replace('\', '\\').Replace('"', '\"')
    $final = $txt.Substring(0, $g.Index) + $novoEsc + $txt.Substring($g.Index + $g.Length)
    [System.IO.File]::Copy($arq, $arq + '.central-bak', $true)
    [System.IO.File]::WriteAllText($arq, $final, $utf8)
    # confere se ficou valido e sem a impressora lembrada
    $t2 = [System.IO.File]::ReadAllText($arq, $utf8)
    $null = $t2 | ConvertFrom-Json
    if ($t2 -match 'recentDestinations') { throw 'a impressora lembrada continua no arquivo' }
    Write-Host ("    Impressora lembrada pelo Chrome esquecida" + $(if ($antes) { " (era: $antes)" } else { '' }) + '.')
    exit 0
} catch {
    Write-Host ('    Nao consegui limpar a impressora lembrada: ' + $_.Exception.Message)
    exit 4
}
