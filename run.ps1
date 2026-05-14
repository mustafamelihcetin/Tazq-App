# Tazq-App Smart Launch Script v3.2 (Professional Edition)
# NOT: Turkce karakter sorunlarini onlemek icin menuler ASCII olarak guncellenmistir.

# Konsolu UTF-8 moduna zorla
chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Show-Header {
    Clear-Host
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "         TAZQ-APP SMART LAUNCHER V3.2     " -ForegroundColor White -BackgroundColor Blue
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
}

$RootPath = $PSScriptRoot
$BackendPath = Join-Path $RootPath "Tazq-Backend"
$FrontendPath = Join-Path $RootPath "Tazq-Frontend"

function Stop-PortProcess([int]$port) {
    $processId = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
    if ($processId) {
        Write-Host "-> Port $port uzerinde calisan eski surec ($processId) temizleniyor..." -ForegroundColor Yellow
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
}

function Start-DockerDB {
    Write-Host "-> Docker motoru hazirlaniyor..." -ForegroundColor Cyan
    
    Write-Host "-> Veritabani ve Redis konteynerleri baslatiliyor (Docker)..." -ForegroundColor Cyan
    docker compose -f "$RootPath/docker-compose.yml" up -d tazq-db tazq-redis
    if ($LASTEXITCODE -ne 0) {
        Write-Host "!!! UYARI: Docker Compose komutu basarisiz oldu. Ancak konteynerler halihazirda arka planda calisiyor olabilir, devam ediliyor..." -ForegroundColor Yellow
        return $true
    }

    Write-Host "-> Veritabani hazir olana kadar bekleniyor (kisa kontrol)..." -ForegroundColor Cyan
    Start-Sleep -Seconds 3
    return $true
}

function Test-Frontend-Setup {
    if (-not (Test-Path -Path (Join-Path $FrontendPath "node_modules"))) {
        Write-Host "!!! HATA: 'node_modules' bulunamadi! Lutfen once 'cd Tazq-Frontend; npm install' komutunu calistirin." -ForegroundColor Red
        Pause
        return $false
    }
    return $true
}

while ($true) {
    Show-Header
    Stop-PortProcess 5200
    
    Write-Host "--- BACKEND (API) ---" -ForegroundColor Gray
    Write-Host "1. [API] Baslat (Hot-Reload / dotnet watch)" -ForegroundColor Yellow
    Write-Host "2. [API] Hizli Baslat (No-Build / dotnet run --no-build)" -ForegroundColor DarkYellow
    Write-Host ""
    Write-Host "--- FRONTEND (EXPO APP) ---" -ForegroundColor Gray
    Write-Host "3. [Win/Web] Web Uygulamasini Baslat" -ForegroundColor Green
    Write-Host "5. [And] Android Emulatorunde Calistir" -ForegroundColor Yellow
    Write-Host "9. [iOS] Expo Go ile Baslat (QR Kod)" -ForegroundColor Cyan
    Write-Host "10. [iOS/Build] EAS ile Profesyonel Build Al (IPA)" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Host "--- SISTEM ---" -ForegroundColor Gray
    Write-Host "6. [FULL STACK] Her Seyi Baslat (DB + API + Mobil App - Expo Go)" -ForegroundColor Green
    Write-Host "7. [FULL STACK NATIVE] Her Seyi Baslat (DB + API + Android Build - Mikrofon Icin)" -ForegroundColor DarkGreen
    Write-Host "8. [TEMIZLIK] Gecici Dosyalari Temizle" -ForegroundColor Magenta
    Write-Host "9. Cikis" -ForegroundColor Red
    Write-Host ""
    
    $choice = Read-Host "Seciminiz"

    switch ($choice) {
        "1" {
            if (Start-DockerDB) {
                Write-Host "-> API baslatiliyor..." -ForegroundColor DarkCyan
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; dotnet watch run"
            } else {
                Pause
            }
        }
        "2" {
            if (Start-DockerDB) {
                Write-Host "-> API (No-Build) hizli baslatiliyor..." -ForegroundColor DarkCyan
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; dotnet run --no-build"
            } else {
                Pause
            }
        }
        "3" {
            if (Test-Frontend-Setup) {
                Write-Host "-> Web uygulamasi baslatiliyor..." -ForegroundColor Green
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; npx expo start --web"
            }
        }
        "5" {
            if (Test-Frontend-Setup) {
                Write-Host "-> Android emulatoru kontrol ediliyor..." -ForegroundColor Yellow
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; npx expo start --android"
            }
        }
        "9" {
            if (Test-Frontend-Setup) {
                Write-Host "-> iOS icin Expo baslatiliyor (QR kodu taratin)..." -ForegroundColor Cyan
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; npx expo start"
            }
        }
        "10" {
            if (Test-Frontend-Setup) {
                Write-Host "-> EAS Professional iOS Build baslatiliyor..." -ForegroundColor DarkCyan
                Write-Host "NOT: Ilk kez calistiriyorsaniz terminaldeki yonergeleri takip edin (EAS Login gerekli)." -ForegroundColor Gray
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; npx eas build --platform ios --profile preview"
            }
        }
        "6" {
            if (Test-Frontend-Setup) {
                if (Start-DockerDB) {
                    Write-Host "-> Full Stack sistem VS Code terminalinde birlesik olarak baslatiliyor..." -ForegroundColor Green
                    
                    # Use 'npx concurrently' to run both elegantly in the exact same terminal tab
                    Set-Location $RootPath
                    $cmd = "npx concurrently -n `"BACKEND,FRONTEND`" -c `"cyan,green`" `"cd Tazq-Backend && dotnet watch run`" `"cd Tazq-Frontend && npx expo start`""
                    Invoke-Expression $cmd
                } else {
                    Pause
                }
            }
        }
        "7" {
            if (Test-Frontend-Setup) {
                if (Start-DockerDB) {
                    Write-Host "-> Full Stack sistem (Android Native Build) baslatiliyor (Ilk derleme uzun surebilir)..." -ForegroundColor Green
                    Set-Location $RootPath
                    $cmd = "npx concurrently -n `"BACKEND,FRONTEND`" -c `"cyan,green`" `"cd Tazq-Backend && dotnet watch run`" `"cd Tazq-Frontend && npm run android`""
                    Invoke-Expression $cmd
                } else {
                    Pause
                }
            }
        }
        "8" {
            Write-Host "-> Tum gecici dosyalar siliniyor..." -ForegroundColor Yellow
            Get-ChildItem -Path $RootPath -Include bin,obj -Recurse | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
            if (Test-Path "$FrontendPath/.expo") { Remove-Item -Recurse -Force "$FrontendPath/.expo" }
            Write-Host "-> Temizlik tamamlandi." -ForegroundColor Green
            Pause
        }
        "9" {
            exit
        }
    }
}
