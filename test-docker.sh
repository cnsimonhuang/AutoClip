#!/bin/bash

# Docker 配置测试脚本

echo "🧪 AutoClip Docker 配置测试"
echo "============================"

# 检查 Docker 是否运行
echo "1. 检查 Docker 服务状态..."
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker 服务未运行，请启动 Docker"
    exit 1
fi
echo "✅ Docker 服务正常运行"

# 检查 Docker Compose
echo "2. 检查 Docker Compose..."
if ! docker-compose version >/dev/null 2>&1; then
    echo "❌ Docker Compose 未安装"
    exit 1
fi
echo "✅ Docker Compose 可用"

# 检查配置文件
echo "3. 检查配置文件..."
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml 文件不存在"
    exit 1
fi
echo "✅ docker-compose.yml 存在"

if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile 文件不存在"
    exit 1
fi
echo "✅ Dockerfile 存在"

# 检查环境变量文件
echo "4. 检查环境变量配置..."
if [ ! -f ".env" ]; then
    echo "⚠️  .env 文件不存在，将使用默认配置"
else
    echo "✅ .env 文件存在"
    # 检查API密钥配置
    source .env
    if [ -n "$DASHSCOPE_API_KEY" ] || [ -n "$SILICONFLOW_API_KEY" ]; then
        echo "✅ API 密钥已配置"
    else
        echo "⚠️  API 密钥未配置，请编辑 .env 文件"
    fi
fi

# 检查目录结构
echo "5. 检查目录结构..."
required_dirs=("src" "frontend" "data" "prompt")
for dir in "${required_dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ $dir 目录存在"
    else
        echo "❌ $dir 目录不存在"
        exit 1
    fi
done

# 检查依赖文件
echo "6. 检查依赖文件..."
if [ -f "requirements.txt" ]; then
    echo "✅ requirements.txt 存在"
else
    echo "❌ requirements.txt 不存在"
    exit 1
fi

if [ -f "frontend/package.json" ]; then
    echo "✅ frontend/package.json 存在"
else
    echo "❌ frontend/package.json 不存在"
    exit 1
fi

# 测试 Docker 构建
echo "7. 测试 Docker 构建..."
echo "   这可能需要几分钟时间..."

# 创建临时测试目录
mkdir -p test-docker-build
cp docker-compose.yml test-docker-build/
cp Dockerfile test-docker-build/
cp requirements.txt test-docker-build/
cp -r src test-docker-build/
cp -r frontend test-docker-build/
cp backend_server.py test-docker-build/
cp main.py test-docker-build/

cd test-docker-build

# 尝试构建镜像（不启动服务）
if docker-compose build --no-cache >/dev/null 2>&1; then
    echo "✅ Docker 构建测试通过"
else
    echo "❌ Docker 构建失败"
    echo "   查看详细错误信息:"
    docker-compose build --no-cache
    cd ..
    rm -rf test-docker-build
    exit 1
fi

cd ..
rm -rf test-docker-build

echo ""
echo "🎉 所有测试通过！"
echo "你现在可以运行 ./docker-deploy.sh 来部署应用"
echo ""
echo "📋 下一步："
echo "1. 配置 API 密钥（如果还没有配置）"
echo "2. 运行 ./docker-deploy.sh"
echo "3. 访问 http://localhost:8000"
