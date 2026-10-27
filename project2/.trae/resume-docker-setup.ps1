# 重启后续跑：WSL2 + Ubuntu + Docker Engine 全自动安装与 compose 验证
# 用法（无需管理员）：powershell -ExecutionPolicy Bypass -File .trae\resume-docker-setup.ps1
# 日志：.trae\resume-docker-setup.log
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$log  = Join-Path $PSScriptRoot 'resume-docker-setup.log'
function Log($msg) { $line = "[$(Get-Date -Format 'HH:mm:ss')] $msg"; $line; $line | Out-File $log -Append -Encoding utf8 }

"==== resume-docker-setup $(Get-Date -Format o) ====" | Out-File $log -Encoding utf8

# ---------- 1. 安装 Ubuntu 发行版（用户级，无需提权） ----------
Log 'STEP1: wsl --install -d Ubuntu --no-launch'
$out = & wsl.exe --install -d Ubuntu --no-launch 2>&1 | Out-String
Log $out

# ---------- 2. 以 root 完成初始化（跳过 OOBE 交互） ----------
$ubuntuExe = Get-Command ubuntu.exe, ubuntu2404.exe, ubuntu2204.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source
if ($ubuntuExe) {
  Log "STEP2: $ubuntuExe install --root"
  $out = & $ubuntuExe install --root 2>&1 | Out-String; Log $out
} else {
  Log 'STEP2: ubuntu*.exe not found, try direct wsl root launch'
  $out = & wsl.exe -d Ubuntu -u root -- echo ok 2>&1 | Out-String; Log $out
}

# ---------- 3. Ubuntu 内安装 Docker（清华镜像源） ----------
$bashSetup = @'
set -e
export DEBIAN_FRONTEND=noninteractive
echo "[wsl] os: $(. /etc/os-release && echo $PRETTY_NAME)"
# 换清华 apt 源（加速）
CODENAME=$(. /etc/os-release && echo $VERSION_CODENAME)
cp /etc/apt/sources.list /etc/apt/sources.list.bak 2>/dev/null || true
cat > /etc/apt/sources.list <<EOF
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ $CODENAME main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ $CODENAME-updates main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ $CODENAME-security main restricted universe multiverse
EOF
# Ubuntu24+ 使用 deb822 格式文件，存在则禁用
[ -f /etc/apt/sources.list.d/ubuntu.sources ] && mv /etc/apt/sources.list.d/ubuntu.sources /etc/apt/sources.list.d/ubuntu.sources.bak
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://mirrors.tuna.tsinghua.edu.cn/docker-ce/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://mirrors.tuna.tsinghua.edu.cn/docker-ce/linux/ubuntu $CODENAME stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
# 启用 systemd（WSL2）
printf '[boot]\nsystemd=true\n' > /etc/wsl.conf
# 配置镜像加速器（Docker Hub 国内不可直连）
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1panel.live",
    "https://docker.nju.edu.cn",
    "https://hub.rat.dev"
  ]
}
EOF
echo '[wsl] docker installed'
'@

Log 'STEP3: install docker-ce inside Ubuntu'
$bashSetup | & wsl.exe -d Ubuntu -u root bash 2>&1 | ForEach-Object { Log $_ }

# 重启发行版使 systemd 生效
Log 'STEP3b: wsl --shutdown then start docker'
& wsl.exe --shutdown 2>&1 | Out-Null
Start-Sleep -Seconds 3
$out = & wsl.exe -d Ubuntu -u root -- bash -c 'systemctl enable --now docker && docker version --format "server={{.Server.Version}}"' 2>&1 | Out-String
Log $out

# ---------- 4. 复制代码到 WSL 内（避免 /mnt/c 性能问题）并启动 compose ----------
Log 'STEP4: copy project to ~/campus-xianyu and compose up'
$copyCmd = 'rm -rf ~/campus-xianyu && mkdir -p ~/campus-xianyu && cp -r /mnt/c/Users/yzh/Desktop/Trae_projects/project2/docker-compose.yml /mnt/c/Users/yzh/Desktop/Trae_projects/project2/.env /mnt/c/Users/yzh/Desktop/Trae_projects/project2/server /mnt/c/Users/yzh/Desktop/Trae_projects/project2/campus-xianyu-ui ~/campus-xianyu/ && cd ~/campus-xianyu && ls'
$out = & wsl.exe -d Ubuntu -u root -- bash -c "$copyCmd" 2>&1 | Out-String
Log $out

$up = & wsl.exe -d Ubuntu -u root -- bash -c 'cd ~/campus-xianyu && docker compose up -d --build 2>&1' 2>&1 | Out-String
Log $up

# ---------- 5. 验证 ----------
Log 'STEP5: wait healthy & verify'
$wait = & wsl.exe -d Ubuntu -u root -- bash -c 'for i in $(seq 1 60); do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/health || true); if [ "$code" = "200" ]; then echo "HEALTH_OK after ${i}0s"; exit 0; fi; sleep 10; done; echo HEALTH_TIMEOUT' 2>&1 | Out-String
Log $wait

$ps = & wsl.exe -d Ubuntu -u root -- bash -c 'cd ~/campus-xianyu && docker compose ps' 2>&1 | Out-String
Log $ps

Log '==== ALL DONE ===='
