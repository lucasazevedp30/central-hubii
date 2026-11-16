@echo off
title Hubii - PENDENCIAS (segundo plano)
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
rem Se o Chrome nao estiver no lugar padrao, procura em outros lugares e, por ultimo, usa o Brave (para testes em casa).
if not exist "%CHROME%" if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" set "CHROME=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not exist "%CHROME%" if exist "%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe" set "CHROME=%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not exist "%CHROME%" if exist "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe" set "CHROME=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"
for %%I in ("%CHROME%") do set "NAVEXE=%%~nxI"
set "RAIZ=%LOCALAPPDATA%\CentralHubiiChrome"
set "URL=https://hub.hubii.co/pedidos"
echo.
echo === HUBII: PENDENCIAS (no Chrome da Central) ===
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
rem Abre no Chrome da Central (ja roda em segundo plano). O Chrome do pessoal nao e mexido.
set "OPC=--user-data-dir="%RAIZ%" --profile-directory=Default --kiosk-printing --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling --disable-features=CalculateNativeWinOcclusion --no-first-run --no-default-browser-check --hide-crash-restore-bubble"
start "" "%CHROME%" %OPC% --new-window "%URL%"
timeout /t 3 /nobreak >nul
start "" "%CHROME%" %OPC% --new-window "https://onehub.onepet.com.br/onehub"
echo.
echo Pronto. Foram abertas DUAS JANELAS no Chrome da Central (Hubii e OneHub).
echo Se pedir login, entre uma vez: o Chrome da Central lembra.
echo Use uma JANELA para cada site. Pode deixar uma janela atras da outra,
echo mas nao minimize e nao troque de aba dentro da janela enquanto a rotina roda.
timeout /t 10 >nul
