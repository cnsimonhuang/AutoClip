#!/usr/bin/env python3
"""
B站视频下载器 - 基于yt-dlp实现B站视频和字幕下载
集成到自动切片工具项目中
"""

import os
import re
import asyncio
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Callable
from datetime import datetime
import yt_dlp
import subprocess

try:
    from .error_handler import FileIOError, ValidationError, ProcessingError
except ImportError:
    # 独立运行时的导入
    import sys
    sys.path.append(str(Path(__file__).parent.parent))
    from utils.error_handler import FileIOError, ValidationError, ProcessingError

logger = logging.getLogger(__name__)

class BilibiliVideoInfo:
    """B站视频信息类"""
    def __init__(self, info_dict: Dict[str, Any]):
        self.bvid = info_dict.get('id', '')
        self.title = info_dict.get('title', 'unknown_video')
        self.duration = info_dict.get('duration', 0)
        self.uploader = info_dict.get('uploader', 'unknown')
        self.description = info_dict.get('description', '')
        self.thumbnail_url = info_dict.get('thumbnail', '')
        self.view_count = info_dict.get('view_count', 0)
        self.upload_date = info_dict.get('upload_date', '')
        self.webpage_url = info_dict.get('webpage_url', '')
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'bvid': self.bvid,
            'title': self.title,
            'duration': self.duration,
            'uploader': self.uploader,
            'description': self.description,
            'thumbnail_url': self.thumbnail_url,
            'view_count': self.view_count,
            'upload_date': self.upload_date,
            'webpage_url': self.webpage_url
        }

class BilibiliDownloader:
    """B站视频下载器"""
    
    def __init__(self, download_dir: Optional[Path] = None, browser: Optional[str] = None, cookies_file: Optional[Path] = None):
        """
        初始化下载器
        
        Args:
            download_dir: 下载目录，默认为当前目录
            browser: 浏览器类型，用于获取cookies（cookies_file优先）
            cookies_file: cookies文件路径（Netscape格式），优先于browser
        """
        self.download_dir = download_dir or Path.cwd()
        self.browser = browser
        self.cookies_file = cookies_file
        self.download_dir.mkdir(parents=True, exist_ok=True)
        
    def validate_bilibili_url(self, url: str) -> bool:
        """
        验证B站视频链接格式
        
        Args:
            url: 视频链接
            
        Returns:
            是否为有效的B站链接
        """
        bilibili_patterns = [
            r'https?://www\.bilibili\.com/video/[Bb][Vv][0-9A-Za-z]+',
            r'https?://bilibili\.com/video/[Bb][Vv][0-9A-Za-z]+',
            r'https?://b23\.tv/[0-9A-Za-z]+',
            r'https?://www\.bilibili\.com/video/av\d+',
            r'https?://bilibili\.com/video/av\d+'
        ]
        
        return any(re.match(pattern, url) for pattern in bilibili_patterns)
    
    async def get_video_info(self, url: str) -> BilibiliVideoInfo:
        """
        获取视频信息（不下载）
        
        Args:
            url: 视频链接
            
        Returns:
            视频信息对象
        """
        if not self.validate_bilibili_url(url):
            raise ValidationError(f"无效的B站视频链接: {url}")
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        if self.cookies_file and self.cookies_file.exists():
            ydl_opts['cookiefile'] = str(self.cookies_file)
            logger.info(f'yt-dlp cookies_file: {self.cookies_file}')
        elif self.browser:
            ydl_opts['cookies_from_browser'] = self.browser.lower()
            logger.info(f'yt-dlp cookies_from_browser: {self.browser}')
        
        try:
            loop = asyncio.get_event_loop()
            info_dict = await loop.run_in_executor(
                None, 
                self._extract_info_sync, 
                url, 
                ydl_opts
            )
            return BilibiliVideoInfo(info_dict)
        except Exception as e:
            error_str = str(e)
            # 检测需要登录的错误
            if 'No video formats found' in error_str or 'is unavailable' in error_str:
                hint = "\n\n💡 提示：此视频可能需要登录才能下载。请在设置中配置 B站 cookies（SESSDATA、bili_jct、BUVID3）"
                error_msg = f"获取视频信息失败: {error_str}{hint}"
            elif 'login' in error_str.lower() or 'premiere' in error_str.lower():
                hint = "\n\n💡 提示：此视频可能需要登录才能访问。请在设置中配置 B站 cookies"
                error_msg = f"获取视频信息失败: {error_str}{hint}"
            else:
                error_msg = f"获取视频信息失败: {error_str}"
            raise ProcessingError(error_msg)
    
    def _extract_info_sync(self, url: str, ydl_opts: Dict[str, Any]) -> Dict[str, Any]:
        """同步方式提取视频信息"""
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(url, download=False)
    
    async def download_video_and_subtitle(
        self, 
        url: str, 
        progress_callback: Optional[Callable[[str, float], None]] = None
    ) -> Dict[str, str]:
        """
        下载视频和字幕文件
        
        Args:
            url: 视频链接
            progress_callback: 进度回调函数，参数为(状态信息, 进度百分比)
            
        Returns:
            包含video_path和subtitle_path的字典
        """
        if not self.validate_bilibili_url(url):
            raise ValidationError(f"无效的B站视频链接: {url}")
        
        # 获取视频信息
        video_info = await self.get_video_info(url)
        
        # 清理文件名，移除特殊字符
        safe_title = self._sanitize_filename(video_info.title)
        
        # 设置下载选项 - 尝试多种字幕格式
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'writeautosub': True,  # 下载AI字幕
            'writesubtitles': True,  # 下载普通字幕
            'subtitleslangs': ['ai-zh', 'zh-CN', 'zh', 'en'],  # 尝试多种字幕格式，按优先级
            'subtitlesformat': 'srt',  # 强制SRT格式
            'outtmpl': str(self.download_dir / f'{safe_title}.%(ext)s'),
            'noplaylist': True,
            'quiet': True,
            'progress': True,
        }
        
        if self.cookies_file and self.cookies_file.exists():
            ydl_opts['cookiefile'] = str(self.cookies_file)
            logger.info(f'yt-dlp cookies_file: {self.cookies_file}')
        elif self.browser:
            ydl_opts['cookies_from_browser'] = self.browser.lower()
            logger.info(f'yt-dlp cookies_from_browser: {self.browser}')
        
        # 添加进度钩子
        if progress_callback:
            ydl_opts['progress_hooks'] = [self._create_progress_hook(progress_callback)]
        
        try:
            if progress_callback:
                progress_callback("开始下载视频和字幕...", 0)
            
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                self._download_sync,
                url,
                ydl_opts
            )
            
            # 查找下载的文件
            video_path = self._find_downloaded_video(safe_title)
            subtitle_path = self._find_downloaded_subtitle(safe_title)
            
            if progress_callback:
                progress_callback("下载完成", 100)
            
            result = {
                'video_path': str(video_path) if video_path else '',
                'subtitle_path': str(subtitle_path) if subtitle_path else '',
                'video_info': video_info.to_dict()
            }
            
            logger.info(f"下载完成: {video_info.title}")
            return result
            
        except Exception as e:
            error_str = str(e)
            # 检测需要登录的错误
            if 'No video formats found' in error_str or 'is unavailable' in error_str:
                hint = "\n\n💡 提示：此视频可能需要登录才能下载。请在设置中配置 B站 cookies（SESSDATA、bili_jct、BUVID3）"
                error_msg = f"下载失败: {error_str}{hint}"
            elif 'login' in error_str.lower() or 'premiere' in error_str.lower():
                hint = "\n\n💡 提示：此视频可能需要登录才能访问。请在设置中配置 B站 cookies"
                error_msg = f"下载失败: {error_str}{hint}"
            else:
                error_msg = f"下载失败: {error_str}"
            if progress_callback:
                progress_callback(error_msg, 0)
            raise ProcessingError(error_msg)
    
    def _get_yt_dlp_path(self) -> str:
        """获取yt-dlp的完整路径"""
        import sys
        # 尝试从当前Python解释器的路径推断venv路径
        python_path = Path(sys.executable)
        venv_bin = python_path.parent
        
        # 优先使用venv中的yt-dlp
        yt_dlp_path = venv_bin / 'yt-dlp'
        if yt_dlp_path.exists():
            return str(yt_dlp_path)
        
        # 回退到系统PATH中的yt-dlp
        return 'yt-dlp'
    
    def _download_sync(self, url: str, ydl_opts: Dict[str, Any]):
        """同步方式下载 - 使用subprocess确保cookie正确传递，并支持进度回调"""
        safe_title = ydl_opts.get('outtmpl', '').split('/')[-1].replace('%(ext)s', '')
        if not safe_title:
            safe_title = "video"
        
        # 获取进度回调函数
        progress_callback = None
        if 'progress_hooks' in ydl_opts and ydl_opts['progress_hooks']:
            # 从第一个hook中提取回调函数
            original_hook = ydl_opts['progress_hooks'][0]
            if hasattr(original_hook, '__closure__') and original_hook.__closure__:
                progress_callback = original_hook.__closure__[0].cell_contents
        
        # 获取yt-dlp路径
        yt_dlp_cmd = self._get_yt_dlp_path()
        logger.info(f"[subprocess] yt-dlp路径: {yt_dlp_cmd}")
        
        # 构造yt-dlp命令
        if self.cookies_file and self.cookies_file.exists():
            cookie_arg = ["--cookies", str(self.cookies_file)]
            logger.info(f"[subprocess] 使用cookie文件: {self.cookies_file}")
        else:
            browser_name = self.browser.lower() if self.browser else "chrome"
            cookie_arg = ["--cookies-from-browser", browser_name]
            logger.info(f"[subprocess] 使用浏览器cookie: {browser_name}")
        
        cmd = [
            yt_dlp_cmd,
            "--write-sub",
            "--sub-lang", "ai-zh",
            "--sub-format", "srt",
            "--output", f"{safe_title}.%(ext)s",  # 只用文件名
            *cookie_arg,
            "--progress",  # 启用进度输出
            url
        ]
        logger.info(f"[subprocess] yt-dlp命令: {' '.join(cmd)}")
        
        # 执行命令并实时解析进度
        import subprocess
        import re
        
        process = subprocess.Popen(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT,
            text=True,
            cwd=str(self.download_dir),
            bufsize=1,
            universal_newlines=True
        )
        
        # 解析进度信息
        progress_pattern = re.compile(r'\[download\]\s+(\d+\.?\d*)%')
        
        while True:
            output = process.stdout.readline()
            if output == '' and process.poll() is not None:
                break
            if output:
                logger.info(f"[subprocess] {output.strip()}")
                
                # 解析进度
                if progress_callback:
                    match = progress_pattern.search(output)
                    if match:
                        try:
                            progress = float(match.group(1))
                            progress_callback(f"下载中... {progress:.1f}%", progress)
                        except ValueError:
                            pass
        
        result = process.poll()
        if result != 0:
            logger.error(f"yt-dlp命令执行失败，返回码: {result}")
        
        # 列出下载目录所有文件
        import os
        files = os.listdir(self.download_dir)
        logger.info(f"[subprocess] 下载目录内容: {files}")
        
        # 查找字幕文件
        subtitle_file = None
        for f in files:
            if f.endswith('.srt') or f.endswith('.ass'):
                subtitle_file = f
                break
        if subtitle_file:
            logger.info(f"[subprocess] 找到字幕文件: {subtitle_file}")
        else:
            logger.warning(f"[subprocess] 未找到字幕文件，标题: {safe_title}")
    
    def _create_progress_hook(self, progress_callback: Callable[[str, float], None]):
        """创建进度回调钩子"""
        def progress_hook(d):
            if d['status'] == 'downloading':
                if 'total_bytes' in d and d['total_bytes']:
                    progress = (d['downloaded_bytes'] / d['total_bytes']) * 100
                elif '_percent_str' in d:
                    # 从百分比字符串中提取数字
                    percent_str = d['_percent_str'].strip().rstrip('%')
                    try:
                        progress = float(percent_str)
                    except ValueError:
                        progress = 0
                else:
                    progress = 0
                
                speed = d.get('_speed_str', '')
                eta = d.get('_eta_str', '')
                status = f"下载中... {speed} ETA: {eta}"
                progress_callback(status, progress)
            elif d['status'] == 'finished':
                progress_callback("下载完成，正在处理...", 95)
        
        return progress_hook
    
    def _sanitize_filename(self, filename: str) -> str:
        """清理文件名，移除不安全字符"""
        # 移除或替换不安全的字符
        unsafe_chars = '<>:"/\\|?*'
        for char in unsafe_chars:
            filename = filename.replace(char, '_')
        
        # 限制文件名长度
        if len(filename) > 100:
            filename = filename[:100]
        
        return filename.strip()
    
    def _find_downloaded_video(self, title: str) -> Optional[Path]:
        """查找下载的视频文件"""
        possible_extensions = ['.mp4', '.mkv', '.webm', '.flv']
        
        for ext in possible_extensions:
            video_path = self.download_dir / f"{title}{ext}"
            if video_path.exists():
                return video_path
        
        # 如果精确匹配失败，尝试模糊匹配
        for file_path in self.download_dir.glob(f"{title}*"):
            if file_path.suffix.lower() in possible_extensions:
                return file_path
        
        return None
    
    def _find_downloaded_subtitle(self, title: str) -> Optional[Path]:
        """查找下载的字幕文件 - 支持多种字幕格式"""
        logger.info(f"正在查找字幕文件，标题: {title}")

        # 字幕格式优先级列表
        subtitle_formats = ['ai-zh', 'zh-CN', 'zh', 'en']

        # 首先检查各语言的AI字幕文件
        for lang in subtitle_formats:
            subtitle_path = self.download_dir / f"{title}.{lang}.srt"
            if subtitle_path.exists():
                # 重命名为标准格式
                standard_path = self.download_dir / f"{title}.srt"
                if not standard_path.exists():
                    subtitle_path.rename(standard_path)
                    logger.info(f"重命名字幕文件: {title}.{lang}.srt -> {title}.srt")
                    return standard_path
                return subtitle_path

        # 检查是否已经是标准格式
        standard_path = self.download_dir / f"{title}.srt"
        if standard_path.exists():
            logger.info(f"找到标准字幕文件: {title}.srt")
            return standard_path

        # 模糊匹配字幕文件（处理 yt-dlp 可能生成的任何字幕文件名）
        for file_path in self.download_dir.glob(f"{title}*.srt"):
            logger.info(f"找到字幕文件: {file_path.name}")
            return file_path

        # 尝试匹配任何包含 title 的 srt 文件
        escaped_title = re.escape(title)
        for file_path in self.download_dir.glob("*.srt"):
            if re.match(f".*{escaped_title}.*", file_path.name):
                logger.info(f"找到字幕文件（模糊匹配）: {file_path.name}")
                return file_path

        logger.warning(f"未找到字幕文件，标题: {title}")
        return None
    
    def _convert_vtt_to_srt(self, vtt_path: Path, srt_path: Path):
        """将VTT字幕文件转换为SRT格式"""
        try:
            with open(vtt_path, 'r', encoding='utf-8') as vtt_file:
                vtt_content = vtt_file.read()
            
            # 简单的VTT到SRT转换
            lines = vtt_content.split('\n')
            srt_lines = []
            subtitle_count = 1
            
            i = 0
            while i < len(lines):
                line = lines[i].strip()
                
                # 跳过VTT头部信息
                if line.startswith('WEBVTT') or line.startswith('NOTE') or not line:
                    i += 1
                    continue
                
                # 查找时间戳行
                if '-->' in line:
                    # 转换时间格式 (VTT使用点，SRT使用逗号)
                    time_line = line.replace('.', ',')
                    srt_lines.append(str(subtitle_count))
                    srt_lines.append(time_line)
                    
                    # 获取字幕文本
                    i += 1
                    subtitle_text = []
                    while i < len(lines) and lines[i].strip():
                        subtitle_text.append(lines[i].strip())
                        i += 1
                    
                    srt_lines.extend(subtitle_text)
                    srt_lines.append('')  # 空行分隔
                    subtitle_count += 1
                
                i += 1
            
            # 写入SRT文件
            with open(srt_path, 'w', encoding='utf-8') as srt_file:
                srt_file.write('\n'.join(srt_lines))
                
        except Exception as e:
            logger.error(f"VTT转SRT转换失败: {e}")
            raise
    
    def cleanup_temp_files(self, title: str):
        """清理临时文件"""
        try:
            # 清理可能的临时文件
            for pattern in [f"{title}*.part", f"{title}*.tmp", f"{title}*.ytdl"]:
                for temp_file in self.download_dir.glob(pattern):
                    temp_file.unlink(missing_ok=True)
        except Exception as e:
            logger.warning(f"清理临时文件失败: {e}")

    def download(self, url, safe_title):
        # 获取yt-dlp路径
        yt_dlp_cmd = self._get_yt_dlp_path()
        logger.info(f"[subprocess] yt-dlp路径: {yt_dlp_cmd}")
        
        # 构造yt-dlp命令
        if self.cookies_file and self.cookies_file.exists():
            cookie_arg = ["--cookies", str(self.cookies_file)]
        else:
            browser_name = self.browser.lower() if self.browser else "chrome"
            cookie_arg = ["--cookies-from-browser", browser_name]
        
        cmd = [
            yt_dlp_cmd,
            "--write-sub",
            "--sub-lang", "ai-zh",
            "--sub-format", "srt",
            "--output", str(self.download_dir / f'{safe_title}.%(ext)s'),
            *cookie_arg,
            url
        ]
        logger.info(f"[subprocess] yt-dlp命令: {' '.join(cmd)}")
        # 2. 执行命令
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(self.download_dir))
        logger.info(f"[subprocess] yt-dlp stdout: {result.stdout}")
        logger.info(f"[subprocess] yt-dlp stderr: {result.stderr}")
        if result.returncode != 0:
            logger.error(f"yt-dlp命令执行失败，返回码: {result.returncode}")
        # 3. 列出下载目录所有文件
        import os
        files = os.listdir(self.download_dir)
        logger.info(f"[subprocess] 下载目录内容: {files}")
        # 4. 查找字幕文件
        subtitle_file = None
        for f in files:
            if f.endswith('.srt') or f.endswith('.ass'):
                subtitle_file = f
                break
        if subtitle_file:
            logger.info(f"[subprocess] 找到字幕文件: {subtitle_file}")
        else:
            logger.warning(f"[subprocess] 未找到字幕文件，标题: {safe_title}")

# 便捷函数
async def download_bilibili_video(
    url: str, 
    download_dir: Optional[Path] = None,
    browser: Optional[str] = None,
    progress_callback: Optional[Callable[[str, float], None]] = None
) -> Dict[str, str]:
    """
    便捷的B站视频下载函数
    
    Args:
        url: B站视频链接
        download_dir: 下载目录
        browser: 浏览器类型
        progress_callback: 进度回调函数
        
    Returns:
        包含video_path和subtitle_path的字典
    """
    downloader = BilibiliDownloader(download_dir, browser)
    return await downloader.download_video_and_subtitle(url, progress_callback)

async def get_bilibili_video_info(url: str, browser: Optional[str] = None, cookies_file: Optional[Path] = None) -> BilibiliVideoInfo:
    """
    便捷的B站视频信息获取函数
    
    Args:
        url: 视频链接
        browser: 浏览器类型
        cookies_file: cookies文件路径
        
    Returns:
        视频信息对象
    """
    downloader = BilibiliDownloader(browser=browser, cookies_file=cookies_file)
    return await downloader.get_video_info(url)