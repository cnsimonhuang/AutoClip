#!/bin/bash

# AutoClip 生产环境 Docker 部署脚本

set -e

echo "🚀 AutoClip 生产环境部署脚本"
echo "=============================="

# 检查是否为root用户
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  检测到root用户，建议使用普通用户运行此脚本"
    read -p "是否继续？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    echo "   安装指南: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    echo "   安装指南: https://docs.docker.com/compose/install/"
    exit 1
fi

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "❌ 生产环境需要 .env 文件"
    echo "   请先配置 .env 文件并设置必要的环境变量"
    exit 1
fi

# 检查API密钥配置
source .env
if [ -z "$DASHSCOPE_API_KEY" ] && [ -z "$SILICONFLOW_API_KEY" ]; then
    echo "❌ 生产环境必须配置 API 密钥"
    echo "   请在 .env 文件中设置 DASHSCOPE_API_KEY 或 SILICONFLOW_API_KEY"
    exit 1
fi

# 检查端口占用
echo "🔍 检查端口占用..."
if netstat -tulpn 2>/dev/null | grep -q ":80 "; then
    echo "⚠️  端口80已被占用，请检查是否有其他服务运行"
    read -p "是否继续？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p uploads output/clips output/collections output/metadata data input logs

# 设置目录权限
echo "🔐 设置目录权限..."
chmod 755 uploads output data input
chmod 644 data/settings.json 2>/dev/null || true

# 停止现有容器
echo "🛑 停止现有容器..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# 清理旧镜像
echo "🧹 清理旧镜像..."
docker image prune -f

# 构建镜像
echo "🔨 构建生产镜像..."
docker-compose -f docker-compose.prod.yml build --no-cache

# 启动服务
echo "🚀 启动生产服务..."
docker-compose -f docker-compose.prod.yml up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 15

# 检查服务状态
echo "🔍 检查服务状态..."
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "✅ 生产服务启动成功！"
    echo ""
    echo "🌐 访问地址:"
    echo "   前端界面: http://localhost (或服务器IP)"
    echo "   API文档: http://localhost/docs"
    echo ""
    echo "📋 生产环境管理命令:"
    echo "   查看日志: docker-compose -f docker-compose.prod.yml logs -f"
    echo "   停止服务: docker-compose -f docker-compose.prod.yml down"
    echo "   重启服务: docker-compose -f docker-compose.prod.yml restart"
    echo "   更新服务: docker-compose -f docker-compose.prod.yml pull && docker-compose -f docker-compose.prod.yml up -d"
    echo ""
    echo "📁 数据目录:"
    echo "   上传文件: ./uploads/"
    echo "   输出文件: ./output/"
    echo "   配置文件: ./data/settings.json"
    echo "   日志文件: ./logs/"
    echo ""
    echo "🔒 安全建议:"
    echo "   1. 配置防火墙，只开放必要端口"
    echo "   2. 使用HTTPS代理（如Nginx）"
    echo "   3. 定期备份数据"
    echo "   4. 监控系统资源使用"
    echo ""
    echo "📊 监控命令:"
    echo "   查看资源使用: docker stats"
    echo "   查看容器状态: docker-compose -f docker-compose.prod.yml ps"
    echo "   查看健康状态: curl http://localhost/health"
else
    echo "❌ 生产服务启动失败，请检查日志:"
    docker-compose -f docker-compose.prod.yml logs
    exit 1
fi

# 创建系统服务（可选）
echo ""
read -p "是否创建系统服务（systemd）？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📝 创建系统服务..."
    sudo tee /etc/systemd/system/autoclip.service > /dev/null <<EOF
[Unit]
Description=AutoClip Production Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$(pwd)
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable autoclip.service
    echo "✅ 系统服务已创建并启用"
    echo "   启动服务: sudo systemctl start autoclip"
    echo "   停止服务: sudo systemctl stop autoclip"
    echo "   查看状态: sudo systemctl status autoclip"
fi
