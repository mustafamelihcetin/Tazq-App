Add-Type -AssemblyName System.Drawing
$outDir = 'd:\Tazq-App\screenshots\ipad_gradient'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$files = Get-ChildItem -Path 'd:\Tazq-App\screenshots' -Filter '*.jpg'

foreach ($file in $files) {
    if ($file.Name -like 'ipad_*') { continue }
    $img = [System.Drawing.Image]::FromFile($file.FullName)
    
    $ipadBmp = New-Object System.Drawing.Bitmap(2048, 2732)
    $g = [System.Drawing.Graphics]::FromImage($ipadBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    # 1. Background Gradient (Sampling top and bottom colors)
    $topColor = $img.GetPixel([int]($img.Width / 2), 5)
    $bottomColor = $img.GetPixel([int]($img.Width / 2), $img.Height - 5)
    $rect = New-Object System.Drawing.Rectangle(0, 0, 2048, 2732)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $topColor, $bottomColor, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillRectangle($bgBrush, $rect)
    
    $targetH = 2458
    $targetW = [int]($img.Width * (2458.0 / $img.Height))
    $x = [int]((2048 - $targetW) / 2)
    $y = [int]((2732 - $targetH) / 2)
    
    # Add a drop shadow to hide any slight gradient mismatch
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 0, 0, 0))
    $g.FillRectangle($shadowBrush, $x + 10, $y + 15, $targetW, $targetH)
    
    # Draw original image
    $g.DrawImage($img, $x, $y, $targetW, $targetH)
    
    $outPath = Join-Path $outDir ('ipad_gradient_' + $file.Name)
    $ipadBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    $shadowBrush.Dispose()
    $bgBrush.Dispose()
    $g.Dispose()
    $ipadBmp.Dispose()
    $img.Dispose()
    
    Write-Host "Processed perfect gradient background for $($file.Name)"
}
