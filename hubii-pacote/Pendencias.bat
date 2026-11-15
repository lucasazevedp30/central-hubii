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
set "PERFIL=Profile 3"
set "URL=https://hub.hubii.co/pedidos"
echo.
echo === HUBII: PENDENCIAS (modo segundo plano) ===
echo.
if not exist "%CHROME%" (
  echo Chrome nao encontrado em: %CHROME%
  echo Ajuste a linha CHROME no inicio deste arquivo.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0navegador-normal.ps1" -Acao Estado
if errorlevel 3 (
  echo O navegador normal esta aberto no modo comum. Para rodar em segundo plano ele precisa ser fechado e reaberto.
  echo So o navegador normal e fechado; o da Central nao e mexido.
  choice /c SN /m "Fechar e reabrir agora (N = abrir sem fechar e deixar a janela a vista)"
  if not errorlevel 2 powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0navegador-normal.ps1" -Acao Fechar
)
start "" "%CHROME%" --profile-directory="%PERFIL%" --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion --new-window "%URL%"
timeout /t 3 /nobreak >nul
start "" "%CHROME%" --profile-directory="%PERFIL%" --new-window "https://onehub.onepet.com.br/onehub"
echo.
echo Pronto. Este Chrome agora roda os favoritos em segundo plano (Coletar, Verificar e Consultar OneHub).
echo Foram abertas DUAS JANELAS (Hubii e OneHub). Abra o OnePet em uma terceira janela.
echo IMPORTANTE: use uma JANELA para cada site. Pode deixar uma janela atras da outra,
echo mas nao minimize e nao troque de aba dentro da janela enquanto o script roda.
timeout /t 10 >nul
