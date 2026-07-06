Add-Type -AssemblyName System.Drawing
$outDir = 'd:\Tazq-App\screenshots\ipad_pure'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$files = Get-ChildItem -Path 'd:\Tazq-App\screenshots' -Filter '*.jpg'

$code = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
public class Gfx3 {
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
    
    $ipadBmp = New-Object System.Drawing.Bitmap(2048, 2732)
    $g = [System.Drawing.Graphics]::FromImage($ipadBmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    # 1. Background Gradient (Sampling top and bottom colors)
    $topColor = $bmp.GetPixel([int]($img.Width / 2), 10)
    $bottomColor = $bmp.GetPixel([int]($img.Width / 2), $img.Height - 10)
    $rect = New-Object System.Drawing.Rectangle(0, 0, 2048, 2732)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $topColor, $bottomColor, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillRectangle($bgBrush, $rect)
    
    # 2. Extract and draw the Text Area (Top part of original image)
    # The text usually ends around y=700 in the 1290x2796 image
    $textSrcRect = New-Object System.Drawing.Rectangle(0, 0, $img.Width, 720)
    $textScale = 2048.0 / $img.Width
    $textH = [int]($textSrcRect.Height * $textScale)
    $textDestRect = New-Object System.Drawing.Rectangle(0, 0, 2048, $textH)
    $g.DrawImage($img, $textDestRect, 0, 0, $textSrcRect.Width, $textSrcRect.Height, [System.Drawing.GraphicsUnit]::Pixel)
    
    # To blend the text area smoothly into the background, we can draw a gradient fade at the bottom of the text area
    $fadeRect = New-Object System.Drawing.Rectangle(0, $textH - 100, 2048, 100)
    $fadeTopColor = [System.Drawing.Color]::FromArgb(0, $topColor.R, $topColor.G, $topColor.B)
    $fadeBottomColor = [System.Drawing.Color]::FromArgb(255, $topColor.R, $topColor.G, $topColor.B) # Roughly the color at this height
    # Actually, the background is already drawing the gradient, so if the text area background matches the top color, it blends naturally!
    
    # 3. Extract the inner screen UI (No phone bezel)
    # The screen bounds found earlier: 234, 778, 710, 1522
    $screenW = 710
    $screenH = 1522
    
    # Calculate target dimensions for the UI
    # We have space from Y = $textH (around 1140) to 2732. Space = 1592.
    # We want it to be large and prominent. Let's make the height 1400.
    $targetUI_H = 1450
    $targetUI_W = [int]($screenW * ($targetUI_H / $screenH))
    
    $uiX = [int]((2048 - $targetUI_W) / 2)
    $uiY = $textH + [int]((2732 - $textH - $targetUI_H) / 2) + 20
    
    $uiRect = New-Object System.Drawing.Rectangle($uiX, $uiY, $targetUI_W, $targetUI_H)
    
    # Drop Shadow for UI
    $shadowRect = New-Object System.Drawing.Rectangle($uiX + 20, $uiY + 30, $targetUI_W, $targetUI_H)
    $shadowPath = [Gfx3]::GetRoundedRect($shadowRect, 60)
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(100, 0, 0, 0))
    $g.FillPath($shadowBrush, $shadowPath)
    
    # Draw UI with rounded corners (because iPhones have rounded screens, and it looks better floating)
    $uiRadius = 60
    $uiPath = [Gfx3]::GetRoundedRect($uiRect, $uiRadius)
    
    $g.SetClip($uiPath)
    $g.DrawImage($img, $uiRect, 234, 778, 710, 1522, [System.Drawing.GraphicsUnit]::Pixel)
    $g.ResetClip()
    
    # Draw a very thin subtle border around the UI to define it
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40, 255, 255, 255), 2)
    $g.DrawPath($borderPen, $uiPath)
    
    $outPath = Join-Path $outDir ('ipad_pure_' + $file.Name)
    $ipadBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    $borderPen.Dispose()
    $shadowBrush.Dispose()
    $bgBrush.Dispose()
    $g.Dispose()
    $ipadBmp.Dispose()
    $bmp.Dispose()
    $img.Dispose()
    
    Write-Host "Processed pure UI mockup $($file.Name)"
}
