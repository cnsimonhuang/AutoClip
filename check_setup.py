#!/usr/bin/env python3
"""
项目启动检查脚本
验证所有必要的文件和配置是否正确
"""
import os
import sys
import json
from pathlib import Path
import subprocess

def check_python_version():
    """检查Python版本"""
    print("🐍 检查Python版本...")
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Python版本过低，需要Python 3.8+")
        return False
    print(f"✅ Python版本: {version.major}.{version.minor}.{version.micro}")
    return True

def check_node_version():
    """检查Node.js版本"""
    print("📦 检查Node.js版本...")
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            version = result.stdout.strip()
            print(f"✅ Node.js版本: {version}")
            return True
        else:
            print("❌ Node.js未安装或无法访问")
            return False
    except FileNotFoundError:
        print("❌ Node.js未安装")
        return False

def check_directories():
    """检查必要的目录"""
    print("📁 检查项目目录...")
    required_dirs = [
        'frontend',
        'src',
        'data',
        'uploads',
        'prompt',
        'tests'
    ]
    
    missing_dirs = []
    for dir_name in required_dirs:
        if not Path(dir_name).exists():
            missing_dirs.append(dir_name)
        else:
            print(f"✅ 目录存在: {dir_name}")
    
    if missing_dirs:
        print(f"❌ 缺少目录: {', '.join(missing_dirs)}")
        return False
    
    return True

def check_files():
    """检查必要的文件"""
    print("📄 检查项目文件...")
    required_files = [
        'backend_server.py',
        'main.py',
        'start_dev.sh',
        'requirements.txt',
        '.gitignore',
        'README.md',
        'frontend/package.json',
        'frontend/vite.config.ts',
        'src/main.py',
        'src/config.py'
    ]
    
    missing_files = []
    for file_path in required_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
        else:
            print(f"✅ 文件存在: {file_path}")
    
    if missing_files:
        print(f"❌ 缺少文件: {', '.join(missing_files)}")
        return False
    
    return True

def check_virtual_environment():
    """检查虚拟环境"""
    print("🔧 检查虚拟环境...")
    venv_path = Path('venv')
    if not venv_path.exists():
        print("❌ 虚拟环境不存在，请运行: python3 -m venv venv")
        return False
    
    # 检查是否激活
    if 'VIRTUAL_ENV' not in os.environ:
        print("⚠️  虚拟环境未激活，请运行: source venv/bin/activate")
        return False
    
    print("✅ 虚拟环境已激活")
    return True

def check_dependencies():
    """检查Python依赖"""
    print("📦 检查Python依赖...")
    try:
        import fastapi
        import uvicorn
        import dashscope
        import pydub
        import pysrt
        import pydantic
        import aiofiles
        import requests
        import aiohttp
        print("✅ 所有Python依赖已安装")
        return True
    except ImportError as e:
        print(f"❌ 缺少依赖: {e}")
        print("请运行: pip install -r requirements.txt")
        return False

def check_frontend_dependencies():
    """检查前端依赖"""
    print("🎨 检查前端依赖...")
    node_modules = Path('frontend/node_modules')
    if not node_modules.exists():
        print("❌ 前端依赖未安装，请运行: cd frontend && npm install")
        return False
    
    print("✅ 前端依赖已安装")
    return True

def check_config():
    """检查配置文件"""
    print("⚙️  检查配置文件...")
    settings_file = Path('data/settings.json')
    if not settings_file.exists():
        print("❌ 配置文件不存在，请创建 data/settings.json")
        print("示例配置:")
        print("""
{
  "dashscope_api_key": "your-api-key-here",
  "model_name": "qwen-plus",
  "chunk_size": 5000,
  "min_score_threshold": 0.7,
  "max_clips_per_collection": 5,
  "default_browser": "chrome"
}
        """)
        return False
    
    try:
        with open(settings_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        if 'dashscope_api_key' not in config or not config['dashscope_api_key']:
            print("❌ API密钥未配置")
            return False
        
        print("✅ 配置文件正确")
        return True
    except json.JSONDecodeError:
        print("❌ 配置文件格式错误")
        return False

def check_uploads_directory():
    """检查上传目录"""
    print("📁 检查上传目录...")
    uploads_dir = Path('uploads')
    if not uploads_dir.exists():
        uploads_dir.mkdir(parents=True)
        print("✅ 创建上传目录")
    
    tmp_dir = uploads_dir / 'tmp'
    if not tmp_dir.exists():
        tmp_dir.mkdir(parents=True)
        print("✅ 创建临时目录")
    
    print("✅ 上传目录结构正确")
    return True

def check_prompt_templates():
    """检查提示词模板"""
    print("📝 检查提示词模板...")
    prompt_dir = Path('prompt')
    if not prompt_dir.exists():
        print("❌ 提示词模板目录不存在")
        return False
    
    # 检查是否有模板文件
    template_files = list(prompt_dir.rglob('*.txt'))
    if not template_files:
        print("❌ 未找到提示词模板文件")
        return False
    
    print(f"✅ 找到 {len(template_files)} 个提示词模板")
    return True

def main():
    """主检查函数"""
    print("🔍 开始项目启动检查...")
    print("=" * 50)
    
    checks = [
        check_python_version,
        check_node_version,
        check_directories,
        check_files,
        check_virtual_environment,
        check_dependencies,
        check_frontend_dependencies,
        check_config,
        check_uploads_directory,
        check_prompt_templates
    ]
    
    passed = 0
    total = len(checks)
    
    for check in checks:
        try:
            if check():
                passed += 1
            print()
        except Exception as e:
            print(f"❌ 检查失败: {e}")
            print()
    
    print("=" * 50)
    print(f"📊 检查结果: {passed}/{total} 通过")
    
    if passed == total:
        print("🎉 所有检查通过！项目可以正常启动")
        print("\n🚀 启动命令:")
        print("  ./start_dev.sh")
        print("  或")
        print("  python backend_server.py")
        print("  cd frontend && npm run dev")
    else:
        print("⚠️  请修复上述问题后重新运行检查")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 