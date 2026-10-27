# WSL 本体安装（提权执行）：启用所需功能 + 安装 Store 版 WSL + 内核
$log = 'C:\Users\yzh\AppData\Local\Temp\wsl-install.log'
"=== wsl --install --no-distribution ===" | Out-File $log -Encoding utf8
try {
  $out = & wsl.exe --install --no-distribution 2>&1 | Out-String
  $out | Out-File $log -Append -Encoding utf8
  "EXIT=$LASTEXITCODE" | Out-File $log -Append -Encoding utf8
} catch {
  "ERROR: $_" | Out-File $log -Append -Encoding utf8
}
"=== done ===" | Out-File $log -Append -Encoding utf8
