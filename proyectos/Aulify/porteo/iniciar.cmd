@echo off
cd /d "%~dp0"
node js/configurar-https.cjs
if errorlevel 1 (
    pause
    exit /b 1
)
node js/servidor-https.cjs
pause
