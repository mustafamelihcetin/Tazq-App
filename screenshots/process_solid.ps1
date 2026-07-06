Add-Type -AssemblyName System.Drawing
$outDir = 'd:\Tazq-App\screenshots\ipad_solid'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$files = Get-ChildItem -Path 'd:\Tazq-App\screenshots' -Filter '*.jpg'

foreach ($file in $files) {
    if ($file.Name -like 'ipad_*') { continue }
    $img = [System.Drawing.Image]::FromFile($file.FullName)
    
    $ipadBmp = New-Object System.Drawing.Bitmap(2048, 2732)
    $g = [System.Drawing.Graphics]::FromImage($ipadBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    # Get a solid background color from the very top center of the image
    $solidColor = $img.GetPixel([int]($img.Width / 2), 5)
    $g.Clear($solidColor)
    
    $targetH = 2458
    $targetW = [int]($img.Width * (2458.0 / $img.Height))
    $x = [int]((2048 - $targetW) / 2)
    $y = [int]((2732 - $targetH) / 2)
    
    # Draw original image
    $g.DrawImage($img, $x, $y, $targetW, $targetH)
    
    $outPath = Join-Path $outDir ('ipad_solid_' + $file.Name)
    $ipadBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    $g.Dispose()
    $ipadBmp.Dispose()
    $img.Dispose()
    
    Write-Host "Processed solid background for $($file.Name)"
}
