Add-Type -AssemblyName System.Drawing
$outDir = 'd:\Tazq-App\screenshots\ipad_masterpiece'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$files = Get-ChildItem -Path 'd:\Tazq-App\screenshots' -Filter '*.jpg'

foreach ($file in $files) {
    if ($file.Name -like 'ipad_*') { continue }
    $img = [System.Drawing.Image]::FromFile($file.FullName)
    
    $ipadBmp = New-Object System.Drawing.Bitmap(2048, 2732)
    $g = [System.Drawing.Graphics]::FromImage($ipadBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    
    # 1. PERFECT SEAMLESS GRADIENT BACKGROUND
    $topColor = $img.GetPixel([int]($img.Width / 2), 5)
    $bottomColor = $img.GetPixel([int]($img.Width / 2), $img.Height - 5)
    $rect = New-Object System.Drawing.Rectangle(0, 0, 2048, 2732)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $topColor, $bottomColor, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillRectangle($bgBrush, $rect)
    
    # 2. MARKETING TEXT (Top of original image, y=0 to 720)
    # We will draw it at the top. It will blend seamlessly with our gradient.
    $textSrcRect = New-Object System.Drawing.Rectangle(0, 0, $img.Width, 720)
    $textScale = 2048.0 / $img.Width
    $textH = [int]($textSrcRect.Height * $textScale)
    $textDestRect = New-Object System.Drawing.Rectangle(0, 0, 2048, $textH)
    $g.DrawImage($img, $textDestRect, 0, 0, $textSrcRect.Width, $textSrcRect.Height, [System.Drawing.GraphicsUnit]::Pixel)
    
    # 3. PURE UI (NO NOTCH, NO PHONE)
    # Original phone screen was x=234, y=778, w=710, h=1522
    # We crop the top 120 pixels to completely DESTROY the dynamic island / phone look.
    $uiCropY = 898
    $uiCropH = 1402
    
    # Target size for the UI to look majestic on iPad
    $targetUI_H = 1600
    $targetUI_W = [int](710 * ($targetUI_H / 1402.0))
    
    $uiX = [int]((2048 - $targetUI_W) / 2)
    $uiY = $textH + [int]((2732 - $textH - $targetUI_H) / 2) + 20
    
    # 4. ELEGANT DROP SHADOW (using rectangles to avoid path bugs)
    for ($i = 0; $i -lt 15; $i++) {
        $alpha = [int](25 - ($i * 1.5))
        if ($alpha -lt 0) { $alpha = 0 }
        $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($alpha, 0, 0, 0))
        $g.FillRectangle($shadowBrush, $uiX - $i + 15, $uiY - $i + 25, $targetUI_W + ($i*2), $targetUI_H + ($i*2))
        $shadowBrush.Dispose()
    }
    
    # 5. DRAW PURE UI
    $uiDestRect = New-Object System.Drawing.Rectangle($uiX, $uiY, $targetUI_W, $targetUI_H)
    $g.DrawImage($img, $uiDestRect, 234, $uiCropY, 710, $uiCropH, [System.Drawing.GraphicsUnit]::Pixel)
    
    $outPath = Join-Path $outDir ('ipad_masterpiece_' + $file.Name)
    $ipadBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    $bgBrush.Dispose()
    $g.Dispose()
    $ipadBmp.Dispose()
    $img.Dispose()
    
    Write-Host "Processed masterpiece for $($file.Name)"
}
