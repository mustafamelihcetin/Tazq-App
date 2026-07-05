# Tazq Backend Deploy - Degistirilen dosyalari kopyala ve Docker'i rebuild et
$KEY = "$HOME\.ssh\tazq_key"
$SSH_ARGS = if (Test-Path $KEY) { @("-i", $KEY) } else { @() }
$S = "root@178.105.135.252"
$R = "/root/Tazq-Backend"
$L = "D:\Tazq-App\Tazq-Backend"

Write-Host "=== Uzak klasorler kontrol ediliyor... ===" -ForegroundColor Cyan
& ssh @SSH_ARGS $S "mkdir -p ${R}/Controllers ${R}/Models ${R}/Data ${R}/Migrations ${R}/Services"

Write-Host "=== Dosyalar kopyalaniyor... ===" -ForegroundColor Cyan

# Kaynak klasorleri komple kopyala (kismi liste yerine) - boylece yeni dosya/migration atlanmaz
$dirs = @("Controllers", "Services", "Models", "Data", "Migrations")
foreach ($d in $dirs) {
    & scp @SSH_ARGS -r "$L\$d\." "${S}:${R}/$d/"
}

# Proje kok dosyalari
$rootFiles = @("Tazq-Backend.csproj", "Program.cs", "appsettings.json")
foreach ($f in $rootFiles) {
    & scp @SSH_ARGS "$L\$f" "${S}:${R}/$f"
}

Write-Host "=== Docker rebuild basliyor... ===" -ForegroundColor Yellow
& ssh @SSH_ARGS $S "cd /root && docker compose build tazq-backend --no-cache && docker compose up -d tazq-backend"
Write-Host "=== Deploy tamamlandi! ===" -ForegroundColor Green
