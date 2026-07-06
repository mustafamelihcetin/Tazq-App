Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Image]::FromFile("d:\Tazq-App\screenshots\1.jpg")
$bmp = New-Object System.Drawing.Bitmap($img)

$midX = [int]($bmp.Width / 2)
$midY = [int]( (753 + 2325) / 2 )

$screenTop = -1
for ($y = 753; $y -lt $midY; $y++) {
    $color = $bmp.GetPixel($midX, $y)
    # The screen is lighter or colored, or at least not pure black bezel
    # But wait, dark mode app has dark background too.
    # Let's check for a sudden change in color from the bezel.
    # We can just use a fixed offset. Most mockups have a uniform bezel width.
}

# The bezel is 760x1572. iPhone 14 Pro aspect ratio is 1170x2532 (0.462). 
# 760 / 1572 = 0.483, which includes the bezel.
# Let's just use a fixed offset of 25 pixels from the bezel edge.
$screenLeft = 209 + 25
$screenRight = 969 - 25
$screenTop = 753 + 25
$screenBottom = 2325 - 25

Write-Host "Screen Rect: $screenLeft, $screenTop, $($screenRight - $screenLeft), $($screenBottom - $screenTop)"
$bmp.Dispose()
$img.Dispose()
