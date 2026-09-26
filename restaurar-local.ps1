# Restaura el respaldo de Render a tu Postgres local (ya instalado y corriendo)
# Uso: .\restaurar-local.ps1 -Archivo ".\backups\render-20250926-1200.dump"
param([string]$Archivo = "")

if (-not $Archivo) {
  $candidatos = Get-ChildItem .\backups\* -Include *.dump,*.sql -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
  if (-not $candidatos) { Write-Error "No hay archivos en .\backups\. Corre primero .\respaldo-render.ps1"; exit 1 }
  $Archivo = $candidatos[0].FullName
  Write-Host "Usando el más reciente: $Archivo" -ForegroundColor Yellow
}

$env:PGPASSWORD = "230624"
Write-Host "Restaurando $Archivo -> postgresql://postgres@localhost:5432/parqueadero_db" -ForegroundColor Cyan

if ($Archivo -like "*.dump") {
  # Limpia y restaura (la DB ya existe local con tus 20 tablas)
  pg_restore -h localhost -U postgres -d parqueadero_db --clean --if-exists --no-owner --no-privileges $Archivo
} else {
  psql -h localhost -U postgres -d parqueadero_db -f $Archivo
}
if ($LASTEXITCODE -ne 0) { Write-Error "Falló la restauración"; exit 1 }

Write-Host "OK. Verifica:" -ForegroundColor Green
psql -h localhost -U postgres -d parqueadero_db -c "\dt"
Write-Host 'Luego arranca: cd backend; npm run dev  (puerto 3001)  +  cd frontend; npm run dev (puerto 5173)' -ForegroundColor Green
