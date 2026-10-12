@echo off
rem ===========================================================================
rem  development.bat - start the Electron dev server (same as `npm run dev`)
rem
rem  This machine has no global node/npm (not on PATH, no C:\Program Files\nodejs),
rem  so every launcher here:
rem    1. uses node from PATH, or falls back to the node bundled with DSH;
rem    2. calls the project-local node_modules\.bin\<tool>.cmd - npm is not needed;
rem    3. clears ELECTRON_RUN_AS_NODE (when set, Electron runs as plain Node and
rem       exits immediately - the usual reason a dev window never appears);
rem    4. clears the Low mandatory integrity label off the Electron tree - see
rem       :fix_integrity. Without that step Electron dies before any window, so
rem       it is the one thing that has to happen before the dev server starts;
rem    5. ends with pause, so a failure stays readable instead of closing the
rem       window at once (that is what happened with the bare `npm run dev`:
rem       "'npm' is not recognized..." flashed by and cmd closed).
rem
rem  After installing node + npm globally, replace the call below with the
rem  matching package.json script, e.g. `call npm run dev`.
rem ===========================================================================
setlocal
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="

call :ensure_node
if errorlevel 1 goto :fail

call :fix_integrity

call "node_modules\.bin\electron-vite.cmd" dev
set "CODE=%ERRORLEVEL%"
goto :report

:fail
set "CODE=1"

:report
echo.
echo [development.bat] exit code %CODE%
pause
endlocal & exit /b %CODE%

:ensure_node
where node >nul 2>nul
if not errorlevel 1 exit /b 0
for /d %%D in ("%USERPROFILE%\.dsh\dsh-runtimes\*") do call :add_node "%%~fD"
where node >nul 2>nul
if errorlevel 1 (
    echo [development.bat] node not found: install Node.js, or add its bin directory to PATH.
    exit /b 1
)
exit /b 0

:add_node
if exist "%~1\dependencies\node\bin\node.exe" set "PATH=%~1\dependencies\node\bin;%PATH%"
exit /b 0

rem ---------------------------------------------------------------------------
rem  Chromium cannot start its sandbox from a directory that carries the Low
rem  mandatory integrity label: the browser process hits STATUS_BREAKPOINT and
rem  cmd reports exit code -2147483645, right after "starting electron app..."
rem  and before any window appears. Nothing in this project is involved - the
rem  same crash comes from `electron.exe --version` with no app code at all.
rem
rem  The label is put there by the DSH workspace sandbox, which labels its
rem  workspace Low (the same SetNamedSecurityInfoW call also writes the S-1-4-*
rem  workspace grant and the Everyone FILE_DELETE_CHILD deny). Every file under
rem  the workspace inherits it, node_modules\electron\dist included. Writing
rem  Medium back to the workspace root propagates over the whole tree in one
rem  call; the sweep of the Electron tree afterwards only covers a state where
rem  that propagation stopped half way.
rem
rem  DSH re-labels the workspace whenever it provisions it again, so this is a
rem  preflight and not a one-off repair. Both icacls calls need an elevated
rem  window; without one they fail silently and Electron crashes exactly as
rem  before, which is why the outcome is echoed instead of assumed.
rem ---------------------------------------------------------------------------
:fix_integrity
icacls "node_modules\electron\dist" 2>nul | findstr /C:"Low Mandatory Level" /C:"S-1-16-4096" >nul
if errorlevel 1 exit /b 0

echo [development.bat] The Electron tree carries the Low integrity label (left
echo [development.bat]   by the DSH workspace sandbox); Chromium cannot start
echo [development.bat]   from it, so Electron would exit with -2147483645.
echo [development.bat] Restoring Medium integrity...

icacls "%CD%" /setintegritylevel "(OI)(CI)M" >nul 2>nul
icacls "node_modules\electron\dist" /setintegritylevel "(OI)(CI)M" /T /C /Q >nul 2>nul

icacls "node_modules\electron\dist" 2>nul | findstr /C:"Low Mandatory Level" /C:"S-1-16-4096" >nul
if errorlevel 1 (
    echo [development.bat] Integrity restored.
) else (
    echo [development.bat] WARNING: still Low - run this from an Administrator window.
)
exit /b 0
