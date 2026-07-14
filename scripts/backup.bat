@echo off
set timestamp=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%
set timestamp=%timestamp: =0%
set BACKUP_DIR=.\backups
if not exist %BACKUP_DIR% mkdir %BACKUP_DIR%
pg_dump -U postgres -d parqueadero > "%BACKUP_DIR%\backup_%timestamp%.sql" 2>&1
if %errorlevel% equ 0 (
    echo Backup creado: backup_%timestamp%.sql
) else (
    echo Error al crear backup
)
