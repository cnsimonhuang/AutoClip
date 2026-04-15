"""FastAPI应用 - 上传API接口"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
import asyncio
from pathlib import Path

from src.upload.upload_manager import UploadManager
# from src.upload.bilibili_uploader import BilibiliUploader  # 已移除bilitool相关功能

# 创建FastAPI应用
app = FastAPI(
    title="Auto Clips Upload API",
    description="自动切片工具上传API",
    version="1.0.0"
)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局上传管理器
upload_manager = UploadManager()

# Pydantic模型
# class BilibiliCredentials(BaseModel):  # 已移除bilitool相关功能
#     sessdata: str
#     bili_jct: str
#     buvid3: str
#     dedeuserid: str
#     ac_time_value: str

# class UploadTaskRequest(BaseModel):  # 已移除bilitool相关功能
#     video_path: str
#     title: str
#     description: str = ""
#     category_id: int = 21  # 默认日常分区
#     tags: List[str] = []
#     cover_path: Optional[str] = None

# class TaskResponse(BaseModel):  # 已移除bilitool相关功能
#     task_id: str
#     status: str
#     progress: float
#     message: str = ""

@app.get("/")
async def root():
    """根路径"""
    return {"message": "Auto Clips Upload API", "version": "1.0.0"}

# 以下API端点已移除bilitool相关功能
# @app.get("/api/upload/bilibili/categories")
# @app.post("/api/upload/bilibili/credentials")
# @app.get("/api/upload/bilibili/credentials/verify")
# @app.post("/api/upload/bilibili/upload")
# @app.get("/api/upload/tasks/{task_id}")
# @app.get("/api/upload/tasks")
# @app.delete("/api/upload/tasks/{task_id}")

@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "timestamp": asyncio.get_event_loop().time()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)