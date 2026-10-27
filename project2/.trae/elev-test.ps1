$ErrorActionPreference = 'Continue'
$log = 'C:\Users\yzh\AppData\Local\Temp\elev-test.log'
try {
  "start $(Get-Date -Format o)" | Out-File $log -Encoding ascii
  "whoami: $(whoami)" | Out-File $log -Append -Encoding ascii
  "done" | Out-File $log -Append -Encoding ascii
} catch {
  "ERROR: $_" | Out-File $log -Append -Encoding ascii
}
