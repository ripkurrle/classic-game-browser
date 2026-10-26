<#
.SYNOPSIS
    Launcher script for Kyrandia 2: Hand of Fate - Asset Studio (PowerShell)
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  KYRANDIA 2: HAND OF FATE - ASSET STUDIO & EXTRACTOR" -ForegroundColor Yellow
Write-Host "==============================================================================" -ForegroundColor Cyan

# Check Python
$pythonCmd = Get-Command python3 -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
}

if (-not $pythonCmd) {
    Write-Host "❌ Error: Python 3 was not found in your PATH." -ForegroundColor Red
    Write-Host "   Please install Python from https://www.python.org/downloads/ (check 'Add Python to PATH')"
    Read-Host "Press Enter to exit"
    exit 1
}

$pyExe = $pythonCmd.Source

# Check Pillow
$pilCheck = & $pyExe -c "import PIL" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "📦 Installing required 'Pillow' image library..." -ForegroundColor Green
    & $pyExe -m pip install -q -r requirements.txt
}

Write-Host "🚀 Starting Asset Studio..." -ForegroundColor Green
& $pyExe app.py $args
