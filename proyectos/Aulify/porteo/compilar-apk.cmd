@echo off
cd /d "%~dp0"
node js/configurar-https.cjs
if errorlevel 1 (
    pause
    exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File preparar-sdk.ps1
if errorlevel 1 (
    pause
    exit /b 1
)
node js/compilar-apk.cjs
pause
