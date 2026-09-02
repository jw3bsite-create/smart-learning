@echo off
rem Startet den Karteikasten. Die Arbeit macht werkzeug\starten.ps1 — diese
rem Datei gibt es nur, weil Windows eine .ps1 nicht durch einen Doppelklick
rem ausführt. Sie zeigt kein Fenster; Meldungen kommen als Hinweisfenster.
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0werkzeug\starten.ps1"
