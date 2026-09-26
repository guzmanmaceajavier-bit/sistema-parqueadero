# Respaldo URGENTE de Render antes del 2 de octubre
# Uso: .\respaldo-render.ps1 -DatabaseUrl "postgresql://admin:xxx@xxx.render.com/parqueadero_db"
param([string]$DatabaseUrl = $env:DATABASE_URL_RENDER)

if (-not $DatabaseUrl) {
  Write-Host "Pega tu DATABASE_URL de Render (dashboard Render -> parqueadero-db -> Connections -> External Database URL):" -ForegroundColor Yellow
  $DatabaseUrl = Read-Host "DATABASE_URL_RENDER"
}
if (-not $DatabaseUrl) { Write-Error "Falta DATABASE_URL"; exit 1 }

$fecha = Get-Date -Format "yyyyMMdd-HHmm"
New-Item -ItemType Directory -Force -Path ".\backups" | Out-Null
$dump = ".\backups\render-$fecha.dump"
$sql  = ".\backups\render-$fecha.sql"

Write-Host "1/2 Respaldando en formato custom: $dump" -ForegroundColor Cyan
$env:PGPASSWORD = $null
# Usa postgres:16 aunque no tengas Docker: psql/pg_dump ya están instalados (tienes PG 16.14)
pg_dump $DatabaseUrl -F c -f $dump
if ($LASTEXITCODE -ne 0) { Write-Error "Falló pg_dump custom, prueba formato plano"; exit 1 }

Write-Host "2/2 Respaldando en formato SQL plano: $sql" -ForegroundColor Cyan
pg_dump $DatabaseUrl -F p -f $sql

Get-ChildItem .\backups\
Write-Host "OK. Guarda .\backups\ en lugar seguro. Luego corre .\restaurar-local.ps1" -ForegroundColor Green
