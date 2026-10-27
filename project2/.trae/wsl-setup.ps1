$log = 'C:\Users\yzh\AppData\Local\Temp\wsl-setup.log'
"=== query $(Get-Date -Format o) ===" | Out-File $log -Encoding ascii
try {
  $f = & dism.exe /online /get-features /format:table 2>&1 | Out-String
  ($f -split "`r?`n" | Select-String -Pattern 'Subsystem|VirtualMachine|Hypervisor') | Out-File $log -Append -Encoding ascii
} catch { "QUERY_ERR: $_" | Out-File $log -Append -Encoding ascii }

"=== enable VirtualMachinePlatform ===" | Out-File $log -Append -Encoding ascii
try {
  & dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart 2>&1 | Out-String | Out-File $log -Append -Encoding ascii
} catch { "VMP_ERR: $_" | Out-File $log -Append -Encoding ascii }

"=== enable WSL ===" | Out-File $log -Append -Encoding ascii
try {
  & dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart 2>&1 | Out-String | Out-File $log -Append -Encoding ascii
} catch { "WSL_ERR: $_" | Out-File $log -Append -Encoding ascii }

"=== ALL DONE $(Get-Date -Format o) ===" | Out-File $log -Append -Encoding ascii
