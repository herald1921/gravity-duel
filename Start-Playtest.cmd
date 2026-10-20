@echo off
if not exist "%~dp0Play-Gravity-Duel.html" (
  echo Play-Gravity-Duel.html is missing. Extract the complete offline playtest package.
  pause
  exit /b 1
)
start "" "%~dp0Play-Gravity-Duel.html"
