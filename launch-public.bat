@echo off
REM ============================================================
REM Tres Valles — Lanzador publico (1 click)
REM Abre el servidor local Y el tunel Cloudflare en ventanas
REM separadas. Cierra cualquiera para apagar el sitio.
REM ============================================================

cd /d "%~dp0"

echo.
echo ====================================================
echo  Iniciando servidor + tunel publico...
echo  Veras dos ventanas: una con el servidor local
echo  y otra con la URL publica de Cloudflare.
echo ====================================================
echo.

REM Lanza el servidor local en una ventana nueva
start "Tres Valles - Servidor" cmd /k "%~dp0start-server.bat"

REM Espera 3 segundos para que el servidor arranque antes del tunel
timeout /t 3 /nobreak >nul

REM Lanza el tunel publico en otra ventana
start "Tres Valles - Tunel publico" cmd /k "%~dp0start-tunnel.bat"

echo Listo. Mira la ventana "Tunel publico" para tu URL.
echo Cierra esa ventana o pulsa Ctrl+C en ella para apagar.
timeout /t 5 >nul
