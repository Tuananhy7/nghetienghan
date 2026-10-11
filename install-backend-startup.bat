@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\backend.ps1" -Action InstallStartup
if errorlevel 1 pause
