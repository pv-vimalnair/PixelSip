$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$extension = Join-Path $root "extension"
$output = Join-Path $root "PixelSip-store-v1.2.1.zip"
$filePatterns = @("audio\*.mp3", "icons\*.png", "manifest.json", "offscreen.html", "offscreen.js", "popup.css", "popup.html", "popup.js", "service-worker.js")

if (Test-Path $output) {
    Remove-Item -LiteralPath $output
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($output, [System.IO.Compression.ZipArchiveMode]::Create)
foreach ($pattern in $filePatterns) {
    Get-ChildItem -Path (Join-Path $extension $pattern) -File | ForEach-Object {
        $entryName = $_.FullName.Substring($extension.Length + 1)
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $entryName) | Out-Null
    }
}
$archive.Dispose()

Write-Host "Store package created at $output"
