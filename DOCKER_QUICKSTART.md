# 🐳 AutoClip Docker 快速开始

## 一键部署（推荐）

```bash
# 1. 克隆项目
git clone <repository-url>
cd autoclip_mvp

# 2. 配置API密钥
cp env.example .env
# 编辑 .env 文件，设置你的API密钥

# 3. 一键部署
./docker-deploy.sh
```

**访问地址**: http://localhost:8000

## 手动部署

```bash
# 1. 创建必要目录
mkdir -p uploads output/clips output/collections output/metadata data input

# 2. 配置环境变量
cp env.example .env
# 编辑 .env 文件

# 3. 构建并启动
docker-compose up -d
```

## 生产环境部署

```bash
# 使用生产环境配置
./docker-deploy-prod.sh
```

**访问地址**: http://localhost (端口80)

## 常用命令

```bash
# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 更新服务
docker-compose pull && docker-compose up -d
```

## 环境变量配置

在 `.env` 文件中配置：

```bash
# 选择其中一个API提供商
DASHSCOPE_API_KEY=your-dashscope-api-key
# 或者
SILICONFLOW_API_KEY=your-siliconflow-api-key

# API提供商选择
API_PROVIDER=dashscope  # 或 siliconflow
```

## 故障排除

```bash
# 测试Docker配置
./test-docker.sh

# 查看详细日志
docker-compose logs

# 重新构建
docker-compose build --no-cache
```

📖 **详细文档**: [Docker 部署指南](DOCKER_DEPLOY.md)
