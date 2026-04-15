# Tazq-App Smart Launch Script
# Bu script her şeyi senin yerine akıllıca halleder.

function Show-Header {
    Clear-Host
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "         TAZQ-APP SMART LAUNCHER          " -ForegroundColor White -BackgroundColor Blue
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
}

$RootPath = $PSScriptRoot
$BackendPath = Join-Path $RootPath "Tazq-Backend"
$FrontendPath = Join-Path $RootPath "Tazq-Frontend"

function Start-DockerDB {
    Write-Host "-> Veritabanı kontrol ediliyor (Docker)..." -ForegroundColor Cyan
    docker-compose -f "$RootPath/docker-compose.yml" up -d tazq-db
}

while ($true) {
    Show-Header
    Write-Host "1. [Backend] Yerel API'yi Başlat (Hot-Reload)" -ForegroundColor Yellow
    Write-Host "2. [Frontend] Windows Uygulamasını Çalıştır" -ForegroundColor Yellow
    Write-Host "3. [Frontend] Android Emülatöründe Çalıştır" -ForegroundColor Yellow
    Write-Host "4. [FULL STACK] Her Şeyi Başlat (DB + API + Windows App)" -ForegroundColor Green
    Write-Host "5. [Temizlik] Hatalı Dosyaları Sil ve Yeniden Derle" -ForegroundColor Magenta
    Write-Host "6. Çıkış" -ForegroundColor Red
    Write-Host ""
    
    $choice = Read-Host "Seçiminiz"

    switch ($choice) {
        "1" {
            Start-DockerDB
            Write-Host "-> API başlatılıyor..." -ForegroundColor DarkCyan
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; dotnet watch run"
        }
        "2" {
            Write-Host "-> Windows uygulaması başlatılıyor..." -ForegroundColor DarkCyan
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; dotnet build -t:Run -f net8.0-windows10.0.19041.0"
        }
        "3" {
            Write-Host "-> Android emülatörleri aranıyor..." -ForegroundColor DarkCyan
            # Android SDK yolunu bulmaya çalış
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
                Write-Host "HATA: Android emülatörü bulunamadı veya ANDROID_HOME ayarlı değil." -ForegroundColor Red
                Pause
            }
        }
        "4" {
            Write-Host "-> Full Stack sistem ayağa kaldırılıyor..." -ForegroundColor Green
            Start-DockerDB
            # Backend'i sadece kendi ortamında başlat
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; dotnet watch run --project Tazq-Backend.csproj"
            # Frontend'i Windows olarak başlat
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; dotnet run -f net8.0-windows10.0.19041.0"
        }
        "5" {
            Write-Host "-> Tüm geçici build dosyaları siliniyor (bin/obj)..." -ForegroundColor Yellow
            Get-ChildItem -Path $RootPath -Include bin,obj -Recurse | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "-> Temizlik tamamlandı. Şimdi temiz bir şekilde çalıştırabilirsiniz." -ForegroundColor Green
            Pause
        }
        "6" {
            break
        }
    }
}
