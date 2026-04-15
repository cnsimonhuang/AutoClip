# AutoClip Windows 构建脚本
# 使用方法：在 Windows 上以管理员身份运行此脚本

param(
    [switch]$Portable = $false,
    [switch]$Installer = $false
)

$ErrorActionPreference = "Stop"

Write-Host "=== AutoClip Windows 构建脚本 ===" -ForegroundColor Cyan
Write-Host ""

# 检测Python
Write-Host "检查 Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "找到: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: 未找到 Python，请先安装 Python 3.10+ " -ForegroundColor Red
    Write-Host "下载: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# 创建虚拟环境
Write-Host ""
Write-Host "创建虚拟环境..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Write-Host "删除旧虚拟环境..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "venv"
}
python -m venv venv
if ($LASTEXITCODE -ne 0) { exit 1 }

# 激活虚拟环境
Write-Host "激活虚拟环境..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1
if ($LASTEXITCODE -ne 0) {
    # 如果PowerShell激活失败，尝试cmd
    cmd /c "venv\Scripts\activate.bat"
}

# 安装Python依赖
Write-Host ""
Write-Host "安装 Python 依赖..." -ForegroundColor Yellow
pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { exit 1 }

# 安装Node.js依赖
Write-Host ""
Write-Host "安装 Node.js 依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) { exit 1 }
} else {
    Write-Host "node_modules 已存在，跳过 npm install" -ForegroundColor Green
}

# 构建
Write-Host ""
Write-Host "开始构建..." -ForegroundColor Yellow

if ($Portable) {
    Write-Host "构建 Portable 版本..." -ForegroundColor Cyan
    npx electron-builder --win portable
} elseif ($Installer) {
    Write-Host "构建 NSIS 安装程序..." -ForegroundColor Cyan
    npx electron-builder --win nsis
} else {
    # 默认构建 portable
    Write-Host "构建 Portable 版本..." -ForegroundColor Cyan
    npx electron-builder --win portable
}

if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "=== 构建完成 ===" -ForegroundColor Green
Write-Host "输出目录: release\" -ForegroundColor Cyan
Get-ChildItem -Path "release" -Filter "*.exe" | ForEach-Object {
    Write-Host "  $($_.Name) - $([math]::Round($_.Length / 1MB, 2)) MB" -ForegroundColor White
}
