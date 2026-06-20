# Tazq Backend Deploy - Degistirilen dosyalari kopyala ve Docker'i rebuild et
$KEY = "$HOME\.ssh\tazq_key"
$SSH_ARGS = if (Test-Path $KEY) { @("-i", $KEY) } else { @() }
$S = "root@178.105.135.252"
$R = "/root/Tazq-Backend"
$L = "D:\Tazq-App\Tazq-Backend"

Write-Host "=== Dosyalar kopyalaniyor... ===" -ForegroundColor Cyan

$files = @(
    "Controllers\TasksController.cs",
    "Controllers\UsersController.cs",
    "Services\IUserService.cs",
    "Services\UserService.cs",
    "Services\TaskService.cs",
    "Models\TaskItem.cs",
    "Program.cs"
)
# Not: Frontend degisiklikleri (tasks.tsx, api.ts vb.) deploy gerekmez - Expo bundle ile dagitilir.
foreach ($f in $files) {
    $remote = $f.Replace('\', '/')
    & scp @SSH_ARGS "$L\$f" "${S}:${R}/$remote"
}

Write-Host "=== Docker rebuild basliyor... ===" -ForegroundColor Yellow
& ssh @SSH_ARGS $S "cd /root && docker compose build tazq-backend --no-cache && docker compose up -d tazq-backend"

Write-Host "=== TAMAMLANDI ===" -ForegroundColor Green
