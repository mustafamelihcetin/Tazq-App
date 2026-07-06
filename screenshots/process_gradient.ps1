Add-Type -AssemblyName System.Drawing
$outDir = 'd:\Tazq-App\screenshots\ipad'

$files = Get-ChildItem -Path 'd:\Tazq-App\screenshots' -Filter '*.jpg'
foreach ($file in $files) {
    if ($file.Name -like 'ipad_*') { continue }
    $img = [System.Drawing.Image]::FromFile($file.FullName)
    $bmp = New-Object System.Drawing.Bitmap($img)
    
    $topColor = $bmp.GetPixel([int]($img.Width / 2), 10)
    $bottomColor = $bmp.GetPixel([int]($img.Width / 2), $img.Height - 10)
    
    $ipadBmp = New-Object System.Drawing.Bitmap(2048, 2732)
    $g = [System.Drawing.Graphics]::FromImage($ipadBmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    $rect = New-Object System.Drawing.Rectangle(0, 0, 2048, 2732)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $topColor, $bottomColor, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillRectangle($brush, $rect)
    
    $targetH = [int][math]::Floor(2732 * 0.90)
    $targetW = [int][math]::Floor($img.Width * ($targetH / $img.Height))
    
    $x = [int][math]::Floor((2048 - $targetW) / 2)
    $y = [int][math]::Floor((2732 - $targetH) / 2)
    
    $g.DrawImage($img, $x, $y, $targetW, $targetH)
    
    $outPath = Join-Path $outDir ('ipad_' + $file.Name)
    $ipadBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    $brush.Dispose()
    $g.Dispose()
    $ipadBmp.Dispose()
    $bmp.Dispose()
    $img.Dispose()
    Write-Host "Processed $($file.Name) with LinearGradientBrush"
}
