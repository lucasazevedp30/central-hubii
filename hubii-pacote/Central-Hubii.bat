@echo off
title Central Hubii
cd /d "%~dp0"
rem A Central agora e o painel (abre numa janela propria). A janela antiga continua em Central-antiga.bat.
start "Central Hubii - painel" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0painel-servidor.ps1"
