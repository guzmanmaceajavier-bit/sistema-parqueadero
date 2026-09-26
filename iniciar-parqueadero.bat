@echo off
REM ParkAdmin - doble clic para abrir el sistema. Tambien arranca solo con Windows.
setlocal
cd /d "%~dp0"

REM Intenta asegurar PostgreSQL (si el servicio es automatico ya viene arriba).
net start postgresql-x64-16 >nul 2>nul

REM Backend (crea/actualiza tablas y auto-crea el admin la primera vez).
start "ParkAdmin Backend" cmd /k "cd /d ""%~dp0backend"" && npm start"

REM Espera a que el backend responda (max ~60 s).
set OK=0
for /L %%i in (1,1,30) do (
  powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:3001/' -TimeoutSec 2 -UseBasicParsing).StatusCode }" >nul 2>nul
  if not errorlevel 1 ( set OK=1 & goto :frontend )
  timeout /t 2 /nobreak >nul
)
echo No se pudo contactar al backend en http://localhost:3001
echo Revisa la ventana "ParkAdmin Backend" y reintenta.
pause
exit /b 1

:frontend
start "ParkAdmin Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run preview -- --port 5173 --host"
timeout /t 5 /nobreak >nul
start http://localhost:5173
