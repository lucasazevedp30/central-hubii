@echo off
title Central Hubii (antiga)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0central-hubii.ps1"
if errorlevel 1 (
  echo.
  echo A Central nao abriu. Se apareceu um erro acima, envie uma foto dele (ou o arquivo central-erro.txt).
  pause
)
