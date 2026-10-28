# Fills lat/lon of every spot in jeju_spots.json using the Kakao Local keyword search.
# The REST API key is read from the KAKAO_REST_KEY environment variable (never write it in a file).
# Re-running skips spots that already have lat/lon, so it can be resumed.
$ErrorActionPreference = 'Stop'
$key = $env:KAKAO_REST_KEY
if (-not $key) { throw 'Set KAKAO_REST_KEY first.' }

$root = Split-Path $PSScriptRoot -Parent
$jsonPath = Join-Path $root 'jeju_spots.json'
$reportPath = Join-Path $PSScriptRoot 'geocode_report.csv'
$utf8 = New-Object System.Text.UTF8Encoding $false

$data = [IO.File]::ReadAllText($jsonPath, $utf8) | ConvertFrom-Json

# Jeju island bounding box (lon,lat). Results outside it are rejected.
$minLon = 126.1; $maxLon = 127.0; $minLat = 33.1; $maxLat = 33.6
$rect = "$minLon,$minLat,$maxLon,$maxLat"

$report = @()
$done = 0; $missing = 0
foreach ($s in $data.spots) {
  if ($s.PSObject.Properties.Name -contains 'lat') { continue }
  $q = [uri]::EscapeDataString($s.name)
  $url = "https://dapi.kakao.com/v2/local/search/keyword.json?query=$q&rect=$rect&size=5"
  try {
    $r = Invoke-WebRequest -Uri $url -Headers @{ Authorization = "KakaoAK $key" } -UseBasicParsing
  } catch {
    Write-Host "Request failed at '$($s.name)': $($_.Exception.Message)"
    break   # stop (bad key / quota); progress so far is saved below
  }
  $body = $utf8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
  $hit = $body.documents | Select-Object -First 1
  if ($hit) {
    $s | Add-Member -NotePropertyName lat -NotePropertyValue ([math]::Round([double]$hit.y, 5))
    $s | Add-Member -NotePropertyName lon -NotePropertyValue ([math]::Round([double]$hit.x, 5))
    $report += [pscustomobject]@{ name = $s.name; place = $hit.place_name; address = $hit.address_name; lat = $hit.y; lon = $hit.x }
    $done++
  } else {
    $report += [pscustomobject]@{ name = $s.name; place = ''; address = 'NOT FOUND'; lat = ''; lon = '' }
    $missing++
  }
  Start-Sleep -Milliseconds 120
}

if ($done -gt 0) { [IO.File]::WriteAllText($jsonPath, ($data | ConvertTo-Json -Depth 6), $utf8) }
$report | Export-Csv -Path $reportPath -NoTypeInformation -Encoding UTF8
Write-Host "Found: $done, not found: $missing. Check $reportPath (compare 'name' with 'place')."
