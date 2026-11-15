@echo off
title Central Hubii - painel
cd /d "%~dp0"
rem Liga o painel (janela minimizada) e abre a janela do painel. Se ja estiver ligado, so abre a janela.
start "Central Hubii - painel" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0painel-servidor.ps1"
