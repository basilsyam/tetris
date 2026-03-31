$ErrorActionPreference = "Stop"

$UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
$CssUrl = "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap"
Write-Host "Fetching Google Fonts CSS from $CssUrl..."

$CssContent = Invoke-RestMethod -Uri $CssUrl -Headers @{ 'User-Agent' = $UserAgent }

if (-not (Test-Path -Path "d:\tetris\fonts")) {
    New-Item -ItemType Directory -Force -Path "d:\tetris\fonts" | Out-Null
    Write-Host "Created 'fonts' directory."
}

$Matches = [regex]::Matches($CssContent, 'url\((https://[^)]+)\)')

$i = 1
$CacheList = @()

foreach ($match in $Matches) {
    if ($match.Groups[1].Value) {
        $fontUrl = $match.Groups[1].Value
        $ext = ".woff2"
        $fileName = "tajawal_$i$ext"
        $localPath = "d:\tetris\fonts\$fileName"
        
        Write-Host "Downloading $fontUrl to $fileName..."
        Invoke-WebRequest -Uri $fontUrl -OutFile $localPath
        
        $CssContent = $CssContent.Replace($fontUrl, "./fonts/$fileName")
        $CacheList += "'./fonts/$fileName'"
        $i++
    }
}

$CssContent | Out-File -FilePath "d:\tetris\fonts.css" -Encoding utf8
Write-Host "Saved local CSS to fonts.css."
Write-Host "The following font files were downloaded:"
$CacheList -join ", " | Write-Host
