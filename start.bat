@echo off

REM Ruta al directorio del proyecto back-end

set RUTA_ACTUAL=%cd%
set RUTA_BACK=%RUTA_ACTUAL%\IoT_Framework
set RUTA_FRONT=%RUTA_ACTUAL%\frontend

REM Comando para iniciar el servidor back-end en un nuevo proceso
echo Iniciando el servidor back-end...
start /d "%RUTA_BACK%" npm run dev

REM Comando para iniciar la aplicación front-end en un nuevo proceso
echo Iniciando la aplicación front-end...
start /d "%RUTA_FRONT%" npm run dev

echo Proyectos iniciados.

REM Espera unos segundos para que los proyectos se inicien completamente
timeout /t 5

REM Abre la dirección local en el navegador con el puerto 5173
start http://localhost:5173