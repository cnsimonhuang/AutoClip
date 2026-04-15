# 贡献指南

感谢你考虑为 AutoClip MVP 项目做出贡献！

## 🚀 快速开始

### 环境设置

1. **Fork 项目**
   ```bash
   git clone git@github.com:zhouxiaoka/autoclip_mvp.git
   cd autoclip_mvp
   ```

2. **设置开发环境**
   ```bash
   # 后端环境
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   
   # 前端环境
   cd frontend
   npm install
   cd ..
   ```

3. **配置API密钥**
   ```bash
   cp data/settings.example.json data/settings.json
   # 编辑 data/settings.json，填入你的API密钥
   ```

## 📝 开发流程

### 创建分支
```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
```

### 提交代码
```bash
git add .
git commit -m "feat: 添加新功能"
git push origin feature/your-feature-name
```

### 提交Pull Request
1. 在GitHub上创建Pull Request
2. 填写PR模板
3. 等待代码审查

## 🧪 测试

### 后端测试
```bash
python -m pytest tests/ -v
```

### 前端测试
```bash
cd frontend
npm run lint
npm run build
```

## 📋 代码规范

### Python
- 使用 `black` 格式化代码
- 遵循 PEP 8 规范
- 添加类型注解
- 编写文档字符串

### TypeScript/React
- 使用 ESLint 和 Prettier
- 遵循 React 最佳实践
- 添加适当的类型定义
- 编写组件文档

## 🐛 报告问题

使用 [GitHub Issues](https://github.com/zhouxiaoka/autoclip_mvp/issues) 报告问题。

## 💡 功能建议

欢迎通过 Issues 提出新功能建议！

## 📄 许可证

本项目采用 MIT 许可证。 