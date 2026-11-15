@echo off
title Hubii - ETIQUETAS
set "IMPRESSORA=Argox OS-214 plus series PPLA"
set "PADRAO_LOJA=MP-4200 TH"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
rem Se o Chrome nao estiver no lugar padrao, procura em outros lugares e, por ultimo, usa o Brave (para testes em casa).
if not exist "%CHROME%" if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" set "CHROME=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not exist "%CHROME%" if exist "%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe" set "CHROME=%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not exist "%CHROME%" if exist "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe" set "CHROME=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"
for %%I in ("%CHROME%") do set "NAVEXE=%%~nxI"
set "RAIZ=%LOCALAPPDATA%\CentralHubiiChrome"
set "URL=https://hub.hubii.co/pedidos?central=etiquetas"

echo.
echo === HUBII: ETIQUETAS ===
echo.
if not exist "%CHROME%" (
  echo Chrome nao encontrado em: %CHROME%
  echo Ajuste a linha CHROME no inicio deste arquivo.
  pause
  exit /b 1
)
if not exist "%RAIZ%\Default\Preferences" (
  echo Este e o primeiro uso do Chrome da Central neste computador.
  call "%~dp0Primeira-vez-Chrome-Central.bat"
  exit /b 0
)

echo [1/4] Deixando "%IMPRESSORA%" como impressora padrao...
reg add "HKCU\Software\Microsoft\Windows NT\CurrentVersion\Windows" /v LegacyDefaultPrinterMode /t REG_DWORD /d 1 /f >nul
rundll32 printui.dll,PrintUIEntry /y /n "%IMPRESSORA%"
timeout /t 2 /nobreak >nul
set "PADRAO="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "(Get-CimInstance Win32_Printer | Where-Object Default).Name"`) do set "PADRAO=%%P"
echo     Impressora padrao agora: %PADRAO%
if /i not "%PADRAO%"=="%IMPRESSORA%" (
  echo     ATENCAO: nao consegui trocar a impressora padrao. Nada foi aberto.
  pause
  exit /b 1
)

echo [2/4] Preparando o Chrome da Central (o Chrome normal nao e mexido)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0chrome-central.ps1" -Acao Rodando -Raiz "%RAIZ%"
if not errorlevel 1 (
  echo     O Chrome da Central precisa ser fechado e reaberto para ativar a impressao direta.
  choice /c SN /m "     Fechar o Chrome da Central agora"
  if errorlevel 2 (
    echo Cancelado.
    pause
    exit /b 1
  )
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0chrome-central.ps1" -Acao Fechar -Raiz "%RAIZ%"
)

if not exist "%~dp0ajudante-etiquetas.ps1" (
  echo     Nao encontrei ajudante-etiquetas.ps1 na mesma pasta deste arquivo.
  pause
  exit /b 1
)
echo [3/4] Ligando o ajudante das etiquetas em outra janela...
start "Ajudante de etiquetas" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ajudante-etiquetas.ps1" -ImpressoraPadrao "%PADRAO_LOJA%"

echo     Esquecendo a ultima impressora usada pelo Chrome da Central (ele usa a padrao do Windows)...
if exist "%~dp0limpar-impressora-chrome.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0limpar-impressora-chrome.ps1" -Perfil "Default" -Raiz "%RAIZ%"
) else (
  echo     Aviso: limpar-impressora-chrome.ps1 nao esta na pasta; o Chrome pode usar a ultima impressora lembrada.
)

if exist "%~dp0liberar-popups-central.ps1" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0liberar-popups-central.ps1" -Raiz "%RAIZ%"

echo [4/4] Abrindo o Hubii no Chrome da Central (com as paginas que estavam abertas antes)...
start "" "%CHROME%" --user-data-dir="%RAIZ%" --profile-directory=Default --kiosk-printing --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling --disable-features=CalculateNativeWinOcclusion --no-first-run --no-default-browser-check --restore-last-session --hide-crash-restore-bubble --new-window "%URL%"
echo.
echo Pronto. Use o botao Central Hubii se ele nao comecar sozinho. Quando terminar, FECHE a janela do ajudante: a MP-4200 TH volta a ser a impressora padrao.
timeout /t 10 >nul
