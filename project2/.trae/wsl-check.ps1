$log = 'C:\Users\yzh\AppData\Local\Temp\wsl-check.log'
"=== check $(Get-Date -Format o) ===" | Out-File $log -Encoding utf8
foreach ($f in 'VirtualMachinePlatform','Microsoft-Windows-Subsystem-Linux','HypervisorPlatform') {
  $s = Get-WindowsOptionalFeature -Online -FeatureName $f -ErrorAction SilentlyContinue
  "$f : $($s.State)" | Out-File $log -Append -Encoding utf8
}
"=== ALL DONE ===" | Out-File $log -Append -Encoding utf8
