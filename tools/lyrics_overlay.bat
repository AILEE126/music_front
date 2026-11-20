@echo off
rem Transparent lyrics overlay for the player opened without the server. Tray icon (right-click) for options / quit.
rem conhost --headless: no console window at all (user 2026-11-20 — with Windows Terminal as the default terminal,
rem -WindowStyle Hidden still left a terminal window in the taskbar)
start "" conhost.exe --headless powershell -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0lyrics_overlay.ps1" %*
