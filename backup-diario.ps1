# Backup diario COMPLETO (las 20 tablas) del Postgres local.
# Uso manual:  powershell -ExecutionPolicy Bypass -File backup-diario.ps1
# Automático:   el instalador lo registra en el Programador de tareas (23:00).
$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $raiz "backend\.env"
$backupDir = "C:\Parqueadero\backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

# Lee DATABASE_URL del backend/.env -> postgresql://usuario:clave@host:puerto/bd
$linea = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $linea) { throw "No se encontró DATABASE_URL en $envFile" }
$url = ($linea -split '=', 2)[1].Trim('"', "'", " ")
if ($url -notmatch '^postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+?)(\?.*)?$') { throw "DATABASE_URL con formato no soportado" }
$usuario, $clave, $dbHost, $puerto, $bd = $Matches[1], $Matches[2], $Matches[3], $Matches[4], $Matches[5]

$env:PGPASSWORD = $clave
$fecha = Get-Date -Format "yyyyMMdd-HHmm"
$destino = Join-Path $backupDir "parqueadero-$fecha.dump"

pg_dump -h $dbHost -p $puerto -U $usuario -d $bd -F c -f $destino
if ($LASTEXITCODE -ne 0) { throw "pg_dump falló (código $LASTEXITCODE)" }

# Conserva 30 días, borra lo anterior
Get-ChildItem $backupDir -Filter "parqueadero-*.dump" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
  Remove-Item -Force

Write-Host "OK backup: $destino" -ForegroundColor Green
Get-ChildItem $backupDir -Filter "parqueadero-*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 5 Name, LastWriteTime, @{n="MB";e={[math]::Round($_.Length/1MB,2)}}
