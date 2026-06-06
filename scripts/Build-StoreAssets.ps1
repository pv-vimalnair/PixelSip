Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$icons = Join-Path $root "extension\icons"
$assets = Join-Path $root "assets"
$navy = [System.Drawing.Color]::FromArgb(23, 32, 51)
$muted = [System.Drawing.Color]::FromArgb(102, 112, 133)
$paper = [System.Drawing.Color]::FromArgb(243, 247, 248)
$panel = [System.Drawing.Color]::FromArgb(251, 250, 245)
$blue = [System.Drawing.Color]::FromArgb(22, 189, 232)
$line = [System.Drawing.Color]::FromArgb(204, 211, 220)

function New-Canvas([int]$width, [int]$height) {
    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear($paper)
    return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Draw-Text($graphics, $text, $font, $brush, $x, $y) {
    $graphics.DrawString($text, $font, $brush, [float]$x, [float]$y)
}

function Draw-Image($graphics, $name, $x, $y, $width, $height) {
    $image = [System.Drawing.Image]::FromFile((Join-Path $icons $name))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.DrawImage($image, $x, $y, $width, $height)
    $image.Dispose()
}

$navyBrush = New-Object System.Drawing.SolidBrush($navy)
$mutedBrush = New-Object System.Drawing.SolidBrush($muted)
$panelBrush = New-Object System.Drawing.SolidBrush($panel)
$blueBrush = New-Object System.Drawing.SolidBrush($blue)
$linePen = New-Object System.Drawing.Pen($line, 2)
$navyPen = New-Object System.Drawing.Pen($navy, 3)

$screenshot = New-Canvas 1280 800
$g = $screenshot.Graphics
Draw-Image $g "icon128.png" 82 105 72 72
Draw-Text $g "PIXELSIP" (New-Object System.Drawing.Font("Consolas", 22, [System.Drawing.FontStyle]::Bold)) $navyBrush 175 120
Draw-Text $g "A QUIET HYDRATION REMINDER" (New-Object System.Drawing.Font("Consolas", 11, [System.Drawing.FontStyle]::Bold)) $mutedBrush 82 250
Draw-Text $g "Watch the glass." (New-Object System.Drawing.Font("Consolas", 43, [System.Drawing.FontStyle]::Bold)) $navyBrush 76 286
Draw-Text $g "Take the sip." (New-Object System.Drawing.Font("Consolas", 43, [System.Drawing.FontStyle]::Bold)) $navyBrush 76 350
Draw-Text $g "A tiny pixel glass drains in your Chrome toolbar," (New-Object System.Drawing.Font("Arial", 16)) $mutedBrush 82 448
Draw-Text $g "then gently reminds you when it is time to drink water." (New-Object System.Drawing.Font("Arial", 16)) $mutedBrush 82 477

$flowX = 85
foreach ($asset in @("glass-100.png", "glass-50.png", "glass-0.png", "glass-alert.png")) {
    Draw-Image $g $asset $flowX 550 52 52
    $flowX += 105
    if ($flowX -lt 470) {
        Draw-Text $g ">" (New-Object System.Drawing.Font("Consolas", 18, [System.Drawing.FontStyle]::Bold)) $blueBrush ($flowX - 42) 562
    }
}

$g.FillRectangle($navyBrush, 858, 133, 354, 436)
$g.FillRectangle($panelBrush, 846, 121, 354, 436)
$g.DrawRectangle($navyPen, 846, 121, 354, 436)
Draw-Image $g "icon32.png" 870 146 30 30
Draw-Text $g "PIXELSIP" (New-Object System.Drawing.Font("Consolas", 8, [System.Drawing.FontStyle]::Bold)) $mutedBrush 912 143
Draw-Text $g "Next drink" (New-Object System.Drawing.Font("Consolas", 13, [System.Drawing.FontStyle]::Bold)) $navyBrush 912 159
$g.FillRectangle([System.Drawing.Brushes]::White, 868, 204, 310, 166)
$g.DrawRectangle($linePen, 868, 204, 310, 166)
Draw-Image $g "glass-75.png" 895 230 100 100
Draw-Text $g "42:18" (New-Object System.Drawing.Font("Consolas", 25, [System.Drawing.FontStyle]::Bold)) $navyBrush 1022 245
Draw-Text $g "Glass drains as" (New-Object System.Drawing.Font("Arial", 10)) $mutedBrush 1024 291
Draw-Text $g "the hour passes" (New-Object System.Drawing.Font("Arial", 10)) $mutedBrush 1024 308
$g.FillRectangle($blueBrush, 868, 392, 310, 48)
$g.DrawRectangle($navyPen, 868, 392, 310, 48)
Draw-Text $g "I drank water" (New-Object System.Drawing.Font("Consolas", 11, [System.Drawing.FontStyle]::Bold)) $navyBrush 966 407
Draw-Text $g "Quiet hours  10 PM - 7 AM" (New-Object System.Drawing.Font("Arial", 9)) $mutedBrush 868 475

$screenshot.Bitmap.Save((Join-Path $assets "screenshot-1280x800.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$screenshot.Graphics.Dispose()
$screenshot.Bitmap.Dispose()

$promo = New-Canvas 440 280
$g = $promo.Graphics
$g.FillRectangle($navyBrush, 300, 0, 140, 280)
Draw-Image $g "icon128.png" 42 40 74 74
Draw-Text $g "PIXELSIP" (New-Object System.Drawing.Font("Consolas", 22, [System.Drawing.FontStyle]::Bold)) $navyBrush 132 58
Draw-Text $g "Watch the glass." (New-Object System.Drawing.Font("Consolas", 17, [System.Drawing.FontStyle]::Bold)) $navyBrush 42 142
Draw-Text $g "Take the sip." (New-Object System.Drawing.Font("Consolas", 17, [System.Drawing.FontStyle]::Bold)) $navyBrush 42 171
Draw-Text $g "A quiet hourly water reminder." (New-Object System.Drawing.Font("Arial", 10)) $mutedBrush 43 218
Draw-Image $g "glass-100.png" 330 28 78 78
Draw-Image $g "glass-50.png" 330 103 78 78
Draw-Image $g "glass-alert.png" 330 178 78 78
$promo.Bitmap.Save((Join-Path $assets "promo-440x280.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$promo.Graphics.Dispose()
$promo.Bitmap.Dispose()

$navyBrush.Dispose()
$mutedBrush.Dispose()
$panelBrush.Dispose()
$blueBrush.Dispose()
$linePen.Dispose()
$navyPen.Dispose()

Write-Host "Store assets created."
