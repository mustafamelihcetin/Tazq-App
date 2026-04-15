# Tazq-App Quick Launch Script
# Use this script to easily run the Backend and Frontend on your PC.

function Show-Header {
    Clear-Host
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "         TAZQ-APP LAUNCHER                " -ForegroundColor White -BackgroundColor Blue
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
}

$BackendPath = Join-Path $PSScriptRoot "Tazq-Backend"
$FrontendPath = Join-Path $PSScriptRoot "Tazq-Frontend"

while ($true) {
    Show-Header
    Write-Host "1. [Backend] Start API Service" -ForegroundColor Yellow
    Write-Host "2. [Frontend] Run on Windows" -ForegroundColor Yellow
    Write-Host "3. [Frontend] Run on Android Emulator" -ForegroundColor Yellow
    Write-Host "4. [Full Stack] Start Backend + Windows Frontend" -ForegroundColor Green
    Write-Host "5. Exit" -ForegroundColor Red
    Write-Host ""
    
    $choice = Read-Host "Choice"

    switch ($choice) {
        "1" {
            Write-Host "Starting Backend..." -ForegroundColor DarkCyan
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; dotnet watch run"
        }
        "2" {
            Write-Host "Starting Windows Frontend..." -ForegroundColor DarkCyan
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; dotnet build -t:Run -f net8.0-windows10.0.19041.0"
        }
        "3" {
            Write-Host "Searching for Android Emulators..." -ForegroundColor DarkCyan
            $emulators = & "$env:ANDROID_HOME\emulator\emulator.exe" -list-avds
            if ($emulators) {
                Write-Host "Available Emulators:"
                for ($i=0; $i -lt $emulators.Count; $i++) {
                    Write-Host "($($i+1)) $($emulators[$i])"
                }
                $emuChoice = Read-Host "Select Emulator #"
                if ($emuChoice -match "^\d+$" -and $emuChoice -le $emulators.Count) {
                    $selected = $emulators[$emuChoice-1]
                    Write-Host "Launching $selected..."
                    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; dotnet build -t:Run -f net8.0-android -p:AndroidDevice=$selected"
                }
            } else {
                Write-Host "No emulators found. Please make sure Android SDK is installed." -ForegroundColor Red
                Pause
            }
        }
        "4" {
            Write-Host "Launching Full Stack..." -ForegroundColor Green
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; dotnet watch run"
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; dotnet build -t:Run -f net8.0-windows10.0.19041.0"
        }
        "5" {
            break
        }
    }
}
