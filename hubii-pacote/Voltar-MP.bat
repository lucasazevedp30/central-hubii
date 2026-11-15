@echo off
title Hubii - VOLTAR A MP-4200 COMO PADRAO
set "IMPRESSORA=MP-4200 TH"
echo.
echo === Deixando "%IMPRESSORA%" como impressora padrao ===
reg add "HKCU\Software\Microsoft\Windows NT\CurrentVersion\Windows" /v LegacyDefaultPrinterMode /t REG_DWORD /d 1 /f >nul
rundll32 printui.dll,PrintUIEntry /y /n "%IMPRESSORA%"
timeout /t 2 /nobreak >nul
set "PADRAO="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "(Get-CimInstance Win32_Printer | Where-Object Default).Name"`) do set "PADRAO=%%P"
echo Impressora padrao agora: %PADRAO%
timeout /t 5 >nul
