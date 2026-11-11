# Bat DevTools cho Claude Desktop: ghi "allowDevTools": true vao developer_settings.json.
# Khong tai gi tu mang, khong sua gi khac. -Root chi dung de thu nghiem.
param([string]$Root = '')

$dirs = @()
if ($Root) {
  $dirs += $Root
} else {
  $a = Join-Path $env:APPDATA 'Claude'
  if (Test-Path $a) { $dirs += $a }
  $b = Join-Path $env:LOCALAPPDATA 'Claude-Data'
  if (Test-Path $b) { $dirs += (Get-ChildItem $b -Directory | ForEach-Object { $_.FullName }) }
}

if (-not $dirs) {
  Write-Host 'Khong tim thay thu muc du lieu cua Claude Desktop.'
  Write-Host 'Hay mo Claude Desktop it nhat mot lan roi chay lai file nay.'
  exit 1
}

foreach ($d in $dirs) {
  $f = Join-Path $d 'developer_settings.json'
  $o = [ordered]@{}
  if (Test-Path $f) {
    try {
      (Get-Content $f -Raw | ConvertFrom-Json).psobject.Properties | ForEach-Object { $o[$_.Name] = $_.Value }
    } catch {
      Copy-Item $f "$f.bak" -Force
      Write-Host "File cu khong doc duoc, da luu ban sao: $f.bak"
    }
  }
  $o['allowDevTools'] = $true
  [IO.File]::WriteAllText($f, ($o | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
  Write-Host "Da bat DevTools: $f"
}

Write-Host ''
Write-Host 'Xong. Thoat han Claude Desktop (ca bieu tuong o khay he thong) roi mo lai.'
