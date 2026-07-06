Add-Type -AssemblyName System.Drawing
$outDir = 'd:\Tazq-App\screenshots\ipad'

$files = Get-ChildItem -Path 'd:\Tazq-App\screenshots' -Filter '*.jpg'
foreach ($file in $files) {
    if ($file.Name -like 'ipad_*') { continue }
    $img = [System.Drawing.Image]::FromFile($file.FullName)
    
    $ipadBmp = New-Object System.Drawing.Bitmap(2048, 2732)
    $g = [System.Drawing.Graphics]::FromImage($ipadBmp)
    
    $w = [int]$img.Width
    $h = [int]$img.Height
    $targetH = [int][math]::Floor(2732 * 0.90)
    $targetW = [int][math]::Floor($w * ($targetH / $h))
    
    $x = [int][math]::Floor((2048 - $targetW) / 2)
    $y = [int][math]::Floor((2732 - $targetH) / 2)
    
    # Left edge
    $dstLeft = New-Object System.Drawing.Rectangle(0, $y, $x, $targetH)
    $g.DrawImage($img, $dstLeft, 0, 0, 1, $h, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Right edge
    $dstRight = New-Object System.Drawing.Rectangle($x + $targetW, $y, 2048 - ($x + $targetW), $targetH)
    $g.DrawImage($img, $dstRight, $w - 1, 0, 1, $h, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Top edge
    $dstTop = New-Object System.Drawing.Rectangle($x, 0, $targetW, $y)
    $g.DrawImage($img, $dstTop, 0, 0, $w, 1, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Bottom edge
    $dstBottom = New-Object System.Drawing.Rectangle($x, $y + $targetH, $targetW, 2732 - ($y + $targetH))
    $g.DrawImage($img, $dstBottom, 0, $h - 1, $w, 1, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Top Left Corner
    $dstTL = New-Object System.Drawing.Rectangle(0, 0, $x, $y)
    $g.DrawImage($img, $dstTL, 0, 0, 1, 1, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Top Right Corner
    $dstTR = New-Object System.Drawing.Rectangle($x + $targetW, 0, 2048 - ($x + $targetW), $y)
    $g.DrawImage($img, $dstTR, $w - 1, 0, 1, 1, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Bottom Left Corner
    $dstBL = New-Object System.Drawing.Rectangle(0, $y + $targetH, $x, 2732 - ($y + $targetH))
    $g.DrawImage($img, $dstBL, 0, $h - 1, 1, 1, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Bottom Right Corner
    $dstBR = New-Object System.Drawing.Rectangle($x + $targetW, $y + $targetH, 2048 - ($x + $targetW), 2732 - ($y + $targetH))
    $g.DrawImage($img, $dstBR, $w - 1, $h - 1, 1, 1, [System.Drawing.GraphicsUnit]::Pixel)
    
    # Center Image
    $dstCenter = New-Object System.Drawing.Rectangle($x, $y, $targetW, $targetH)
    $g.DrawImage($img, $dstCenter, 0, 0, $w, $h, [System.Drawing.GraphicsUnit]::Pixel)
    
    $outPath = Join-Path $outDir ('ipad_' + $file.Name)
    $ipadBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    $g.Dispose()
    $ipadBmp.Dispose()
    $img.Dispose()
    Write-Host "Processed $($file.Name) with seamless gradient"
}
