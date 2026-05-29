@echo off
REM ============================================================
REM Tres Valles — Servidor local
REM Sirve la carpeta src/ en http://localhost:8000
REM Necesita Python instalado (Microsoft Store o python.org)
REM ============================================================

cd /d "%~dp0src"

echo.
echo ====================================================
echo  TRES VALLES - Servidor local
echo  URL local: http://localhost:8000
echo  (Ctrl+C para detener)
echo ====================================================
echo.

python -m http.server 8000
if errorlevel 1 (
    echo.
    echo [ERROR] No se pudo iniciar Python.
    echo Instala Python desde la Microsoft Store o python.org
    echo y vuelve a ejecutar este archivo.
    pause
)
