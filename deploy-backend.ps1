# Tazq Backend Deploy - Degistirilen dosyalari kopyala ve Docker'i rebuild et
$KEY = "$HOME\.ssh\tazq_key"
$SSH_ARGS = if (Test-Path $KEY) { @("-i", $KEY) } else { @() }
$S = "root@178.105.135.252"
$R = "/root/Tazq-Backend"
$L = "D:\Tazq-App\Tazq-Backend"

Write-Host "=== Uzak klasorler kontrol ediliyor... ===" -ForegroundColor Cyan
& ssh @SSH_ARGS $S "mkdir -p ${R}/Controllers ${R}/Models ${R}/Data ${R}/Migrations ${R}/Services"

Write-Host "=== Dosyalar kopyalaniyor... ===" -ForegroundColor Cyan

$files = @(
    "Controllers\TasksController.cs",
    "Controllers\UsersController.cs",
    "Controllers\SupportController.cs",
    "Services\IUserService.cs",
    "Services\UserService.cs",
    "Services\ITaskService.cs",
    "Services\TaskService.cs",
    "Services\ICryptoService.cs",
    "Services\CryptoService.cs",
    "Models\TaskItem.cs",
    "Models\SupportMessage.cs",
    "Data\AppDbContext.cs",
    "Migrations\20260629121823_AddSupportMessages.cs",
    "Migrations\20260629121823_AddSupportMessages.Designer.cs",
    "Migrations\20260701230858_AddBlindIndicesAndReorder.cs",
    "Migrations\20260701230858_AddBlindIndicesAndReorder.Designer.cs",
    "Migrations\AppDbContextModelSnapshot.cs",
    "Program.cs"
)

foreach ($f in $files) {
    $remote = $f.Replace('\', '/')
    & scp @SSH_ARGS "$L\$f" "${S}:${R}/$remote"
}

Write-Host "=== Docker rebuild basliyor... ===" -ForegroundColor Yellow
& ssh @SSH_ARGS $S "cd /root && docker compose build tazq-backend --no-cache && docker compose up -d tazq-backend"
Write-Host "=== Deploy tamamlandi! ===" -ForegroundColor Green
