Add-Type -AssemblyName System.Drawing
$outDir = 'd:\Tazq-App\screenshots\ipad_flawless'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$files = Get-ChildItem -Path 'd:\Tazq-App\screenshots' -Filter '*.jpg'

foreach ($file in $files) {
    if ($file.Name -like 'ipad_*') { continue }
    $img = [System.Drawing.Image]::FromFile($file.FullName)
    
    $ipadBmp = New-Object System.Drawing.Bitmap(2048, 2732)
    $g = [System.Drawing.Graphics]::FromImage($ipadBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    $targetH = 2458
    $targetW = [int]($img.Width * (2458.0 / $img.Height))
    $x = [int]((2048 - $targetW) / 2)
    $y = [int]((2732 - $targetH) / 2)
    
    # 1. Left Edge Stretch
    # Source: x=0, y=0, w=1, h=img.Height
    # Dest: x=0, y=$y, w=$x, h=$targetH
    $dstLeft = New-Object System.Drawing.Rectangle(0, $y, $x, $targetH)
    $g.DrawImage($img, $dstLeft, 0, 0, 1, $img.Height, [System.Drawing.GraphicsUnit]::Pixel)
    
    # 2. Right Edge Stretch
    # Source: x=img.Width-1, y=0, w=1, h=img.Height
    # Dest: x=$x+$targetW, y=$y, w=2048-($x+$targetW), h=$targetH
    $rx = $x + $targetW
    $rw = 2048 - $rx
    $dstRight = New-Object System.Drawing.Rectangle($rx, $y, $rw, $targetH)
    $g.DrawImage($img, $dstRight, $img.Width - 1, 0, 1, $img.Height, [System.Drawing.GraphicsUnit]::Pixel)
    
    # 3. Top Edge Stretch
    $dstTop = New-Object System.Drawing.Rectangle($x, 0, $targetW, $y)
    $g.DrawImage($img, $dstTop, 0, 0, $img.Width, 1, [System.Drawing.GraphicsUnit]::Pixel)
    
    # 4. Bottom Edge Stretch
    $by = $y + $targetH
    $bh = 2732 - $by
    $dstBottom = New-Object System.Drawing.Rectangle($x, $by, $targetW, $bh)
    $g.DrawImage($img, $dstBottom, 0, $img.Height - 1, $img.Width, 1, [System.Drawing.GraphicsUnit]::Pixel)
    
    # 5. Top Left Corner
    $dstTL = New-Object System.Drawing.Rectangle(0, 0, $x, $y)
    $g.DrawImage($img, $dstTL, 0, 0, 1, 1, [System.Drawing.GraphicsUnit]::Pixel)
    
    # 6. Top Right Corner
    $dstTR = New-Object System.Drawing.Rectangle($rx, 0, $rw, $y)
    $g.DrawImage($img, $dstTR, $img.Width - 1, 0, 1, 1, [System.Drawing.GraphicsUnit]::Pixel)
    
    # 7. Bottom Left Corner
    $dstBL = New-Object System.Drawing.Rectangle(0, $by, $x, $bh)
    $g.DrawImage($img, $dstBL, 0, $img.Height - 1, 1, 1, [System.Drawing.GraphicsUnit]::Pixel)
    
    # 8. Bottom Right Corner
    $dstBR = New-Object System.Drawing.Rectangle($rx, $by, $rw, $bh)
    $g.DrawImage($img, $dstBR, $img.Width - 1, $img.Height - 1, 1, 1, [System.Drawing.GraphicsUnit]::Pixel)
    
    # 9. Draw the intact original image in the center
    # Add a tiny drop shadow just in case
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 0, 0, 0))
    $g.FillRectangle($shadowBrush, $x + 10, $y + 15, $targetW, $targetH)
    $g.DrawImage($img, $x, $y, $targetW, $targetH)
    
    $outPath = Join-Path $outDir ('ipad_flawless_' + $file.Name)
    $ipadBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    $shadowBrush.Dispose()
    $g.Dispose()
    $ipadBmp.Dispose()
    $img.Dispose()
    
    Write-Host "Processed flawless edge-stretched background for $($file.Name)"
}
