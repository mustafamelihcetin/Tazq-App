Add-Type -AssemblyName System.Drawing
$outDir = 'd:\Tazq-App\screenshots\ipad'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$files = Get-ChildItem -Path 'd:\Tazq-App\screenshots' -Filter '*.jpg'
foreach ($file in $files) {
    if ($file.Name -like 'ipad_*') { continue }
    $img = [System.Drawing.Image]::FromFile($file.FullName)
    $bmp = New-Object System.Drawing.Bitmap($img)
    
    $ipadBmp = New-Object System.Drawing.Bitmap(2048, 2732)
    $g = [System.Drawing.Graphics]::FromImage($ipadBmp)
    
    # We want to scale the original image up slightly so it occupies a good portion of the iPad screen
    # e.g., let's make it 85% of the height
    $targetH = [math]::Floor(2732 * 0.90)
    $targetW = [math]::Floor($img.Width * ($targetH / $img.Height))
    
    $x = [math]::Floor((2048 - $targetW) / 2)
    $y = [math]::Floor((2732 - $targetH) / 2)
    
    # First, draw the center scaled image
    $destRectCenter = New-Object System.Drawing.Rectangle($x, $y, $targetW, $targetH)
    $g.DrawImage($img, $destRectCenter)
    
    # Left edge
    $srcRectLeft = New-Object System.Drawing.Rectangle(0, 0, 1, $img.Height)
    $destRectLeft = New-Object System.Drawing.Rectangle(0, $y, $x, $targetH)
    $g.DrawImage($img, $destRectLeft, $srcRectLeft, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Right edge
    $srcRectRight = New-Object System.Drawing.Rectangle($img.Width - 1, 0, 1, $img.Height)
    $destRectRight = New-Object System.Drawing.Rectangle($x + $targetW, $y, 2048 - ($x + $targetW), $targetH)
    $g.DrawImage($img, $destRectRight, $srcRectRight, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Top edge
    $srcRectTop = New-Object System.Drawing.Rectangle(0, 0, $img.Width, 1)
    $destRectTop = New-Object System.Drawing.Rectangle($x, 0, $targetW, $y)
    $g.DrawImage($img, $destRectTop, $srcRectTop, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Bottom edge
    $srcRectBottom = New-Object System.Drawing.Rectangle(0, $img.Height - 1, $img.Width, 1)
    $destRectBottom = New-Object System.Drawing.Rectangle($x, $y + $targetH, $targetW, 2732 - ($y + $targetH))
    $g.DrawImage($img, $destRectBottom, $srcRectBottom, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Top Left Corner
    $srcRectTL = New-Object System.Drawing.Rectangle(0, 0, 1, 1)
    $destRectTL = New-Object System.Drawing.Rectangle(0, 0, $x, $y)
    $g.DrawImage($img, $destRectTL, $srcRectTL, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Top Right Corner
    $srcRectTR = New-Object System.Drawing.Rectangle($img.Width - 1, 0, 1, 1)
    $destRectTR = New-Object System.Drawing.Rectangle($x + $targetW, 0, 2048 - ($x + $targetW), $y)
    $g.DrawImage($img, $destRectTR, $srcRectTR, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Bottom Left Corner
    $srcRectBL = New-Object System.Drawing.Rectangle(0, $img.Height - 1, 1, 1)
    $destRectBL = New-Object System.Drawing.Rectangle(0, $y + $targetH, $x, 2732 - ($y + $targetH))
    $g.DrawImage($img, $destRectBL, $srcRectBL, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Bottom Right Corner
    $srcRectBR = New-Object System.Drawing.Rectangle($img.Width - 1, $img.Height - 1, 1, 1)
    $destRectBR = New-Object System.Drawing.Rectangle($x + $targetW, $y + $targetH, 2048 - ($x + $targetW), 2732 - ($y + $targetH))
    $g.DrawImage($img, $destRectBR, $srcRectBR, [System.Drawing.GraphicsUnit]::Pixel)
    
    $outPath = Join-Path $outDir ('ipad_' + $file.Name)
    $ipadBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    $g.Dispose()
    $ipadBmp.Dispose()
    $bmp.Dispose()
    $img.Dispose()
    Write-Host "Processed $($file.Name) smoothly"
}
