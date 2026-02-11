# Porneste Time2Go din terminal (PowerShell / Cursor)
# Utilizare: .\run.ps1   sau   npm run dev
# 
# Pentru a schimba porturile, setează variabilele de mediu:
#   $env:PORT=3000          # Backend port
#   $env:VITE_PORT=3001     # Frontend port
#   $env:VITE_API_PORT=3000 # Backend port pentru client
# Sau creează fișiere .env în server/ și client/ (vezi .env.example)

$ErrorActionPreference = "SilentlyContinue"
Set-Location $PSScriptRoot

# Citeste porturile din variabilele de mediu sau foloseste default-urile
$backendPort = if ($env:PORT) { $env:PORT } else { "5175" }
$frontendPort = if ($env:VITE_PORT) { $env:VITE_PORT } else { "5174" }

Write-Host "[1/3] Eliberez porturile ${frontendPort} si ${backendPort}..." -ForegroundColor Cyan
Get-NetTCPConnection -LocalPort $frontendPort,$backendPort -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -notmatch "^169\." } | Select-Object -First 1).IPAddress
if (-not $ip) { $ip = "localhost" }

Write-Host "[2/3] Pornesc backend (${backendPort}) si frontend (${frontendPort}) pe IP..." -ForegroundColor Cyan
Write-Host ""
Write-Host "  Pe acest PC:   http://localhost:${frontendPort}" -ForegroundColor Gray
Write-Host "  Din rețea (IP): http://${ip}:${frontendPort}" -ForegroundColor Green
Write-Host "  Backend API:   http://${ip}:${backendPort}" -ForegroundColor Green
Write-Host ""

npm run dev
