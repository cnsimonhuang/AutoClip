#!/usr/bin/env python3
"""
自动切片工具 - 主启动文件
支持命令行和模块导入两种使用方式
"""
import sys
import argparse
from pathlib import Path
from typing import Optional

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from src.main import create_and_process_project, process_existing_project, AutoClipsProcessor
from src.utils.project_manager import project_manager
from src.config import config_manager

def main():
    """主函数 - 命令行入口"""
    parser = argparse.ArgumentParser(
        description='🎬 自动切片工具 - 端到端视频切片推荐系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 创建新项目并处理
  python main.py --video input.mp4 --srt input.srt --project-name "我的项目"
  
  # 处理现有项目
  python main.py --project-id <project_id>
  
  # 列出所有项目
  python main.py --list-projects
  
  # 删除项目
  python main.py --delete-project <project_id>
        """
    )
    
    # 输入文件参数
    parser.add_argument('--video', type=Path, help='视频文件路径')
    parser.add_argument('--srt', type=Path, help='字幕文件路径')
    parser.add_argument('--txt', type=Path, help='文本文件路径（可选）')
    
    # 项目参数
    parser.add_argument('--project-name', type=str, help='项目名称')
    parser.add_argument('--project-id', type=str, help='项目ID（用于处理现有项目）')
    
    # 操作参数
    parser.add_argument('--list-projects', action='store_true', help='列出所有项目')
    parser.add_argument('--delete-project', type=str, help='删除指定项目')
    parser.add_argument('--api-key', type=str, help='API密钥')
    
    # 处理参数
    parser.add_argument('--step', type=int, choices=range(1, 7), help='运行指定步骤（1-6）')
    parser.add_argument('--verbose', '-v', action='store_true', help='详细输出')
    
    args = parser.parse_args()
    
    # 设置API密钥
    if args.api_key:
        config_manager.update_api_key(args.api_key)
        print("✅ API密钥已设置")
    
    # 列出项目
    if args.list_projects:
        list_projects()
        return
    
    # 删除项目
    if args.delete_project:
        delete_project(args.delete_project)
        return
    
    # 处理现有项目
    if args.project_id:
        process_existing_project_cli(args.project_id, args.step)
        return
    
    # 创建新项目
    if args.video and args.srt:
        create_new_project_cli(args.video, args.srt, args.txt, args.project_name, args.step)
        return
    
    # 如果没有提供必要参数，显示帮助
    if len(sys.argv) == 1:
        parser.print_help()
        return
    
    print("❌ 请提供必要的参数，使用 --help 查看帮助")

def list_projects():
    """列出所有项目"""
    print("📁 项目列表:")
    print("=" * 80)
    
    projects = project_manager.list_projects()
    
    if not projects:
        print("暂无项目")
        return
    
    for i, project in enumerate(projects, 1):
        print(f"{i}. 项目名称: {project['project_name']}")
        print(f"   项目ID: {project['project_id']}")
        print(f"   创建时间: {project['created_at'][:19]}")
        print(f"   状态: {project['status']}")
        print(f"   当前步骤: {project.get('current_step', 0)}/6")
        
        # 获取项目摘要
        try:
            summary = project_manager.get_project_summary(project['project_id'])
            print(f"   切片数量: {summary['clips_count']}")
            print(f"   合集数量: {summary['collections_count']}")
        except Exception as e:
            print(f"   获取详情失败: {e}")
        
        print("-" * 80)

def delete_project(project_id: str):
    """删除项目"""
    try:
        if project_manager.delete_project(project_id):
            print(f"✅ 项目 {project_id} 已删除")
        else:
            print(f"❌ 删除项目 {project_id} 失败")
    except Exception as e:
        print(f"❌ 删除项目失败: {e}")

def create_new_project_cli(video_path: Path, srt_path: Path, txt_path: Optional[Path] = None, 
                          project_name: Optional[str] = None, step: Optional[int] = None):
    """创建新项目并处理"""
    print("🚀 创建新项目...")
    
    # 检查文件是否存在
    if not video_path.exists():
        print(f"❌ 视频文件不存在: {video_path}")
        return
    
    if not srt_path.exists():
        print(f"❌ 字幕文件不存在: {srt_path}")
        return
    
    if txt_path and not txt_path.exists():
        print(f"❌ 文本文件不存在: {txt_path}")
        return
    
    try:
        # 创建项目并处理
        result = create_and_process_project(video_path, srt_path, project_name)
        
        if result['success']:
            print(f"✅ 项目创建成功！")
            print(f"   项目ID: {result['project_id']}")
            print(f"   项目名称: {project_name or '未命名'}")
            
            # 显示处理结果
            if 'results' in result:
                display_results_summary(result['results'])
        else:
            print(f"❌ 项目创建失败: {result['error']}")
            
    except Exception as e:
        print(f"❌ 创建项目失败: {e}")

def process_existing_project_cli(project_id: str, step: Optional[int] = None):
    """处理现有项目"""
    print(f"🔄 处理项目: {project_id}")
    
    try:
        if step:
            # 运行单个步骤
            processor = AutoClipsProcessor(project_id)
            result = processor.run_single_step(step)
            print(f"✅ Step {step} 完成")
        else:
            # 运行完整流水线
            result = process_existing_project(project_id)
            
            if result['success']:
                print("✅ 处理完成！")
                if 'results' in result:
                    display_results_summary(result['results'])
            else:
                print(f"❌ 处理失败: {result['error']}")
                
    except Exception as e:
        print(f"❌ 处理项目失败: {e}")

def display_results_summary(results: dict):
    """显示处理结果摘要"""
    print("\n📊 处理结果摘要:")
    print("=" * 50)
    
    if 'step1_outlines' in results:
        print(f"📖 提取话题数: {len(results['step1_outlines'])}")
    
    if 'step2_timeline' in results:
        print(f"⏰ 时间区间数: {len(results['step2_timeline'])}")
    
    if 'step3_scoring' in results:
        print(f"🔥 高分片段数: {len(results['step3_scoring'])}")
    
    if 'step4_titles' in results:
        print(f"📝 生成标题数: {len(results['step4_titles'])}")
    
    if 'step5_collections' in results:
        print(f"📦 合集数量: {len(results['step5_collections'])}")
    
    if 'step6_video' in results:
        video_result = results['step6_video']
        print(f"✂️ 生成切片: {video_result.get('clips_generated', 0)}个")
        print(f"📦 生成合集: {video_result.get('collections_generated', 0)}个")
    
    print("=" * 50)

if __name__ == "__main__":
    main() 