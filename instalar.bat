@echo off
REM Instalador ParkAdmin - ejecutar UNA vez en el PC del cliente (como Administrador).
setlocal
cd /d "%~dp0"

echo [1/6] Verificando Node.js y PostgreSQL...
where node >nul 2>nul || (echo FALTA Node.js 20. Instalalo y reintenta. & pause & exit /b 1)
where psql >nul 2>nul || (echo FALTA PostgreSQL 16 (psql no esta en el PATH). & pause & exit /b 1)

echo [2/6] Instalando dependencias...
cd backend && call npm install || (echo Fallo npm install del backend. & pause & exit /b 1)
cd ..\frontend && call npm install || (echo Fallo npm install del frontend. & pause & exit /b 1)

echo [3/6] Compilando frontend...
call npm run build || (echo Fallo el build del frontend. & pause & exit /b 1)
cd ..

echo [4/6] Revisando backend\.env ...
if not exist "backend\.env" (
  echo   No existe backend\.env - copiando ejemplo. EDITA las claves antes de usar.
  copy "backend\.env.example" "backend\.env" >nul
)
node -e "const fs=require('fs');let s=fs.readFileSync('backend\\.env','utf8');if(s.includes('generate_with_node')){const k=require('crypto').randomBytes(32).toString('hex');s=s.replace('generate_with_node_e_console_log_require_crypto_random_bytes_32_toString_hex',k);fs.writeFileSync('backend\\.env',s);console.log('  JWT_SECRET generado.');}else{console.log('  JWT_SECRET ya definido.');}"

echo [5/6] Creando tablas en la base de datos...
cd backend && call npx prisma db push || (echo Fallo prisma db push. Revisa DATABASE_URL en backend\.env. & pause & exit /b 1)
cd ..

echo [6/6] Programando backup diario 23:00 y acceso directo de inicio...
mkdir "C:\Parqueadero\backups" 2>nul
schtasks /create /tn "ParkAdminBackup" /tr "powershell -ExecutionPolicy Bypass -File \"%~dp0backup-diario.ps1\"" /sc daily /st 23:00 /f >nul 2>nul
if errorlevel 1 echo   AVISO: no se pudo crear la tarea programada (ejecuta como Administrador y reintenta este paso).
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
copy "%~dp0iniciar-parqueadero.bat" "%STARTUP%\" >nul 2>nul
if errorlevel 1 echo   AVISO: no se pudo copiar al inicio de Windows.

echo.
echo INSTALACION OK. Abre el sistema con: iniciar-parqueadero.bat
echo La primera vez entra con usuario admin y la clave ADMIN_PASSWORD de backend\.env
pause
