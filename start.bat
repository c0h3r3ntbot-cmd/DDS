@echo off
REM Launch FastAPI backend + Next.js frontend in one terminal.
REM Ctrl+C cleanly stops both servers.

setlocal EnableExtensions
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Continue';" ^
  "$root = (Resolve-Path -LiteralPath '%~dp0').Path;" ^
  "$backendDir = Join-Path $root 'backend';" ^
  "$frontendDir = Join-Path $root 'frontend';" ^
  "$venvPython = Join-Path $root '.venv\Scripts\python.exe';" ^
  "$python = if (Test-Path $venvPython) { $venvPython } else { 'python' };" ^
  "$backend = $null; $frontend = $null;" ^
  "function Stop-Tree([System.Diagnostics.Process]$proc) {" ^
  "  if ($null -eq $proc) { return }" ^
  "  try {" ^
  "    if (-not $proc.HasExited) {" ^
  "      & taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null" ^
  "    }" ^
  "  } catch {}" ^
  "}" ^
  "try {" ^
  "  Write-Host 'Starting backend  → http://127.0.0.1:8000';" ^
  "  $backend = Start-Process -FilePath $python -ArgumentList @('-m','uvicorn','main:app','--reload','--host','127.0.0.1','--port','8000') -WorkingDirectory $backendDir -NoNewWindow -PassThru;" ^
  "  Write-Host 'Starting frontend → http://127.0.0.1:3000';" ^
  "  $frontend = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','dev','--','-p','3000') -WorkingDirectory $frontendDir -NoNewWindow -PassThru;" ^
  "  Write-Host '';" ^
  "  Write-Host 'Both servers are running in this terminal. Press Ctrl+C to stop.';" ^
  "  Write-Host '';" ^
  "  while ($true) {" ^
  "    Start-Sleep -Seconds 1;" ^
  "    if ($backend.HasExited -or $frontend.HasExited) { break }" ^
  "  }" ^
  "} finally {" ^
  "  Write-Host '';" ^
  "  Write-Host 'Stopping servers...';" ^
  "  Stop-Tree $frontend;" ^
  "  Stop-Tree $backend;" ^
  "  Write-Host 'Stopped.';" ^
  "}"

endlocal
