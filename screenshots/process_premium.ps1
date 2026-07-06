Add-Type -AssemblyName System.Drawing
$outDir = 'd:\Tazq-App\screenshots\ipad_premium'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$files = Get-ChildItem -Path 'd:\Tazq-App\screenshots' -Filter '*.jpg'

$code = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
public class Gfx {
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
# Ignore errors if type is already added
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
    
    $rect = New-Object System.Drawing.Rectangle(0, 0, 2048, 2732)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $topColor, $bottomColor, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillRectangle($bgBrush, $rect)
    
    $targetH = [int][math]::Floor(2732 * 0.78)
    $targetW = [int][math]::Floor($img.Width * ($targetH / $img.Height))
    
    $x = [int][math]::Floor((2048 - $targetW) / 2)
    $y = [int][math]::Floor((2732 - $targetH) / 2)
    
    $bezelPadding = 42
    $bezelRadius = 130
    $screenRadius = 90
    
    $bx = $x - $bezelPadding
    $by = $y - $bezelPadding
    $bw = $targetW + ($bezelPadding * 2)
    $bh = $targetH + ($bezelPadding * 2)
    $bezelRect = New-Object System.Drawing.Rectangle($bx, $by, $bw, $bh)
    $screenRect = New-Object System.Drawing.Rectangle($x, $y, $targetW, $targetH)
    
    $sx = $bezelRect.X + 25
    $sy = $bezelRect.Y + 40
    $shadowRect = New-Object System.Drawing.Rectangle($sx, $sy, $bw, $bh)
    $shadowPath = [Gfx]::GetRoundedRect($shadowRect, $bezelRadius)
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 0, 0, 0))
    $g.FillPath($shadowBrush, $shadowPath)
    
    $bezelPath = [Gfx]::GetRoundedRect($bezelRect, $bezelRadius)
    $bezelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 12, 12, 12))
    $g.FillPath($bezelBrush, $bezelPath)
    
    $g.SetClip([Gfx]::GetRoundedRect($screenRect, $screenRadius))
    $g.DrawImage($img, $x, $y, $targetW, $targetH)
    $g.ResetClip()
    
    $pillWidth = [int]($targetW * 0.3)
    $pillHeight = 70
    $pillX = $x + [int](($targetW - $pillWidth) / 2)
    $pillY = $y + 25
    $pillRect = New-Object System.Drawing.Rectangle($pillX, $pillY, $pillWidth, $pillHeight)
    $pillPath = [Gfx]::GetRoundedRect($pillRect, [int]($pillHeight/2))
    $g.FillPath($bezelBrush, $pillPath)
    
    $outPath = Join-Path $outDir ('ipad_premium_' + $file.Name)
    $ipadBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    $bgBrush.Dispose()
    $shadowBrush.Dispose()
    $bezelBrush.Dispose()
    $g.Dispose()
    $ipadBmp.Dispose()
    $bmp.Dispose()
    $img.Dispose()
    Write-Host "Processed premium $($file.Name)"
}
