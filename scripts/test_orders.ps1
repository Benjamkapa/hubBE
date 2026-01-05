$ErrorActionPreference = 'Stop'

# Provider signin
$prov = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/signin' -Method Post -ContentType 'application/json' -Body '{"email":"sarangerita4@gmail.com","password":"Test@123"}'
Write-Output '--- PROVIDER SIGNIN RESPONSE ---'
$prov | ConvertTo-Json -Depth 5

Write-Output '--- PROVIDER ORDERS (GET /api/orders) ---'
$ordersProv = Invoke-RestMethod -Uri 'http://localhost:4000/api/orders' -Method Get -Headers @{ Authorization = "Bearer $($prov.accessToken)" }
$ordersProv | ConvertTo-Json -Depth 6

# Admin signin
Write-Output '--- ADMIN SIGNIN RESPONSE ---'
$adm = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/signin' -Method Post -ContentType 'application/json' -Body '{"email":"admin@hudumahub.com","password":"fortjesus-G2"}'
$adm | ConvertTo-Json -Depth 5

Write-Output '--- ADMIN ORDERS (GET /api/orders) ---'
$ordersAdm = Invoke-RestMethod -Uri 'http://localhost:4000/api/orders' -Method Get -Headers @{ Authorization = "Bearer $($adm.accessToken)" }
$ordersAdm | ConvertTo-Json -Depth 6
