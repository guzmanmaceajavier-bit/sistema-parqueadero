param(
    [string]$DbName = "parqueadero",
    [string]$DbUser = "postgres",
    [string]$BackupDir = ".\backups"
)

$timestamp = Get-Date -Format "yyyyMMdd_HHmm"
if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null }
$filename = "$BackupDir\backup_$timestamp.sql"
& pg_dump -U $DbUser -d $DbName -f $filename 2>&1
if ($LASTEXITCODE -eq 0) { Write-Host "Backup creado: $filename" } else { Write-Host "Error al crear backup" }
