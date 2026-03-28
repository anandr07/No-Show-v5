# Run as Administrator to allow port 5000 for the No-Show game server
# Right-click PowerShell -> Run as administrator, then: .\scripts\allow-firewall.ps1

$ruleName = "NoShow Game Server (Port 5000)"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Rule already exists. Removing old rule..."
  Remove-NetFirewallRule -DisplayName $ruleName
}
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
Write-Host "Firewall rule added. Port 5000 is now allowed for incoming connections."
