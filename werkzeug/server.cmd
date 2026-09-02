@echo off
chcp 65001 >nul

rem Der eigentliche Entwicklungsserver. Wird von werkzeug\starten.ps1
rem kleingelegt aufgerufen und laeuft, bis dieses Fenster geschlossen wird.

rem Der Titel steht vor jedem Block und ohne Klammern: In einem Block wuerde
rem eine schliessende Klammer im Titeltext den Block vorzeitig beenden, und der
rem Titel bliebe ungesetzt. Das Fenster hiesse dann "cmd.exe" und waere in der
rem Leiste nicht wiederzufinden.
title Smart Learning – Server

set "NODEPFAD=C:\Program Files\nodejs"
if exist "%NODEPFAD%\node.exe" set "PATH=%NODEPFAD%;%PATH%"

cd /d "%~dp0.."

echo.
echo   Smart Learning laeuft. Dieses Fenster darf kleingelegt bleiben.
echo   Zum Beenden: dieses Fenster schliessen oder Strg+C druecken.
echo.

rem Vite unmittelbar statt ueber npm: npm schreibt den Fenstertitel um. Nebenbei
rem spart der unmittelbare Aufruf einen Prozess und ein paar Zehntel beim Start.
if exist "node_modules\.bin\vite.cmd" goto :vite
echo   Vite fehlt — es wird ueber npm versucht.
call npm run dev
goto :ende

:vite
call "node_modules\.bin\vite.cmd"

:ende
echo.
echo   Der Server ist beendet.
timeout /t 8 >nul
