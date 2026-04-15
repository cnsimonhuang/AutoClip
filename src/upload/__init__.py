"""视频上传模块

支持多平台视频上传功能，包括B站等主流视频平台。
"""

# from .bilibili_uploader import BilibiliUploader  # 已移除bilitool相关功能
from .upload_manager import UploadManager

__all__ = ['UploadManager']