# Tazq-App Smart Launch Script v2.1
# UTF-8 BOM ve Tam Karakter Desteği eklendi.

# Konsolu UTF-8 moduna zorla
chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Show-Header {
    Clear-Host
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "         TAZQ-APP SMART LAUNCHER V2.1     " -ForegroundColor White -BackgroundColor Blue
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
}

$RootPath = $PSScriptRoot
$BackendPath = Join-Path $RootPath "Tazq-Backend"
$FrontendPath = Join-Path $RootPath "Tazq-Frontend"

function Stop-PortProcess([int]$port) {
    $processId = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
    if ($processId) {
        Write-Host "-> Port $port üzerinde çalışan eski süreç ($processId) temizleniyor..." -ForegroundColor Yellow
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
}

function Start-DockerDB {
    Write-Host "-> Veritabanı kontrol ediliyor (Docker)..." -ForegroundColor Cyan
    docker-compose -f "$RootPath/docker-compose.yml" up -d tazq-db
}

while ($true) {
    Show-Header
    Stop-PortProcess 5200
    
    Write-Host "--- BACKEND (API) ---" -ForegroundColor Gray
    Write-Host "1. [API] Başlat (Hot-Reload / dotnet watch)" -ForegroundColor Yellow
    Write-Host "2. [API] Hızlı Başlat (No-Build / dotnet run --no-build)" -ForegroundColor DarkYellow
    Write-Host ""
    Write-Host "--- FRONTEND (APP) ---" -ForegroundColor Gray
    Write-Host "3. [Win] Windows Uygulamasını Başlat (Derleyerek)" -ForegroundColor Yellow
    Write-Host "4. [Win] Windows Uygulamasını HIZLI Başlat (Derlemeden)" -ForegroundColor Green
    Write-Host "5. [And] Android Emülatöründe Çalıştır" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "--- SISTEM ---" -ForegroundColor Gray
    Write-Host "6. [FULL STACK] Her Şeyi Başlat (DB + API + Windows App)" -ForegroundColor Green
    Write-Host "7. [TEMİZLİK] Build Dosyalarını Sil ve Sıfırla" -ForegroundColor Magenta
    Write-Host "8. Çıkış" -ForegroundColor Red
    Write-Host ""
    
    $choice = Read-Host "Seçiminiz"

    switch ($choice) {
        "1" {
            Start-DockerDB
            Write-Host "-> API başlatılıyor..." -ForegroundColor DarkCyan
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; dotnet watch run"
        }
        "2" {
            Start-DockerDB
            Write-Host "-> API (No-Build) hızlı başlatılıyor..." -ForegroundColor DarkCyan
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; dotnet run --no-build"
        }
        "3" {
            Write-Host "-> Windows uygulaması derleniyor ve başlatılıyor..." -ForegroundColor DarkCyan
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; dotnet build -t:Run -f net8.0-windows10.0.19041.0"
        }
        "4" {
            Write-Host "-> Windows uygulaması (No-Build) anında açılıyor..." -ForegroundColor Green
            $exePath = Get-ChildItem -Path "$FrontendPath/bin/Debug/net8.0-windows10.0.19041.0/win10-x64" -Filter "Tazq-Frontend.exe" -Recurse | Select-Object -ExpandProperty FullName -First 1
            if ($exePath) {
                Start-Process "$exePath"
            } else {
                Write-Host "HATA: Uygulama henüz derlenmemiş! Lütfen önce (3) numara ile derleyin." -ForegroundColor Red
                Pause
            }
        }
        "5" {
            Write-Host "-> Android emülatörleri aranıyor..." -ForegroundColor DarkCyan
            $emuPath = if ($env:ANDROID_HOME) { "$env:ANDROID_HOME\emulator\emulator.exe" } else { "emulator" }
            $emulators = & $emuPath -list-avds 2>$null
            
            if ($emulators) {
                Write-Host "Kullanılabilir Emülatörler:"
                for ($i=0; $i -lt $emulators.Count; $i++) { Write-Host "($($i+1)) $($emulators[$i])" }
                $emuChoice = Read-Host "Emülatör No Seçin"
                if ($emuChoice -match "^\d+$" -and $emuChoice -le $emulators.Count) {
                    $selected = $emulators[$emuChoice-1]
                    Write-Host "-> $selected başlatılıyor..."
                    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; dotnet build -t:Run -f net8.0-android -p:AndroidDevice=$selected"
                }
            } else {
                Write-Host "HATA: Android emülatörü bulunamadı." -ForegroundColor Red
                Pause
            }
        }
        "6" {
            Write-Host "-> Full Stack sistem ayağa kaldırılıyor..." -ForegroundColor Green
            Start-DockerDB
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; dotnet watch run --project Tazq-Backend.csproj"
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; dotnet build -t:Run -f net8.0-windows10.0.19041.0"
        }
        "7" {
            Write-Host "-> Tüm geçici build dosyaları siliniyor (bin/obj)..." -ForegroundColor Yellow
            Get-ChildItem -Path $RootPath -Include bin,obj -Recurse | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "-> Temizlik tamamlandı." -ForegroundColor Green
            Pause
        }
        "8" {
            exit
        }
    }
}
