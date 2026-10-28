# Builds restaurants.json: 20 restaurants per area (4 areas = 80) from the Kakao Local keyword search.
# The REST API key is read from the KAKAO_REST_KEY environment variable (never write it in a file).
$ErrorActionPreference = 'Stop'
$key = $env:KAKAO_REST_KEY
if (-not $key) { throw 'Set KAKAO_REST_KEY first.' }

$root = Split-Path $PSScriptRoot -Parent
$outPath = Join-Path $root 'restaurants.json'
$utf8 = New-Object System.Text.UTF8Encoding $false
$PER_AREA = 20

# rect = minLon,minLat,maxLon,maxLat (rough boxes around each area)
$areas = [ordered]@{
  '제주시' = '126.45,33.47,126.62,33.55'
  '동쪽'  = '126.78,33.38,126.97,33.56'
  '서쪽'  = '126.15,33.22,126.40,33.45'
  '서귀포' = '126.45,33.22,126.65,33.30'
}
# Several keywords so the 20 are not all the same kind of food (taken round-robin).
$queries = '흑돼지', '고기국수', '해산물', '갈치', '해장국', '횟집', '한식', '맛집'
$skip = '스타벅스|맥도날드|롯데리아|버거킹|KFC|맘스터치|파리바게뜨|뚜레쥬르|이디야|투썸|메가|컴포즈|빽다방|GS25|CU|세븐일레븐|서브웨이|도미노|피자헛'

function Search($query, $rect) {
  $q = [uri]::EscapeDataString($query)
  $url = "https://dapi.kakao.com/v2/local/search/keyword.json?query=$q&category_group_code=FD6&rect=$rect&size=15"
  $r = Invoke-WebRequest -Uri $url -Headers @{ Authorization = "KakaoAK $key" } -UseBasicParsing
  ($utf8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json).documents
}

$all = @()
foreach ($area in $areas.Keys) {
  $lists = @()
  foreach ($query in $queries) { $lists += , @(Search $query $areas[$area]); Start-Sleep -Milliseconds 150 }
  $picked = @(); $seen = @{}
  for ($rank = 0; $rank -lt 15 -and $picked.Count -lt $PER_AREA; $rank++) {
    foreach ($l in $lists) {
      if ($picked.Count -ge $PER_AREA) { break }
      $d = $l | Select-Object -Skip $rank -First 1
      if (-not $d -or $seen[$d.id] -or $d.place_name -match $skip) { continue }
      $seen[$d.id] = $true
      $cat = (($d.category_name -split ' > ') | Select-Object -Skip 1) -join ' · '
      $picked += [pscustomobject]@{
        name = $d.place_name; area = $area; category = $cat; address = $d.road_address_name
        lat = [math]::Round([double]$d.y, 5); lon = [math]::Round([double]$d.x, 5); url = $d.place_url
      }
    }
  }
  Write-Host "$area : $($picked.Count)"
  $all += $picked
}

$json = [pscustomobject]@{ note = 'Kakao Local search results (FD6). Not a ranking: opening hours / closures change, check before visiting.'; restaurants = $all } | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText($outPath, $json, $utf8)
Write-Host "Saved $($all.Count) restaurants to $outPath"
