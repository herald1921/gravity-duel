param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$gameRoot = Split-Path -Parent $PSCommandPath
$gameUrl = 'http://127.0.0.1:4177/'
function Test-PlaytestReady {
    try {
        $response = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200 -and $response.Content -match 'v0.9 Playtest'
    } catch { return $false }
}
if (-not (Test-PlaytestReady)) {
    if (Get-NetTCPConnection -State Listen -LocalPort 4177 -ErrorAction SilentlyContinue) { throw 'Port 4177 is already in use. No process was stopped.' }
    $gameNodeCommand = Get-Command node -ErrorAction SilentlyContinue
    $gameNode = if ($gameNodeCommand) { $gameNodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
    if (-not (Test-Path -LiteralPath $gameNode)) { throw 'Node.js is required to run this local preview.' }
    if (-not (Test-Path -LiteralPath (Join-Path $gameRoot 'web-v0.9.0\index.html'))) { throw 'The playable build is missing.' }
    if (-not (Test-Path -LiteralPath (Join-Path $gameRoot 'qa'))) { New-Item -ItemType Directory -Path (Join-Path $gameRoot 'qa') | Out-Null }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $gameServer = Start-Process -FilePath $gameNode -ArgumentList ('"' + (Join-Path $gameRoot 'serve-playtest.cjs') + '"') -WorkingDirectory $gameRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $gameRoot "qa\preview-$stamp.log") -RedirectStandardError (Join-Path $gameRoot "qa\preview-$stamp.error.log") -PassThru
    for ($attempt = 0; $attempt -lt 25; $attempt++) {
        Start-Sleep -Milliseconds 200
        if (Test-PlaytestReady) { break }
        if ($gameServer.HasExited) { throw 'Preview server stopped. See the qa folder logs.' }
    }
    if (-not (Test-PlaytestReady)) { throw 'Preview is starting slowly. Try opening http://127.0.0.1:4177/ again.' }
}
Write-Output "Gravity Duel v0.9 is ready: $gameUrl"
if (-not $NoBrowser) { Start-Process $gameUrl }
