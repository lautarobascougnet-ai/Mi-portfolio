# Ejecutar como administrador. Solo habilita estos puertos en la red privada local.
$ErrorActionPreference = 'Stop'
$ruleName = 'Aulify-Porteo-Local'
if (-not (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name $ruleName -DisplayName 'Aulify HTTPS local para celulares' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8443,8081 -Profile Private -RemoteAddress LocalSubnet
}
Write-Host 'Regla preparada para redes privadas. Para revertir: Remove-NetFirewallRule -Name Aulify-Porteo-Local'
