# Tazq Development Environment Manager
# This script ensures the local dev environment is synced with the latest SDK and fix common issues.

function Show-Header {
    Clear-Host
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "   🚀 TAZQ SMART SETUP & DEV MANAGER   " -ForegroundColor Yellow -Bold
    Write-Host "==========================================" -ForegroundColor Cyan
}

function Run-Step($Message, $Command) {
    Write-Host "`n[+] $Message..." -ForegroundColor Green
    Invoke-Expression $Command
}

Show-Header

# 1. Dependency Alignment
Run-Step "Aligning dependencies with SDK 55" "npx expo install --fix"

# 2. Cache Cleaning
$choice = Read-Host "`nClear Metro cache? (y/n)"
if ($choice -eq 'y') {
    Run-Step "Cleaning Metro cache" "npx expo start --clear --tunnel"
}

# 3. Android Emulator Bridge
if (Get-Command adb -ErrorAction SilentlyContinue) {
    Run-Step "Setting up Android Port Forwarding (8081)" "adb reverse tcp:8081 tcp:8081"
}

# 4. Final Action
Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "✅ Environment is READY!" -ForegroundColor Green
Write-Host "1. Run 'npm start' to begin development (Tunnel)"
Write-Host "2. Use the new build from EAS when it's finished"
Write-Host "==========================================" -ForegroundColor Cyan
