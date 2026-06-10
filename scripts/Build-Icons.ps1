Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$icons = Join-Path $root "extension\icons"

function Set-Pixel($graphics, $brush, [int]$x, [int]$y, [int]$width = 1, [int]$height = 1) {
    $graphics.FillRectangle($brush, $x, $y, $width, $height)
}

function New-PixelGlass([double]$ratio, [string]$state = "running") {
    $bitmap = New-Object System.Drawing.Bitmap 16, 16
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $inkColor = if ($state -eq "quiet") {
        [System.Drawing.Color]::FromArgb(104, 113, 128)
    } else {
        [System.Drawing.Color]::FromArgb(15, 23, 32)
    }
    $ink = New-Object System.Drawing.SolidBrush($inkColor)
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $water = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(66, 183, 226))
    $waterDark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(42, 158, 204))
    $highlight = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(232, 252, 255))
    $amber = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 181, 37))
    $shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(199, 205, 210))

    # Match the screenshot's handleless, slightly tapered drinking glass.
    Set-Pixel $graphics $shadow 12 4 1 8
    Set-Pixel $graphics $shadow 5 13
    Set-Pixel $graphics $shadow 11 13
    Set-Pixel $graphics $shadow 6 14 5 1
    Set-Pixel $graphics $white 4 3 8 8
    Set-Pixel $graphics $white 5 11 6 1
    Set-Pixel $graphics $ink 4 2 8 1
    Set-Pixel $graphics $ink 3 3 1 8
    Set-Pixel $graphics $ink 12 3 1 8
    Set-Pixel $graphics $ink 4 11 1 2
    Set-Pixel $graphics $ink 11 11 1 2
    Set-Pixel $graphics $ink 5 13 6 1

    if ($state -eq "alert") {
        Set-Pixel $graphics $amber 1 5
        Set-Pixel $graphics $amber 2 6
        Set-Pixel $graphics $amber 1 8
        Set-Pixel $graphics $amber 14 4
        Set-Pixel $graphics $amber 15 6
        Set-Pixel $graphics $amber 14 8
    } elseif ($state -eq "quiet") {
        Set-Pixel $graphics $ink 6 6
        Set-Pixel $graphics $ink 7 5
        Set-Pixel $graphics $ink 8 4
    } else {
        $rows = [Math]::Min(8, [Math]::Max(0, [Math]::Round($ratio * 8)))
        if ($rows -gt 0) {
            $top = 12 - $rows
            if ($top -lt 11) {
                Set-Pixel $graphics $water 4 $top 8 ([Math]::Min($rows, 11 - $top))
            }
            if ($top + $rows -gt 11) {
                Set-Pixel $graphics $water 5 11 6 1
            }
            Set-Pixel $graphics $waterDark 5 11 6 1
            Set-Pixel $graphics $highlight 5 $top 3 1
            Set-Pixel $graphics $highlight 5 ($top + 1) 1 1
        }
    }

    foreach ($item in @($ink, $white, $water, $waterDark, $highlight, $amber, $shadow)) {
        $item.Dispose()
    }
    $graphics.Dispose()
    return $bitmap
}

function Save-ScaledIcon($source, [int]$size, [string]$name) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.DrawImage($source, 0, 0, $size, $size)
    $bitmap.Save((Join-Path $icons $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
}

$full = New-PixelGlass 1
foreach ($size in @(16, 32, 48, 128)) {
    Save-ScaledIcon $full $size "icon$size.png"
}
$full.Dispose()

$states = @{
    "glass-0.png" = @{ Ratio = 0; State = "running" }
    "glass-25.png" = @{ Ratio = 0.25; State = "running" }
    "glass-50.png" = @{ Ratio = 0.5; State = "running" }
    "glass-75.png" = @{ Ratio = 0.75; State = "running" }
    "glass-100.png" = @{ Ratio = 1; State = "running" }
    "glass-alert.png" = @{ Ratio = 0; State = "alert" }
    "glass-quiet.png" = @{ Ratio = 0; State = "quiet" }
}

foreach ($name in $states.Keys) {
    $source = New-PixelGlass $states[$name].Ratio $states[$name].State
    Save-ScaledIcon $source 128 $name
    $source.Dispose()
}

Write-Host "PixelSip reference-style icons created."
