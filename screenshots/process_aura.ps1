Add-Type -AssemblyName System.Drawing
$outDir = 'd:\Tazq-App\screenshots\ipad_aura'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$files = Get-ChildItem -Path 'd:\Tazq-App\screenshots' -Filter '*.jpg'

foreach ($file in $files) {
    if ($file.Name -like 'ipad_*') { continue }
    $img = [System.Drawing.Image]::FromFile($file.FullName)
    
    $ipadBmp = New-Object System.Drawing.Bitmap(2048, 2732)
    $g = [System.Drawing.Graphics]::FromImage($ipadBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    # --- FLAWLESS BLUR TECHNIQUE ---
    # Step 1: Shrink to 100x200
    $smallBmp = New-Object System.Drawing.Bitmap(100, 200)
    $gSmall = [System.Drawing.Graphics]::FromImage($smallBmp)
    $gSmall.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gSmall.DrawImage($img, 0, 0, 100, 200)
    $gSmall.Dispose()
    
    # Step 2: Scale 100x200 to 500x1000 to smooth out pixels
    $medBmp = New-Object System.Drawing.Bitmap(500, 1000)
    $gMed = [System.Drawing.Graphics]::FromImage($medBmp)
    $gMed.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gMed.DrawImage($smallBmp, 0, 0, 500, 1000)
    $gMed.Dispose()
    
    # Step 3: Draw the 500x1000 beautifully blurred image onto the massive canvas
    # We draw it slightly larger than canvas (-100 to 2248) to avoid edge clipping artifacts
    $g.DrawImage($medBmp, -100, -100, 2248, 2932)
    
    # --- CENTER ORIGINAL IMAGE ---
    $targetH = [int](2732 * 0.90)
    $targetW = [int]($img.Width * ($targetH / $img.Height))
    $x = [int]((2048 - $targetW) / 2)
    $y = [int]((2732 - $targetH) / 2)
    
    # --- SIMPLE NO-BUG DROP SHADOW ---
    # We will draw a few semi-transparent black rectangles with increasing size
    # This creates a soft shadow without relying on complex path logic that crashed earlier
    for ($i = 0; $i -lt 15; $i++) {
        $alpha = [int](25 - ($i * 1.5))
        if ($alpha -lt 0) { $alpha = 0 }
        $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($alpha, 0, 0, 0))
        $sx = $x - $i + 15
        $sy = $y - $i + 25
        $sw = $targetW + ($i * 2)
        $sh = $targetH + ($i * 2)
        $g.FillRectangle($shadowBrush, $sx, $sy, $sw, $sh)
        $shadowBrush.Dispose()
    }
    
    # --- DRAW ORIGINAL IMAGE ---
    $g.DrawImage($img, $x, $y, $targetW, $targetH)
    
    $outPath = Join-Path $outDir ('ipad_aura_' + $file.Name)
    $ipadBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    $smallBmp.Dispose()
    $medBmp.Dispose()
    $g.Dispose()
    $ipadBmp.Dispose()
    $img.Dispose()
    
    Write-Host "Processed flawless aura for $($file.Name)"
}
