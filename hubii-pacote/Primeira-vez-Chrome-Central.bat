@echo off
title Hubii - PRIMEIRA VEZ DO CHROME DA CENTRAL
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
rem Se o Chrome nao estiver no lugar padrao, procura em outros lugares e, por ultimo, usa o Brave (para testes em casa).
if not exist "%CHROME%" if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" set "CHROME=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not exist "%CHROME%" if exist "%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe" set "CHROME=%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not exist "%CHROME%" if exist "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe" set "CHROME=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"
for %%I in ("%CHROME%") do set "NAVEXE=%%~nxI"
set "RAIZ=%LOCALAPPDATA%\CentralHubiiChrome"
echo.
echo === CHROME DA CENTRAL: CONFIGURACAO DE PRIMEIRA VEZ ===
echo.
echo Vou abrir um Chrome separado, so para a Central (o seu Chrome normal nao e mexido).
echo Faca estas 3 coisas nele, uma unica vez:
echo   1. Na aba do Hubii, entre com seu usuario e senha.
echo   2. Na aba chrome://extensions, ligue o "Modo do desenvolvedor" (canto superior direito),
echo      clique em "Carregar sem compactacao" e escolha a pasta:
echo      %~dp0extensao-central-hubii
echo   3. (Opcional; a Central tenta fazer sozinha) Em chrome://settings/content/popups, em "Permitido enviar pop-ups", adicione https://hub.hubii.co
echo   4. Feche esse Chrome e clique de novo em Descritivos ou Etiquetas.
echo.
pause
start "" "%CHROME%" --user-data-dir="%RAIZ%" --profile-directory=Default --no-first-run --no-default-browser-check --new-window "https://hub.hubii.co/" "chrome://extensions"
