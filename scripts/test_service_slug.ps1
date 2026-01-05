$ErrorActionPreference = 'Stop'

# Public fetch
Write-Output '--- GET /api/services/suit WITHOUT AUTH ---'
try {
  $public = Invoke-RestMethod -Uri 'http://localhost:4000/api/services/suit' -Method Get
  $public | ConvertTo-Json -Depth 6
} catch {
  Write-Output "Public fetch failed: $($_.Exception.Message)"
}

# Provider fetch
Write-Output '--- PROVIDER SIGNIN ---'
$prov = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/signin' -Method Post -ContentType 'application/json' -Body '{"email":"sarangerita4@gmail.com","password":"Test@123"}'
$prov | ConvertTo-Json -Depth 4

Write-Output '--- GET /api/services/suit WITH PROVIDER AUTH ---'
$hdr = @{ Authorization = "Bearer $($prov.accessToken)" }
try {
  $auth = Invoke-RestMethod -Uri 'http://localhost:4000/api/services/suit' -Method Get -Headers $hdr
  $auth | ConvertTo-Json -Depth 6
} catch {
  Write-Output "Authenticated fetch failed: $($_.Exception.Message)"
}
