@echo off
REM ============================================================
REM Tres Valles — Tunel publico (Cloudflare)
REM Expone http://localhost:8000 en una URL publica con HTTPS
REM Necesita cloudflared.exe en esta carpeta o en el PATH
REM Descarga: https://github.com/cloudflare/cloudflared/releases/latest
REM           (busca: cloudflared-windows-amd64.exe — renombrar a cloudflared.exe)
REM ============================================================

cd /d "%~dp0"

echo.
echo ====================================================
echo  TRES VALLES - Tunel publico Cloudflare
echo  Cloudflared imprimira una URL https://*.trycloudflare.com
echo  Comparte esa URL para que cualquiera entre desde fuera
echo  (Ctrl+C para cerrar el tunel)
echo ====================================================
echo.

REM Busca cloudflared en la carpeta actual o en el PATH
where cloudflared >nul 2>&1
if errorlevel 1 (
    if exist "%~dp0cloudflared.exe" (
        "%~dp0cloudflared.exe" tunnel --protocol http2 --edge 198.41.192.107:7844 --edge 198.41.192.37:7844 --edge 198.41.192.27:7844 --edge 198.41.200.233:7844 --url http://localhost:8000
    ) else (
        echo [ERROR] No se encontro cloudflared.exe
        echo.
        echo 1. Descarga el binario:
        echo    https://github.com/cloudflare/cloudflared/releases/latest
        echo    (archivo: cloudflared-windows-amd64.exe)
        echo 2. Renombralo a cloudflared.exe
        echo 3. Colocalo en esta misma carpeta:
        echo    %~dp0
        echo 4. Vuelve a ejecutar este .bat
        pause
        exit /b 1
    )
) else (
    cloudflared tunnel --protocol http2 --edge 198.41.192.107:7844 --edge 198.41.192.37:7844 --edge 198.41.192.27:7844 --edge 198.41.200.233:7844 --url http://localhost:8000
)
