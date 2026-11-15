# Ajudante das etiquetas: aperta Ctrl+P e Ctrl+W quando a janela ativa e a aba da etiqueta.
# A aba da etiqueta tem titulo no formato de um codigo (ex.: 70b6911d-7420-4e30-ba8f-ed540861fba2).
# Cada etiqueta e impressa so uma vez, mesmo se voce trocar de janela. Em qualquer outra janela ele nao faz nada. Para parar: Ctrl+C ou feche esta janela.
param([string]$ImpressoraPadrao = 'MP-4200 TH')
$Host.UI.RawUI.WindowTitle = 'Ajudante de etiquetas'
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Janela {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
}
"@
Add-Type -AssemblyName System.Windows.Forms

$padrao = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
function Titulo {
  $sb = New-Object System.Text.StringBuilder 512
  [void][Janela]::GetWindowText([Janela]::GetForegroundWindow(), $sb, 512)
  $sb.ToString()
}

function VoltarPadrao {
    try { & rundll32 printui.dll,PrintUIEntry /y /n "$ImpressoraPadrao" } catch { }
}
try { Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { & rundll32 printui.dll,PrintUIEntry /y /n 'MP-4200 TH' } | Out-Null } catch { }
Write-Host "Ajudante de etiquetas ligado."
Write-Host "Quando terminar as etiquetas, FECHE esta janela: $ImpressoraPadrao volta a ser a impressora padrao."
Write-Host "(Se nao voltar, use o botao 'Voltar a MP como padrao' da Central.)"
# Cada etiqueta tem um titulo unico (codigo). Guardo os que ja imprimi: a mesma etiqueta NUNCA e impressa duas vezes,
# mesmo que voce troque de janela e volte. O Ctrl+W so e enviado com a aba da etiqueta na frente, e e tentado de novo quando voce volta.
$impressos = @{}
$tentativasFechar = @{}
try {
while ($true) {
  $h1 = [Janela]::GetForegroundWindow()
  $t1 = Titulo
  if ($t1 -match $padrao) {
    $cod = $Matches[0]
    if (-not $impressos.ContainsKey($cod)) {
      # ainda nao imprimiu esta etiqueta: espera a pagina carregar e confere que continua na mesma janela e aba
      Start-Sleep -Milliseconds 2000
      if (([Janela]::GetForegroundWindow() -eq $h1) -and ((Titulo) -match $padrao) -and ($Matches[0] -eq $cod)) {
        $impressos[$cod] = Get-Date          # marca ANTES de enviar: nunca repete, mesmo se algo falhar depois
        [System.Windows.Forms.SendKeys]::SendWait('^p')
        Start-Sleep -Milliseconds 3500
      }
    } else {
      # ja imprimiu: so falta fechar a aba. So envia Ctrl+W se esta mesma aba esta na frente agora.
      $n = 0; if ($tentativasFechar.ContainsKey($cod)) { $n = $tentativasFechar[$cod] }
      if ($n -lt 20 -and (([Janela]::GetForegroundWindow()) -eq $h1) -and ((Titulo) -match $padrao) -and ($Matches[0] -eq $cod)) {
        $tentativasFechar[$cod] = $n + 1
        [System.Windows.Forms.SendKeys]::SendWait('^w')
        Start-Sleep -Milliseconds 2000
      }
    }
  }
  Start-Sleep -Milliseconds 500
}
} finally { VoltarPadrao }
