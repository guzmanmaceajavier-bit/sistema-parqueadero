# Restaura un backup .dump al Postgres local.
# Uso: powershell -ExecutionPolicy Bypass -File restaurar-backup.ps1 [-Archivo "C:\Parqueadero\backups\parqueadero-20260101-2300.dump"]
# Sin -Archivo usa el más reciente. CUIDADO: reemplaza los datos actuales.
param([string]$Archivo = "")
$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $raiz "backend\.env"
$backupDir = "C:\Parqueadero\backups"

if (-not $Archivo) {
  $Archivo = Get-ChildItem $backupDir -Filter "parqueadero-*.dump" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
  if (-not $Archivo) { throw "No hay backups en $backupDir" }
  Write-Host "Usando el más reciente: $Archivo" -ForegroundColor Yellow
}

$linea = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
$url = ($linea -split '=', 2)[1].Trim('"', "'", " ")
if ($url -notmatch '^postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+?)(\?.*)?$') { throw "DATABASE_URL con formato no soportado" }
$usuario, $clave, $dbHost, $puerto, $bd = $Matches[1], $Matches[2], $Matches[3], $Matches[4], $Matches[5]

$conf = Read-Host "Se reemplazarán los datos de '$bd'. Escribe SI para continuar"
if ($conf -ne "SI") { Write-Host "Cancelado."; exit 0 }

$env:PGPASSWORD = $clave
pg_restore -h $dbHost -p $puerto -U $usuario -d $bd --clean --if-exists --no-owner --no-privileges $Archivo
if ($LASTEXITCODE -ne 0) { throw "pg_restore falló (código $LASTEXITCODE)" }
Write-Host "OK restaurado desde $Archivo. Reinicia el backend." -ForegroundColor Green
