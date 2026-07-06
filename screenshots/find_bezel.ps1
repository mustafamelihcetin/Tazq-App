Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Image]::FromFile("d:\Tazq-App\screenshots\1.jpg")
$bmp = New-Object System.Drawing.Bitmap($img)

# Let's sample a few rows to find where the dark phone bezel starts
# The background is gradient, the phone bezel is very dark (almost black)
# We will scan down the middle of the image to find the top of the phone bezel

$midX = [int]($bmp.Width / 2)
$bezelTop = -1
for ($y = 400; $y -lt 1500; $y++) {
    $color = $bmp.GetPixel($midX, $y)
    # The bezel is dark, usually R<30, G<30, B<30
    if ($color.R -lt 30 -and $color.G -lt 30 -and $color.B -lt 30) {
        $bezelTop = $y
        break
    }
}

$bezelBottom = -1
for ($y = $bmp.Height - 100; $y -gt 1500; $y--) {
    $color = $bmp.GetPixel($midX, $y)
    if ($color.R -lt 30 -and $color.G -lt 30 -and $color.B -lt 30) {
        $bezelBottom = $y
        break
    }
}

$bezelLeft = -1
$midY = [int](($bezelTop + $bezelBottom) / 2)
for ($x = 100; $x -lt $midX; $x++) {
    $color = $bmp.GetPixel($x, $midY)
    if ($color.R -lt 30 -and $color.G -lt 30 -and $color.B -lt 30) {
        $bezelLeft = $x
        break
    }
}

$bezelRight = -1
for ($x = $bmp.Width - 100; $x -gt $midX; $x--) {
    $color = $bmp.GetPixel($x, $midY)
    if ($color.R -lt 30 -and $color.G -lt 30 -and $color.B -lt 30) {
        $bezelRight = $x
        break
    }
}

Write-Host "Bezel Top: $bezelTop"
Write-Host "Bezel Bottom: $bezelBottom"
Write-Host "Bezel Left: $bezelLeft"
Write-Host "Bezel Right: $bezelRight"

$bmp.Dispose()
$img.Dispose()
