@echo off
rem ===========================================================================
rem  build.bat - typecheck + bundle (same as `npm run build`)
rem
rem  This machine has no global node/npm (not on PATH, no C:\Program Files\nodejs),
rem  so every launcher here:
rem    1. uses node from PATH, or falls back to the node bundled with DSH;
rem    2. calls the project-local node_modules\.bin\<tool>.cmd - npm is not needed;
rem    3. clears ELECTRON_RUN_AS_NODE (when set, Electron runs as plain Node and
rem       exits immediately - the usual reason a dev window never appears);
rem    4. ends with pause, so a failure stays readable instead of closing the
rem       window at once (that is what happened with the bare `npm run dev`:
rem       "'npm' is not recognized..." flashed by and cmd closed).
rem
rem  After installing node + npm globally, replace the call below with the
rem  matching package.json script, e.g. `call npm run build`.
rem ===========================================================================
setlocal
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="

call :ensure_node
if errorlevel 1 goto :fail

echo [build.bat] 1/3 typecheck main + data layers (tsc)
call "node_modules\.bin\tsc.cmd" --noEmit -p tsconfig.node.json --composite false
if errorlevel 1 goto :fail

echo [build.bat] 2/3 typecheck renderer (vue-tsc)
call "node_modules\.bin\vue-tsc.cmd" --noEmit -p tsconfig.web.json --composite false
if errorlevel 1 goto :fail

echo [build.bat] 3/3 bundle (electron-vite build)
call "node_modules\.bin\electron-vite.cmd" build
set "CODE=%ERRORLEVEL%"
goto :report

:fail
set "CODE=1"

:report
echo.
echo [build.bat] exit code %CODE%
pause
endlocal & exit /b %CODE%

:ensure_node
where node >nul 2>nul
if not errorlevel 1 exit /b 0
for /d %%D in ("%USERPROFILE%\.dsh\dsh-runtimes\*") do call :add_node "%%~fD"
where node >nul 2>nul
if errorlevel 1 (
    echo [build.bat] node not found: install Node.js, or add its bin directory to PATH.
    exit /b 1
)
exit /b 0

:add_node
if exist "%~1\dependencies\node\bin\node.exe" set "PATH=%~1\dependencies\node\bin;%PATH%"
exit /b 0
