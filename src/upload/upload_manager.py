"""上传管理器

统一管理多平台视频上传功能。
"""

import asyncio
import os
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
import logging
from enum import Enum

# from .bilibili_uploader import BilibiliUploader  # 已移除bilitool相关功能
from ..utils.error_handler import safe_execute, error_handler

logger = logging.getLogger(__name__)

class Platform(Enum):
    """支持的平台枚举"""
    BILIBILI = "bilibili"
    # 未来可以扩展其他平台
    # YOUTUBE = "youtube"
    # DOUYIN = "douyin"

class UploadStatus(Enum):
    """上传状态枚举"""
    PENDING = "pending"      # 等待中
    UPLOADING = "uploading"  # 上传中
    SUCCESS = "success"      # 成功
    FAILED = "failed"        # 失败
    CANCELLED = "cancelled"  # 已取消

class UploadTask:
    """上传任务"""
    
    def __init__(
        self,
        task_id: str,
        platform: Platform,
        video_path: str,
        title: str,
        desc: str = "",
        tags: Optional[List[str]] = None,
        cover_path: Optional[str] = None,
        **kwargs
    ):
        self.task_id = task_id
        self.platform = platform
        self.video_path = video_path
        self.title = title
        self.desc = desc
        self.tags = tags or []
        self.cover_path = cover_path
        self.kwargs = kwargs
        
        self.status = UploadStatus.PENDING
        self.progress = 0
        self.result: Optional[Dict[str, Any]] = None
        self.error: Optional[str] = None
        self.created_at = None
        self.started_at = None
        self.completed_at = None

class UploadManager:
    """上传管理器"""
    
    def __init__(self):
        self.uploaders = {
            # Platform.BILIBILI: BilibiliUploader()  # 已移除bilitool相关功能
        }
        self.tasks: Dict[str, UploadTask] = {}
        self.active_tasks: Dict[str, asyncio.Task] = {}
        
    def set_bilibili_credential(self, sessdata: str, bili_jct: str, buvid3: str = ""):
        """设置B站登录凭证
        
        Args:
            sessdata: 会话数据
            bili_jct: CSRF令牌
            buvid3: 浏览器标识
        """
        self.uploaders[Platform.BILIBILI].set_credential(sessdata, bili_jct, buvid3)
        
    async def verify_platform_credential(self, platform: Platform) -> bool:
        """验证平台凭证
        
        Args:
            platform: 平台类型
            
        Returns:
            bool: 凭证是否有效
        """
        if platform not in self.uploaders:
            logger.error(f"不支持的平台：{platform.value}")
            return False
            
        uploader = self.uploaders[platform]
        if hasattr(uploader, 'verify_credential'):
            return await uploader.verify_credential()
        return False
    
    async def create_upload_task(
        self,
        task_id: str,
        platform: Platform,
        video_path: str,
        title: str,
        desc: str = "",
        tags: Optional[List[str]] = None,
        cover_path: Optional[str] = None,
        auto_start: bool = True,
        **kwargs
    ) -> UploadTask:
        """创建上传任务
        
        Args:
            task_id: 任务ID
            platform: 目标平台
            video_path: 视频文件路径
            title: 视频标题
            desc: 视频描述
            tags: 视频标签
            cover_path: 封面路径
            auto_start: 是否自动开始上传
            **kwargs: 其他参数
            
        Returns:
            UploadTask: 创建的上传任务
        """
        # 验证参数
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"视频文件不存在：{video_path}")
            
        if platform not in self.uploaders:
            raise ValueError(f"不支持的平台：{platform.value}")
            
        if task_id in self.tasks:
            raise ValueError(f"任务ID已存在：{task_id}")
        
        # 创建任务
        task = UploadTask(
            task_id=task_id,
            platform=platform,
            video_path=video_path,
            title=title,
            desc=desc,
            tags=tags,
            cover_path=cover_path,
            **kwargs
        )
        
        self.tasks[task_id] = task
        logger.info(f"创建上传任务：{task_id} -> {platform.value}")
        
        # 自动开始上传
        if auto_start:
            await self.start_upload(task_id)
            
        return task
    
    async def start_upload(self, task_id: str) -> bool:
        """开始上传任务
        
        Args:
            task_id: 任务ID
            
        Returns:
            bool: 是否成功开始
        """
        if task_id not in self.tasks:
            logger.error(f"任务不存在：{task_id}")
            return False
            
        task = self.tasks[task_id]
        
        if task.status != UploadStatus.PENDING:
            logger.warning(f"任务状态不正确：{task_id} - {task.status.value}")
            return False
            
        # 创建异步上传任务
        upload_coroutine = self._execute_upload(task)
        async_task = asyncio.create_task(upload_coroutine)
        self.active_tasks[task_id] = async_task
        
        task.status = UploadStatus.UPLOADING
        logger.info(f"开始上传任务：{task_id}")
        
        return True
    
    async def _execute_upload(self, task: UploadTask):
        """执行上传任务
        
        Args:
            task: 上传任务
        """
        try:
            uploader = self.uploaders[task.platform]
            
            # 执行上传 (已移除 bilitool 相关功能)
            # if task.platform == Platform.BILIBILI:
            #     result = await uploader.upload_video(
            #         video_path=task.video_path,
            #         title=task.title,
            #         desc=task.desc,
            #         tags=task.tags,
            #         cover_path=task.cover_path,
            #         **task.kwargs
            #     )
            # else:
            raise NotImplementedError(f"平台 {task.platform.value} 暂未实现 (已移除 bilitool 相关功能)")
            
            # 由于功能已移除，直接设置为失败状态
            task.status = UploadStatus.FAILED
            task.error = "平台暂未实现"
            logger.error(f"上传失败：{task.task_id} - 平台暂未实现")
                
        except asyncio.CancelledError:
            task.status = UploadStatus.CANCELLED
            logger.info(f"上传已取消：{task.task_id}")
        except Exception as e:
            task.status = UploadStatus.FAILED
            task.error = str(e)
            logger.error(f"上传异常：{task.task_id} - {str(e)}")
        finally:
            # 清理活跃任务
            if task.task_id in self.active_tasks:
                del self.active_tasks[task.task_id]
        
        return False
    
    async def cancel_upload(self, task_id: str) -> bool:
        """取消上传任务
        
        Args:
            task_id: 任务ID
            
        Returns:
            bool: 是否成功取消
        """
        if task_id not in self.tasks:
            logger.error(f"任务不存在：{task_id}")
            return False
            
        task = self.tasks[task_id]
        
        # 取消异步任务
        if task_id in self.active_tasks:
            async_task = self.active_tasks[task_id]
            async_task.cancel()
            
        # 调用平台特定的取消方法
        uploader = self.uploaders[task.platform]
        if hasattr(uploader, 'cancel_upload'):
            await uploader.cancel_upload()
            
        task.status = UploadStatus.CANCELLED
        logger.info(f"已取消上传：{task_id}")
        
        return True
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务状态
        
        Args:
            task_id: 任务ID
            
        Returns:
            Dict: 任务状态信息
        """
        if task_id not in self.tasks:
            return None
            
        task = self.tasks[task_id]
        
        return {
            "task_id": task.task_id,
            "platform": task.platform.value,
            "status": task.status.value,
            "progress": task.progress,
            "title": task.title,
            "result": task.result,
            "error": task.error,
            "created_at": task.created_at,
            "started_at": task.started_at,
            "completed_at": task.completed_at
        }
    
    def get_all_tasks(self) -> List[Dict[str, Any]]:
        """获取所有任务状态
        
        Returns:
            List: 所有任务状态列表
        """
        return [task_status for task_id in self.tasks.keys() 
                if (task_status := self.get_task_status(task_id)) is not None]
    
    def get_platform_categories(self, platform: Platform) -> List[Dict[str, Any]]:
        """获取平台分区列表
        
        Args:
            platform: 平台类型
            
        Returns:
            List: 分区列表
        """
        if platform not in self.uploaders:
            return []
            
        uploader = self.uploaders[platform]
        if hasattr(uploader, 'get_video_categories'):
            return uploader.get_video_categories()
        return []
    

    
    # def set_bilibili_credential(self, **kwargs) -> bool:
    #     """设置B站登录凭证（交互式登录） (已移除 bilitool 相关功能)
    #     
    #     Returns:
    #         bool: 设置是否成功
    #     """
    #     if Platform.BILIBILI not in self.uploaders:
    #         return False
    #         
    #     uploader = self.uploaders[Platform.BILIBILI]
    #     if hasattr(uploader, 'login_interactive'):
    #         return uploader.login_interactive(**kwargs)
    #     return False
    
    def get_platform_status(self, platform: Platform) -> Dict[str, Any]:
        """获取平台状态
        
        Args:
            platform: 平台类型
            
        Returns:
            Dict: 平台状态信息
        """
        if platform not in self.uploaders:
            return {"available": False, "error": "平台不支持"}
            
        uploader = self.uploaders[platform]
        if hasattr(uploader, 'get_upload_status'):
            return uploader.get_upload_status()
        return {"available": True}
    
    async def cleanup_completed_tasks(self, keep_recent: int = 10):
        """清理已完成的任务
        
        Args:
            keep_recent: 保留最近的任务数量
        """
        completed_tasks = [
            task_id for task_id, task in self.tasks.items()
            if task.status in [UploadStatus.SUCCESS, UploadStatus.FAILED, UploadStatus.CANCELLED]
        ]
        
        if len(completed_tasks) > keep_recent:
            # 按创建时间排序，删除最旧的任务
            sorted_tasks = sorted(
                completed_tasks,
                key=lambda tid: self.tasks[tid].created_at or 0,
                reverse=True
            )
            
            tasks_to_remove = sorted_tasks[keep_recent:]
            for task_id in tasks_to_remove:
                del self.tasks[task_id]
                logger.info(f"清理已完成任务：{task_id}")

# 全局上传管理器实例
upload_manager = UploadManager()