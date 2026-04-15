#!/bin/bash

# AutoClip Docker 一键部署脚本

set -e

echo "🚀 AutoClip Docker 一键部署脚本"
echo "=================================="

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
    echo "📝 创建环境变量配置文件..."
    if [ -f "env.example" ]; then
        cp env.example .env
        echo "✅ 已创建 .env 文件，请编辑此文件并配置你的API密钥"
        echo "   重要: 请设置 DASHSCOPE_API_KEY 或 SILICONFLOW_API_KEY"
        echo ""
        echo "   编辑完成后，重新运行此脚本"
        exit 0
    else
        echo "❌ 未找到 env.example 文件"
        exit 1
    fi
fi

# 检查API密钥配置
source .env
if [ -z "$DASHSCOPE_API_KEY" ] && [ -z "$SILICONFLOW_API_KEY" ]; then
    echo "❌ 请在 .env 文件中配置 API 密钥"
    echo "   需要设置 DASHSCOPE_API_KEY 或 SILICONFLOW_API_KEY"
    exit 1
fi

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p uploads output/clips output/collections output/metadata data input

# 检查配置文件
if [ ! -f "data/settings.json" ]; then
    echo "📝 创建配置文件..."
    if [ -f "data/settings.example.json" ]; then
        cp data/settings.example.json data/settings.json
        echo "✅ 已创建配置文件"
    fi
fi

# 停止现有容器
echo "🛑 停止现有容器..."
docker-compose down 2>/dev/null || true

# 构建镜像
echo "🔨 构建 Docker 镜像..."
docker-compose build --no-cache

# 启动服务
echo "🚀 启动服务..."
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "🔍 检查服务状态..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ 服务启动成功！"
    echo ""
    echo "🌐 访问地址:"
    echo "   前端界面: http://localhost:8000"
    echo "   API文档: http://localhost:8000/docs"
    echo ""
    echo "📋 常用命令:"
    echo "   查看日志: docker-compose logs -f"
    echo "   停止服务: docker-compose down"
    echo "   重启服务: docker-compose restart"
    echo "   更新镜像: docker-compose pull && docker-compose up -d"
    echo ""
    echo "📁 数据目录:"
    echo "   上传文件: ./uploads/"
    echo "   输出文件: ./output/"
    echo "   配置文件: ./data/settings.json"
else
    echo "❌ 服务启动失败，请检查日志:"
    docker-compose logs
    exit 1
fi
