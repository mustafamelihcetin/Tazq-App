Add-Type -AssemblyName System.Drawing
$outDir = 'd:\Tazq-App\screenshots\ipad_final'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$files = Get-ChildItem -Path 'd:\Tazq-App\screenshots' -Filter '*.jpg'

foreach ($file in $files) {
    if ($file.Name -like 'ipad_*') { continue }
    
    $img = [System.Drawing.Image]::FromFile($file.FullName)
    
    # Create a tiny version of the image to generate a natural blur
    $tinyBmp = New-Object System.Drawing.Bitmap(15, 30)
    $tinyG = [System.Drawing.Graphics]::FromImage($tinyBmp)
    $tinyG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $tinyG.DrawImage($img, 0, 0, 15, 30)
    
    # Create the final 2048x2732 iPad canvas
    $ipadBmp = New-Object System.Drawing.Bitmap(2048, 2732)
    $g = [System.Drawing.Graphics]::FromImage($ipadBmp)
    
    # Stretch the tiny image to fill the canvas, creating a beautiful organic blurred background
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($tinyBmp, -50, -50, 2148, 2832)
    
    # Scale the original marketing image to 90% of the iPad height
    $targetH = [int][math]::Floor(2732 * 0.88)
    $targetW = [int][math]::Floor($img.Width * ($targetH / $img.Height))
    
    # Center it
    $x = [int][math]::Floor((2048 - $targetW) / 2)
    $y = [int][math]::Floor((2732 - $targetH) / 2)
    
    # Draw a subtle drop shadow behind the original image so it pops
    $shadowRect = New-Object System.Drawing.Rectangle($x + 10, $y + 20, $targetW, $targetH)
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 0, 0, 0))
    $g.FillRectangle($shadowBrush, $shadowRect)
    
    # Draw the original image on top
    $g.DrawImage($img, $x, $y, $targetW, $targetH)
    
    $outPath = Join-Path $outDir ('ipad_' + $file.Name)
    $ipadBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    $shadowBrush.Dispose()
    $g.Dispose()
    $tinyG.Dispose()
    $ipadBmp.Dispose()
    $tinyBmp.Dispose()
    $img.Dispose()
    
    Write-Host "Processed flawless blurred background for $($file.Name)"
}
