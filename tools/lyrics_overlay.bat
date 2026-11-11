@echo off
rem Transparent lyrics overlay for the player opened without the server. Tray icon (right-click) for options / quit.
start "" powershell -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0lyrics_overlay.ps1" %*
