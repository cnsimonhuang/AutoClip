# AutoClip Docker 部署指南

本指南将帮助你使用 Docker 一键部署 AutoClip 项目。

## 📋 前置要求

- **Docker**: 版本 20.10+
- **Docker Compose**: 版本 2.0+
- **API 密钥**: DashScope 或 SiliconFlow API 密钥

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone <repository-url>
cd autoclip_mvp
```

### 2. 配置环境变量
```bash
# 复制环境变量模板
cp env.example .env

# 编辑配置文件
nano .env  # 或使用你喜欢的编辑器
```

在 `.env` 文件中配置你的 API 密钥：
```bash
# 选择其中一个 API 提供商
DASHSCOPE_API_KEY=your-dashscope-api-key-here
# 或者
SILICONFLOW_API_KEY=your-siliconflow-api-key-here

# API 提供商选择
API_PROVIDER=dashscope  # 或 siliconflow
```

### 3. 一键部署
```bash
# 运行部署脚本
./docker-deploy.sh
```

脚本会自动：
- 检查 Docker 环境
- 创建必要目录
- 构建 Docker 镜像
- 启动服务
- 验证服务状态

### 4. 访问应用
部署成功后，你可以通过以下地址访问：

- 🌐 **前端界面**: http://localhost:8000
- 📚 **API 文档**: http://localhost:8000/docs

## 🔧 手动部署

如果你不想使用自动脚本，也可以手动执行以下步骤：

### 1. 创建必要目录
```bash
mkdir -p uploads output/clips output/collections output/metadata data input
```

### 2. 构建并启动
```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d
```

### 3. 查看日志
```bash
# 查看实时日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f autoclip
```

## 📁 目录结构

部署后的目录结构：
```
autoclip_mvp/
├── .env                    # 环境变量配置
├── docker-compose.yml      # Docker Compose 配置
├── Dockerfile             # Docker 镜像构建文件
├── uploads/               # 上传文件存储 (挂载到容器)
├── output/                # 输出文件存储 (挂载到容器)
│   ├── clips/            # 视频切片
│   ├── collections/      # 视频合集
│   └── metadata/         # 元数据
├── data/                 # 配置文件 (挂载到容器)
└── input/                # 输入文件 (挂载到容器)
```

## ⚙️ 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| `DASHSCOPE_API_KEY` | DashScope API 密钥 | - | 二选一 |
| `SILICONFLOW_API_KEY` | SiliconFlow API 密钥 | - | 二选一 |
| `API_PROVIDER` | API 提供商 | `dashscope` | 否 |
| `MODEL_NAME` | 模型名称 | `qwen-plus` | 否 |
| `CHUNK_SIZE` | 文本分块大小 | `5000` | 否 |
| `MIN_SCORE_THRESHOLD` | 最低评分阈值 | `0.7` | 否 |

### 端口配置

- **8000**: 主服务端口 (前端 + API)

### 数据持久化

以下目录会被挂载到容器中，数据会持久保存：
- `./uploads` → `/app/uploads`
- `./output` → `/app/output`
- `./data` → `/app/data`
- `./input` → `/app/input`

## 🛠️ 常用命令

### 服务管理
```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看服务状态
docker-compose ps
```

### 日志管理
```bash
# 查看实时日志
docker-compose logs -f

# 查看最近日志
docker-compose logs --tail=100

# 查看特定服务日志
docker-compose logs -f autoclip
```

### 镜像管理
```bash
# 重新构建镜像
docker-compose build --no-cache

# 拉取最新镜像
docker-compose pull

# 清理未使用的镜像
docker image prune
```

### 数据管理
```bash
# 备份数据
tar -czf autoclip-backup-$(date +%Y%m%d).tar.gz uploads/ output/ data/

# 恢复数据
tar -xzf autoclip-backup-20231201.tar.gz
```

## 🔍 故障排除

### 常见问题

#### 1. 服务启动失败
```bash
# 查看详细错误日志
docker-compose logs

# 检查端口占用
netstat -tulpn | grep 8000

# 检查磁盘空间
df -h
```

#### 2. API 密钥错误
```bash
# 检查环境变量
docker-compose exec autoclip env | grep API

# 重新配置环境变量
nano .env
docker-compose restart
```

#### 3. 文件权限问题
```bash
# 修复目录权限
sudo chown -R $USER:$USER uploads/ output/ data/ input/

# 设置正确的权限
chmod -R 755 uploads/ output/ data/ input/
```

#### 4. FFmpeg 相关问题
```bash
# 检查 FFmpeg 是否正常
docker-compose exec autoclip ffmpeg -version

# 重新构建镜像
docker-compose build --no-cache
```

### 性能优化

#### 1. 资源限制
在 `docker-compose.yml` 中调整资源限制：
```yaml
deploy:
  resources:
    limits:
      memory: 4G  # 增加内存限制
      cpus: '2.0' # 增加CPU限制
```

#### 2. 缓存优化
```bash
# 使用 BuildKit 加速构建
export DOCKER_BUILDKIT=1
docker-compose build
```

## 🔒 安全建议

1. **API 密钥安全**
   - 不要在代码中硬编码 API 密钥
   - 定期轮换 API 密钥
   - 使用环境变量管理敏感信息

2. **网络安全**
   - 在生产环境中使用 HTTPS
   - 配置防火墙规则
   - 限制容器网络访问

3. **数据安全**
   - 定期备份重要数据
   - 加密敏感配置文件
   - 监控文件访问权限

## 📞 技术支持

如果遇到问题，请：

1. 查看 [FAQ](../README.md#-faq)
2. 检查 [Issues](../../issues)
3. 提交新的 Issue 并附上：
   - 错误日志
   - 系统环境信息
   - 复现步骤

## 📝 更新日志

- **v1.0.0**: 初始 Docker 部署支持
- 支持多阶段构建
- 集成前端静态文件服务
- 添加健康检查
- 支持环境变量配置
