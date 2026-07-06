Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Image]::FromFile("d:\Tazq-App\screenshots\1.jpg")
$bmp = New-Object System.Drawing.Bitmap($img)

$cropRect = New-Object System.Drawing.Rectangle(200, 950, 890, 1700)
$cropped = $bmp.Clone($cropRect, $bmp.PixelFormat)
$cropped.Save("d:\Tazq-App\screenshots\test_crop.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)

$cropped.Dispose()
$bmp.Dispose()
$img.Dispose()
