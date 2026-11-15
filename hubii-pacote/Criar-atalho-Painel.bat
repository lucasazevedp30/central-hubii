@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=(Get-Location).Path; $w=New-Object -ComObject WScript.Shell; $desk=[Environment]::GetFolderPath('Desktop'); $s=$w.CreateShortcut($desk+'\Painel da Central.lnk'); $s.TargetPath=$d+'\Painel.bat'; $s.WorkingDirectory=$d; $s.IconLocation=$d+'\logos\central.ico'; $s.WindowStyle=7; $s.Description='Painel da Central Hubii'; $s.Save()"
if errorlevel 1 (echo Nao consegui criar o atalho.) else (echo Pronto! Atalho "Painel da Central" criado na Area de Trabalho.)
pause
