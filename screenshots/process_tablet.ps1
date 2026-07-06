Add-Type -AssemblyName System.Drawing
$outDir = 'd:\Tazq-App\screenshots\ipad_tablet_mockup'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$files = Get-ChildItem -Path 'd:\Tazq-App\screenshots' -Filter '*.jpg'

$code = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
public class Gfx2 {
    public static GraphicsPath GetRoundedRect(Rectangle bounds, int radius) {
        int diameter = radius * 2;
        Size size = new Size(diameter, diameter);
        Rectangle arc = new Rectangle(bounds.Location, size);
        GraphicsPath path = new GraphicsPath();
        if (radius == 0) {
            path.AddRectangle(bounds);
            return path;
        }
        path.AddArc(arc, 180, 90);
        arc.X = bounds.Right - diameter;
        path.AddArc(arc, 270, 90);
        arc.Y = bounds.Bottom - diameter;
        path.AddArc(arc, 0, 90);
        arc.X = bounds.Left;
        path.AddArc(arc, 90, 90);
        path.CloseFigure();
        return path;
    }
}
"@
try { Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing -ErrorAction SilentlyContinue } catch {}

foreach ($file in $files) {
    if ($file.Name -like 'ipad_*') { continue }
    $img = [System.Drawing.Image]::FromFile($file.FullName)
    $bmp = New-Object System.Drawing.Bitmap($img)
    
    $topColor = $bmp.GetPixel([int]($img.Width / 2), 10)
    $bottomColor = $bmp.GetPixel([int]($img.Width / 2), $img.Height - 10)
    
    $ipadBmp = New-Object System.Drawing.Bitmap(2048, 2732)
    $g = [System.Drawing.Graphics]::FromImage($ipadBmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    # Background of the whole image (App Store Canvas) - let's make it a subtle dark background
    $g.Clear([System.Drawing.Color]::FromArgb(255, 20, 20, 22))
    
    # iPad Dimensions
    $padW = 1750
    $padH = 2450
    $padX = [int][math]::Floor((2048 - $padW) / 2)
    $padY = [int][math]::Floor((2732 - $padH) / 2)
    $padRadius = 140
    $bezelThickness = 65
    
    $padRect = New-Object System.Drawing.Rectangle($padX, $padY, $padW, $padH)
    
    # Drop Shadow for iPad
    $shadowRect = New-Object System.Drawing.Rectangle($padRect.X + 20, $padRect.Y + 30, $padRect.Width, $padRect.Height)
    $shadowPath = [Gfx2]::GetRoundedRect($shadowRect, $padRadius)
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 0, 0, 0))
    $g.FillPath($shadowBrush, $shadowPath)
    
    # iPad Bezel (Black)
    $bezelPath = [Gfx2]::GetRoundedRect($padRect, $padRadius)
    $bezelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 12, 12, 12))
    $g.FillPath($bezelBrush, $bezelPath)
    
    # iPad Screen
    $screenX = $padX + $bezelThickness
    $screenY = $padY + $bezelThickness
    $screenW = $padW - ($bezelThickness * 2)
    $screenH = $padH - ($bezelThickness * 2)
    $screenRadius = 80
    $screenRect = New-Object System.Drawing.Rectangle($screenX, $screenY, $screenW, $screenH)
    
    $screenPath = [Gfx2]::GetRoundedRect($screenRect, $screenRadius)
    $screenBgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($screenRect, $topColor, $bottomColor, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    
    # Draw Screen Background
    $g.FillPath($screenBgBrush, $screenPath)
    
    # Draw Front Camera (TrueDepth on iPad Pro) on the top bezel
    $camSize = 14
    $camX = $padX + [int]($padW / 2) - [int]($camSize / 2)
    $camY = $padY + [int]($bezelThickness / 2) - [int]($camSize / 2)
    $camBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 30, 30, 30))
    $g.FillEllipse($camBrush, $camX, $camY, $camSize, $camSize)
    
    # Place original app image inside the screen
    # Since it's an iPhone app running on iPad, we center it.
    $targetH = [int][math]::Floor($screenH * 0.90)
    $targetW = [int][math]::Floor($img.Width * ($targetH / $img.Height))
    $imgX = $screenX + [int][math]::Floor(($screenW - $targetW) / 2)
    $imgY = $screenY + [int][math]::Floor(($screenH - $targetH) / 2)
    
    # Clip to screen corners just in case (though it's centered)
    $g.SetClip($screenPath)
    $g.DrawImage($img, $imgX, $imgY, $targetW, $targetH)
    $g.ResetClip()
    
    $outPath = Join-Path $outDir ('ipad_tablet_' + $file.Name)
    $ipadBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    $screenBgBrush.Dispose()
    $shadowBrush.Dispose()
    $bezelBrush.Dispose()
    $camBrush.Dispose()
    $g.Dispose()
    $ipadBmp.Dispose()
    $bmp.Dispose()
    $img.Dispose()
    Write-Host "Processed tablet mockup $($file.Name)"
}
