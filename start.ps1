# ADVENT TREPORTS - Launcher
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host ""
Write-Host "--- ADVENT TREPORTS ---" -ForegroundColor Cyan
Write-Host "Tally ERP Dashboard" -ForegroundColor Cyan
Write-Host ""

# Start Backend
Write-Host "[1/2] Starting Python Backend..." -ForegroundColor Yellow
$backendCmd = "cd '$Root\backend'; python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

Start-Sleep -Seconds 3

# Start Frontend
Write-Host "[2/2] Starting React Frontend..." -ForegroundColor Yellow
$frontendCmd = "cd '$Root\frontend'; npm run dev -- --host"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Start-Sleep -Seconds 3

# Open browser
Write-Host ""
Write-Host "[OK] Opening dashboard..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Login:    admin / admin" -ForegroundColor Yellow
Write-Host ""
Write-Host "Close both PowerShell windows to stop." -ForegroundColor DarkGray
