# Tazq Backend Smart Deploy - Sadece degistirilen dosyalari gonderir
$KEY = "$HOME\.ssh\tazq_key"
$SSH_ARGS = if (Test-Path $KEY) { @("-i", $KEY) } else { @() }
$S = "root@178.105.135.252"
$R = "/root/Tazq-Backend"
$L = "D:\Tazq-App\Tazq-Backend"
$STATE_FILE = "D:\Tazq-App\.deploy-state.csv"

Write-Host "=== Dosya degisiklikleri kontrol ediliyor... ===" -ForegroundColor Cyan

# Mevcut durumu oku
$state = @{}
if (Test-Path $STATE_FILE) {
    Import-Csv $STATE_FILE | ForEach-Object { $state[$_.Path] = $_.Hash }
}

$newState = @{}
$filesToUpload = @()

$dirs = @("Controllers", "Services", "Models", "Data", "Migrations", "wwwroot", "Middlewares", "Validators", "Properties")
$rootFiles = @("Tazq-Backend.csproj", "Program.cs", "appsettings.json", "DockerFile")

# Tum dosyalari tara
$allFiles = @()
foreach ($d in $dirs) {
    if (Test-Path "$L\$d") {
        $allFiles += Get-ChildItem -Path "$L\$d" -File -Recurse
    }
}
foreach ($f in $rootFiles) {
    if (Test-Path "$L\$f") {
        $allFiles += Get-Item "$L\$f"
    }
}

# Degisiklikleri kiyasla
foreach ($file in $allFiles) {
    $relPath = $file.FullName.Substring($L.Length + 1).Replace('\', '/')
    $hash = (Get-FileHash $file.FullName -Algorithm SHA256).Hash
    $newState[$relPath] = $hash

    if (-not $state.ContainsKey($relPath) -or $state[$relPath] -ne $hash) {
        $filesToUpload += $relPath
    }
}

# Silinenleri bul
$filesToDelete = @()
foreach ($key in $state.Keys) {
    if (-not $newState.ContainsKey($key)) {
        $filesToDelete += $key
    }
}

if ($filesToUpload.Count -gt 0 -or $filesToDelete.Count -gt 0) {
    if ($filesToUpload.Count -gt 0) {
        Write-Host "Bulunan degisiklik sayisi: $($filesToUpload.Count)" -ForegroundColor Yellow
        foreach ($f in $filesToUpload) { Write-Host " [+] $f" -ForegroundColor Green }
        
        Push-Location $L
        [IO.File]::WriteAllLines("deploy-list.txt", $filesToUpload)
        tar -cf deploy-update.tar -T deploy-list.txt
        Remove-Item "deploy-list.txt"
        Pop-Location
        
        Write-Host "=== Uzak klasorler hazirlaniyor... ===" -ForegroundColor Cyan
        & ssh @SSH_ARGS $S "mkdir -p ${R}/Controllers ${R}/Models ${R}/Data ${R}/Migrations ${R}/Services ${R}/wwwroot/images ${R}/wwwroot/css ${R}/Middlewares ${R}/Validators ${R}/Properties"
        
        Write-Host "=== Degisen dosyalar sunucuya gonderiliyor... ===" -ForegroundColor Cyan
        & scp @SSH_ARGS "$L\deploy-update.tar" "${S}:/tmp/deploy-update.tar"
        
        Write-Host "=== Sunucuda dosyalar cikariliyor... ===" -ForegroundColor Cyan
        & ssh @SSH_ARGS $S "tar -xf /tmp/deploy-update.tar -C ${R} && rm /tmp/deploy-update.tar"
        
        Remove-Item "$L\deploy-update.tar"
    }

    if ($filesToDelete.Count -gt 0) {
        Write-Host "Silinen dosya sayisi: $($filesToDelete.Count)" -ForegroundColor Yellow
        foreach ($f in $filesToDelete) { Write-Host " [-] $f" -ForegroundColor Red }
        
        $delCmds = $filesToDelete | ForEach-Object { "rm -f '${R}/$_'" }
        $delScript = $delCmds -join " ; "
        & ssh @SSH_ARGS $S $delScript
    }

    # Yeni durumu kaydet
    $newStateList = @()
    foreach ($key in $newState.Keys) {
        $newStateList += [PSCustomObject]@{ Path = $key; Hash = $newState[$key] }
    }
    $newStateList | Export-Csv $STATE_FILE -NoTypeInformation
    
    Write-Host "=== Docker rebuild basliyor... ===" -ForegroundColor Yellow
    & ssh @SSH_ARGS $S "cd /root && docker compose build tazq-backend --no-cache && docker compose up -d tazq-backend"
    Write-Host "=== Deploy tamamlandi! ===" -ForegroundColor Green
} else {
    Write-Host "=== Degisen dosya yok. Deploy atlandi. ===" -ForegroundColor Green
}
