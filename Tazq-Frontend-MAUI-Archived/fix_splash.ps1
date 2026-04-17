$file = "c:\Users\melih\Desktop\Projects\mustafamelihcetin\Tazq-App\Tazq-Frontend\Views\SplashPage.xaml.cs"
$content = Get-Content $file -Raw
$newContent = $content -replace "private readonly ApiService _apiService = MauiProgram.Services!.GetRequiredService<ApiService>\(\);", "private readonly ApiService _apiService;"
$newContent = $newContent -replace "public SplashPage\(\)", "public SplashPage(ApiService apiService)"
$newContent = $newContent -replace "InitializeComponent\(\);", "InitializeComponent(); `n            _apiService = apiService;"
Set-Content $file $newContent -Encoding UTF8
Write-Host "Refactored SplashPage.xaml.cs"
