/**
 * AutoClip Desktop - Electron 主进程
 * 管理窗口创建、后端进程启动、前端服务
 */

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const { once } = require('events');

// 导入配置管理模块
const { getConfigManager } = require('./config_manager_desktop');

// 开发模式标志
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

// 窗口对象
let mainWindow = null;
let tray = null;

// 后端服务进程
let backendProcess = null;
let frontendProcess = null;

// 配置管理器
const configManager = getConfigManager();

/**
 * 安全地创建进程日志处理
 * 避免 EPIPE 错误
 */
function safeProcessLogger(process, prefix, stream) {
  stream.on('data', (data) => {
    // 只记录到文件，不输出到控制台，避免 EPIPE
  });
  stream.on('error', () => {
    // 忽略 stream 错误
  });
}

/**
 * 创建系统托盘
 */
function createTray() {
  // 创建托盘图标 - 使用 16x16 小图标（macOS 菜单栏需要小图标）
  const iconPath = isDev 
    ? path.join(__dirname, 'assets', 'icon_tray.png')
    : path.join(process.resourcesPath, 'assets', 'icon_tray.png');
  
  // 检查图标是否存在，不存在则创建空白图标
  let trayIcon;
  if (require('fs').existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
    // macOS 上设置 template 模式，使其适应明暗主题
    if (process.platform === 'darwin') {
      trayIcon.setTemplateImage(true);
    }
  } else {
    // 创建一个 16x16 的空白图标作为后备
    trayIcon = nativeImage.createEmpty();
  }
  
  tray = new Tray(trayIcon);
  tray.setToolTip('AutoClip - 智能视频切片工具');
  
  updateTrayMenu();
  
  // 点击托盘图标：显示/隐藏窗口
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

/**
 * 更新托盘菜单
 */
function updateTrayMenu() {
  if (!tray) return;
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: mainWindow && mainWindow.isVisible() ? '隐藏窗口' : '显示窗口',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    {
      label: '重启后端服务',
      click: async () => {
        if (backendProcess) {
          backendProcess.kill('SIGTERM');
        }
        await startBackend();
      }
    },
    {
      label: '重启前端服务',
      click: async () => {
        if (frontendProcess) {
          frontendProcess.kill('SIGTERM');
        }
        await startFrontend();
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        tray = null;
        stopServices();
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

/**
 * 创建主窗口
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'AutoClip - 智能视频切片工具',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false, // 等内容加载完成后再显示
  });

  // 加载URL
  if (isDev) {
    // 开发模式：等待前端服务启动
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // 生产模式：加载打包后的前端
    // 注意：frontend/dist 在 app.asar 中
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.setTitle('AutoClip - 智能视频切片工具');
    // 创建系统托盘
    if (!tray) {
      createTray();
    }
  });

  // 点击关闭按钮时隐藏到托盘而不是退出
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      updateTrayMenu();
    }
  });

  // 窗口关闭时清理进程（仅在 app.isQuitting 为 true 时）
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 阻止外部链接在 Electron 中打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

/**
 * 启动后端服务 - 使用 venv
 */
function startBackend() {
  return new Promise((resolve, reject) => {
    const backendPath = path.join(__dirname, 'backend_server.py');
    
    // 根据平台选择 Python 路径
    const isWindows = process.platform === 'win32';
    let venvPython;
    if (isWindows) {
      // Windows: 使用 venv 的 Scripts 目录，或回退到系统 Python
      const venvScriptsPython = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
      if (require('fs').existsSync(venvScriptsPython)) {
        venvPython = venvScriptsPython;
      } else {
        venvPython = 'python'; // 回退到系统 Python
      }
    } else {
      // macOS/Linux: 使用 venv 的 bin 目录
      venvPython = path.join(__dirname, 'venv', 'bin', 'python3');
      // 如果 venv 不存在，回退到系统 Python
      if (!require('fs').existsSync(venvPython)) {
        venvPython = 'python3';
      }
    }
    
    // 检查后端文件是否存在
    if (!require('fs').existsSync(backendPath)) {
      console.error('Backend file not found:', backendPath);
      reject(new Error('后端文件不存在'));
      return;
    }

    // 获取配置中的环境变量
    const userDataPath = app.getPath('userData');
    const backendEnv = {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      // macOS SIP 限制：使用用户数据目录存储可写数据
      'AUTO_CLIP_DATA_DIR': path.join(userDataPath, 'data'),
      'AUTO_CLIP_UPLOADS_DIR': path.join(userDataPath, 'uploads'),
      ...configManager.getBackendEnv()
    };

    console.log('Starting backend server...');
    console.log('Backend path:', backendPath);
    console.log('Python path:', venvPython);
    console.log('User data path:', userDataPath);
    console.log('Process platform:', process.platform);
    
    backendProcess = spawn(venvPython, [backendPath], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: backendEnv
    });

    let started = false;

    safeProcessLogger(backendProcess, 'Backend', backendProcess.stdout);
    safeProcessLogger(backendProcess, 'Backend Error', backendProcess.stderr);

    backendProcess.on('error', (err) => {
      console.error('Backend process error:', err);
      // Windows 详细错误信息
      if (process.platform === 'win32') {
        console.error('Windows Error: Could not start Python backend');
        console.error('Please ensure Python is installed and in PATH');
        console.error('Try running "python --version" in CMD to verify');
      }
    });

    backendProcess.on('exit', (code) => {
      console.log('Backend process exited with code:', code);
      backendProcess = null;
    });

    // 检查是否启动成功
    const checkStart = setInterval(() => {
      if (!started && backendProcess) {
        try {
          // 发送健康检查
          const http = require('http');
          const req = http.get('http://localhost:8000/docs', (res) => {
            if (res.statusCode === 200) {
              started = true;
              clearInterval(checkStart);
              resolve(true);
            }
          });
          req.on('error', () => {});
          req.setTimeout(1000, () => req.destroy());
        } catch (e) {}
      }
    }, 500);

    // 超时处理 - 8秒后不管有没有启动都继续
    setTimeout(() => {
      clearInterval(checkStart);
      console.log('Backend start timeout, continuing...');
      resolve(true);
    }, 8000);
  });
}

/**
 * 启动前端服务
 */
function startFrontend() {
  return new Promise((resolve, reject) => {
    const frontendDir = path.join(__dirname, 'frontend');
    
    // 检查前端目录是否存在
    if (!require('fs').existsSync(frontendDir)) {
      console.error('Frontend directory not found:', frontendDir);
      reject(new Error('前端目录不存在'));
      return;
    }

    console.log('Starting frontend server...');
    
    frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: frontendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });

    safeProcessLogger(frontendProcess, 'Frontend', frontendProcess.stdout);
    safeProcessLogger(frontendProcess, 'Frontend Error', frontendProcess.stderr);

    frontendProcess.on('error', (err) => {
      console.error('Frontend process error:', err);
    });

    frontendProcess.on('exit', (code) => {
      console.log('Frontend process exited with code:', code);
      frontendProcess = null;
    });

    // 等待前端启动 - 检查端口
    const checkStart = setInterval(() => {
      try {
        const http = require('http');
        const req = http.get('http://localhost:3000', (res) => {
          clearInterval(checkStart);
          resolve(true);
        });
        req.on('error', () => {});
        req.setTimeout(1000, () => req.destroy());
      } catch (e) {}
    }, 500);

    // 超时处理 - 8秒
    setTimeout(() => {
      clearInterval(checkStart);
      resolve(true);
    }, 8000);
  });
}

/**
 * 停止所有服务
 */
function stopServices() {
  console.log('Stopping services...');
  
  if (backendProcess) {
    try {
      backendProcess.kill('SIGTERM');
      setTimeout(() => {
        if (backendProcess) {
          backendProcess.kill('SIGKILL');
        }
      }, 2000);
    } catch (e) {
      console.error('Error killing backend:', e);
    }
    backendProcess = null;
  }
  
  if (frontendProcess) {
    try {
      frontendProcess.kill('SIGTERM');
      setTimeout(() => {
        if (frontendProcess) {
          frontendProcess.kill('SIGKILL');
        }
      }, 2000);
    } catch (e) {
      console.error('Error killing frontend:', e);
    }
    frontendProcess = null;
  }
}

// App 退出标志
app.isQuitting = false;

// App 准备完成
app.whenReady().then(async () => {
  console.log('AutoClip Desktop starting...');
  console.log('App path:', __dirname);
  console.log('Production mode:', !isDev);
  
  try {
    if (isDev) {
      // 开发模式：先启动后端和前端服务
      console.log('Starting frontend and backend services...');
      await startFrontend();
      await startBackend();
    } else {
      // 生产模式：只启动后端服务
      console.log('Starting backend service...');
      await startBackend();
    }
    
    // 创建窗口
    createWindow();
    
  } catch (error) {
    console.error('Failed to start:', error);
    app.quit();
  }
});

// 所有窗口关闭
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopServices();
});

// IPC 处理
ipcMain.handle('get-app-info', () => {
  return {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    isDev: isDev
  };
});

ipcMain.handle('restart-backend', async () => {
  try {
    if (backendProcess) {
      backendProcess.kill('SIGTERM');
    }
    await startBackend();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('restart-frontend', async () => {
  try {
    if (frontendProcess) {
      frontendProcess.kill('SIGTERM');
    }
    await startFrontend();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-backend-status', () => {
  return {
    running: backendProcess !== null,
    pid: backendProcess ? backendProcess.pid : null
  };
});

// ========== 配置管理 IPC 处理 ==========

ipcMain.handle('config-get', () => {
  return configManager.exportConfig();
});

ipcMain.handle('config-get-section', (event, section) => {
  return configManager.getConfigSection(section);
});

ipcMain.handle('config-update-ffmpeg', async (event, ffmpegConfig) => {
  return await configManager.updateFFmpegConfig(ffmpegConfig);
});

ipcMain.handle('config-update-storage', (event, storageConfig) => {
  return configManager.updateStorageConfig(storageConfig);
});

ipcMain.handle('config-update-api', (event, apiConfig) => {
  return configManager.updateApiConfig(apiConfig);
});

ipcMain.handle('config-update-processing', (event, processingConfig) => {
  return configManager.updateProcessingConfig(processingConfig);
});

ipcMain.handle('config-detect-ffmpeg', async () => {
  return await configManager.detectFFmpeg();
});

ipcMain.handle('config-open-dir', () => {
  configManager.openConfigDir();
  return { success: true };
});

ipcMain.handle('config-open-storage-dir', (event, dirType) => {
  configManager.openStorageDir(dirType);
  return { success: true };
});

ipcMain.handle('config-reset', () => {
  return configManager.resetConfig();
});
