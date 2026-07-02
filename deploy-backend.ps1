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
    # Controllers
    "Controllers\AdminController.cs",
    "Controllers\AdminSystemController.cs",
    "Controllers\AiController.cs",
    "Controllers\ContentController.cs",
    "Controllers\EmailController.cs",
    "Controllers\FocusSessionController.cs",
    "Controllers\SupportController.cs",
    "Controllers\TasksController.cs",
    "Controllers\UsersController.cs",

    # Services
    "Services\AppleTokenValidator.cs",
    "Services\CryptoService.cs",
    "Services\CustomEmailService.cs",
    "Services\CustomSmsService.cs",
    "Services\FocusSessionService.cs",
    "Services\GoogleTokenValidator.cs",
    "Services\GroqService.cs",
    "Services\IAppleTokenValidator.cs",
    "Services\ICryptoService.cs",
    "Services\ICustomEmailService.cs",
    "Services\ICustomSmsService.cs",
    "Services\IFocusSessionService.cs",
    "Services\IGoogleTokenValidator.cs",
    "Services\IGroqService.cs",
    "Services\IJwtService.cs",
    "Services\IOtpService.cs",
    "Services\ITaskService.cs",
    "Services\IUserService.cs",
    "Services\InMemoryLogStore.cs",
    "Services\InMemoryLoggerProvider.cs",
    "Services\JwtService.cs",
    "Services\OtpService.cs",
    "Services\ScheduledEmailService.cs",
    "Services\TaskService.cs",
    "Services\UserService.cs",

    # Models
    "Models\AppleLoginDto.cs",
    "Models\ContentDocument.cs",
    "Models\EmailRequestDto.cs",
    "Models\FocusSession.cs",
    "Models\GoogleLoginDto.cs",
    "Models\JsonStringListConverter.cs",
    "Models\PasswordResetToken.cs",
    "Models\PhoneNumberDto.cs",
    "Models\RefreshToken.cs",
    "Models\SmtpSetting.cs",
    "Models\SupportMessage.cs",
    "Models\TaskItem.cs",
    "Models\TaskPriority.cs",
    "Models\TaskRequestDto.cs",
    "Models\User.cs",
    "Models\UserNotificationPreferences.cs",
    "Models\UserRegisterDto.cs",
    "Models\UserResetPasswordDto.cs",

    # Data & Migrations
    "Data\AppDbContext.cs",
    "Migrations\20260629121823_AddSupportMessages.cs",
    "Migrations\20260629121823_AddSupportMessages.Designer.cs",
    "Migrations\20260701230858_AddBlindIndicesAndReorder.cs",
    "Migrations\20260701230858_AddBlindIndicesAndReorder.Designer.cs",
    "Migrations\AppDbContextModelSnapshot.cs",

    # Project Files
    "Tazq-Backend.csproj",
    "Program.cs"
)

foreach ($f in $files) {
    $remote = $f.Replace('\', '/')
    & scp @SSH_ARGS "$L\$f" "${S}:${R}/$remote"
}

Write-Host "=== Docker rebuild basliyor... ===" -ForegroundColor Yellow
& ssh @SSH_ARGS $S "cd /root && docker compose build tazq-backend --no-cache && docker compose up -d tazq-backend"
Write-Host "=== Deploy tamamlandi! ===" -ForegroundColor Green
