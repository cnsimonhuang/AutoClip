/**
 * AutoClip Desktop - 预加载脚本
 * 提供渲染进程和主进程之间的安全通信
 */

const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // ========== 应用信息 ==========
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // ========== 服务管理 ==========
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  restartFrontend: () => ipcRenderer.invoke('restart-frontend'),
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
  
  // ========== 配置管理 ==========
  // 获取完整配置
  getConfig: () => ipcRenderer.invoke('config-get'),
  
  // 获取配置节
  getConfigSection: (section) => ipcRenderer.invoke('config-get-section', section),
  
  // 更新 FFmpeg 配置
  updateFFmpegConfig: (ffmpegConfig) => ipcRenderer.invoke('config-update-ffmpeg', ffmpegConfig),
  
  // 更新存储配置
  updateStorageConfig: (storageConfig) => ipcRenderer.invoke('config-update-storage', storageConfig),
  
  // 更新 API 配置
  updateApiConfig: (apiConfig) => ipcRenderer.invoke('config-update-api', apiConfig),
  
  // 更新处理参数
  updateProcessingConfig: (processingConfig) => ipcRenderer.invoke('config-update-processing', processingConfig),
  
  // 检测 FFmpeg
  detectFFmpeg: () => ipcRenderer.invoke('config-detect-ffmpeg'),
  
  // 打开配置文件夹
  openConfigDir: () => ipcRenderer.invoke('config-open-dir'),
  
  // 打开存储目录
  openStorageDir: (dirType) => ipcRenderer.invoke('config-open-storage-dir', dirType),
  
  // 重置配置
  resetConfig: () => ipcRenderer.invoke('config-reset'),
  
  // ========== 日志监听 ==========
  onBackendLog: (callback) => {
    ipcRenderer.on('backend-log', (event, data) => callback(data));
  },
  
  onFrontendLog: (callback) => {
    ipcRenderer.on('frontend-log', (event, data) => callback(data));
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// 通知主进程渲染进程已准备好
window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload script loaded');
});
