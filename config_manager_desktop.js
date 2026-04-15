/**
 * AutoClip Desktop - 配置管理模块
 * 管理 FFmpeg 路径、视频存储目录、AI API 配置等
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const { shell } = require('electron');

// 配置默认值
const DEFAULT_CONFIG = {
  ffmpeg: {
    path: '',  // 自动检测
    probePath: ''  // 自动检测
  },
  storage: {
    videoDir: '',  // 默认视频存储目录
    outputDir: '',  // 默认输出目录
    tempDir: ''  // 临时文件目录
  },
  api: {
    provider: 'dashscope',  // dashscope 或 siliconflow
    dashscopeApiKey: '',
    siliconflowApiKey: '',
    modelName: '',
    siliconflowModel: ''
  },
  processing: {
    chunkSize: 5000,
    minScoreThreshold: 0.7,
    maxClipsPerCollection: 5,
    maxRetries: 3,
    timeoutSeconds: 30
  },
  app: {
    port: 8000,
    frontendPort: 3000,
    autoStartBackend: true,
    autoStartFrontend: true
  }
};

class ConfigManagerDesktop {
  constructor() {
    this.configDir = path.join(app.getPath('userData'), 'config');
    this.configFile = path.join(this.configDir, 'autoclip_config.json');
    this.config = this._loadConfig();
  }

  /**
   * 加载配置
   */
  _loadConfig() {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }

      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf-8');
        const loaded = JSON.parse(data);
        // 合并默认配置，确保新字段有默认值
        return this._deepMerge(DEFAULT_CONFIG, loaded);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }

    // 返回默认配置
    return { ...DEFAULT_CONFIG };
  }

  /**
   * 保存配置
   */
  _saveConfig() {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('Failed to save config:', error);
      return false;
    }
  }

  /**
   * 深度合并对象
   */
  _deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  /**
   * 检测 FFmpeg 是否安装及其路径
   */
  async detectFFmpeg() {
    return new Promise((resolve) => {
      const result = { found: false, ffmpeg: '', ffprobe: '', error: '' };

      // 先尝试直接调用 ffmpeg
      const tryExec = (command) => {
        return new Promise((res) => {
          exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
            if (error) {
              res(null);
            } else {
              res(stdout ? stdout.trim() : stderr.trim());
            }
          });
        });
      };

      // 检测顺序：系统路径 -> Homebrew -> 默认安装位置
      const candidates = [
        'ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/usr/bin/ffmpeg',
        '/opt/homebrew/bin/ffmpeg',
        '/opt/local/bin/ffmpeg'
      ];

      const detect = async () => {
        for (const ffmpegPath of candidates) {
          const version = await tryExec(`${ffmpegPath} -version`);
          if (version) {
            result.found = true;
            result.ffmpeg = ffmpegPath;

            // 尝试检测 ffprobe
            const ffprobePath = ffmpegPath.replace('ffmpeg', 'ffprobe');
            const probeVersion = await tryExec(`${ffprobePath} -version`);
            if (probeVersion) {
              result.ffprobe = ffprobePath;
            } else {
              // 尝试其他位置的 ffprobe
              const probeCandidates = [
                '/usr/local/bin/ffprobe',
                '/usr/bin/ffprobe',
                '/opt/homebrew/bin/ffprobe',
                '/opt/local/bin/ffprobe'
              ];
              for (const p of probeCandidates) {
                const pv = await tryExec(`${p} -version`);
                if (pv) {
                  result.ffprobe = p;
                  break;
                }
              }
            }
            break;
          }
        }
        resolve(result);
      };

      detect();
    });
  }

  /**
   * 获取默认存储目录
   */
  getDefaultStorageDirs() {
    const documentsDir = app.getPath('documents');
    const tempDir = app.getPath('temp');

    return {
      videoDir: path.join(documentsDir, 'AutoClip', 'Videos'),
      outputDir: path.join(documentsDir, 'AutoClip', 'Output'),
      tempDir: path.join(tempDir, 'AutoClip')
    };
  }

  /**
   * 获取完整配置
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 获取特定配置节
   */
  getConfigSection(section) {
    if (this.config[section]) {
      return { ...this.config[section] };
    }
    return null;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    this.config = this._deepMerge(this.config, newConfig);
    return this._saveConfig();
  }

  /**
   * 更新 FFmpeg 配置
   */
  async updateFFmpegConfig(ffmpegConfig) {
    if (ffmpegConfig.autoDetect) {
      const detection = await this.detectFFmpeg();
      if (detection.found) {
        this.config.ffmpeg.path = detection.ffmpeg;
        this.config.ffmpeg.probePath = detection.ffprobe;
      } else {
        return { success: false, error: '未检测到 FFmpeg，请手动安装或指定路径' };
      }
    } else if (ffmpegConfig.path) {
      // 验证路径是否有效
      if (!fs.existsSync(ffmpegConfig.path)) {
        return { success: false, error: 'FFmpeg 路径不存在' };
      }
      this.config.ffmpeg.path = ffmpegConfig.path;
      this.config.ffmpeg.probePath = ffmpegConfig.probePath || ffmpegConfig.path.replace('ffmpeg', 'ffprobe');
    }

    this._saveConfig();
    return { success: true, config: this.config.ffmpeg };
  }

  /**
   * 更新存储配置
   */
  updateStorageConfig(storageConfig) {
    const defaults = this.getDefaultStorageDirs();

    if (storageConfig.videoDir) {
      if (!fs.existsSync(storageConfig.videoDir)) {
        try {
          fs.mkdirSync(storageConfig.videoDir, { recursive: true });
        } catch (e) {
          return { success: false, error: `无法创建目录: ${storageConfig.videoDir}` };
        }
      }
      this.config.storage.videoDir = storageConfig.videoDir;
    } else {
      this.config.storage.videoDir = defaults.videoDir;
    }

    if (storageConfig.outputDir) {
      if (!fs.existsSync(storageConfig.outputDir)) {
        try {
          fs.mkdirSync(storageConfig.outputDir, { recursive: true });
        } catch (e) {
          return { success: false, error: `无法创建目录: ${storageConfig.outputDir}` };
        }
      }
      this.config.storage.outputDir = storageConfig.outputDir;
    } else {
      this.config.storage.outputDir = defaults.outputDir;
    }

    if (storageConfig.tempDir) {
      this.config.storage.tempDir = storageConfig.tempDir;
    } else {
      this.config.storage.tempDir = defaults.tempDir;
    }

    this._saveConfig();
    return { success: true, config: this.config.storage };
  }

  /**
   * 更新 API 配置
   */
  updateApiConfig(apiConfig) {
    if (apiConfig.provider) {
      this.config.api.provider = apiConfig.provider;
    }
    if (apiConfig.dashscopeApiKey !== undefined) {
      this.config.api.dashscopeApiKey = apiConfig.dashscopeApiKey;
    }
    if (apiConfig.siliconflowApiKey !== undefined) {
      this.config.api.siliconflowApiKey = apiConfig.siliconflowApiKey;
    }
    if (apiConfig.modelName) {
      this.config.api.modelName = apiConfig.modelName;
    }
    if (apiConfig.siliconflowModel) {
      this.config.api.siliconflowModel = apiConfig.siliconflowModel;
    }

    this._saveConfig();
    return { success: true, config: this.config.api };
  }

  /**
   * 更新处理参数
   */
  updateProcessingConfig(processingConfig) {
    const merged = this._deepMerge(this.config.processing, processingConfig);

    // 验证参数
    if (merged.minScoreThreshold < 0 || merged.minScoreThreshold > 1) {
      return { success: false, error: '评分阈值必须在 0-1 之间' };
    }
    if (merged.chunkSize <= 0) {
      return { success: false, error: '分块大小必须大于 0' };
    }

    this.config.processing = merged;
    this._saveConfig();
    return { success: true, config: this.config.processing };
  }

  /**
   * 打开配置文件夹
   */
  openConfigDir() {
    shell.openPath(this.configDir);
  }

  /**
   * 打开存储目录
   */
  openStorageDir(dirType = 'output') {
    const dir = this.config.storage[`${dirType}Dir`];
    if (dir && fs.existsSync(dir)) {
      shell.openPath(dir);
    } else {
      // 打开默认目录
      const defaults = this.getDefaultStorageDirs();
      shell.openPath(defaults[dirType] || defaults.outputDir);
    }
  }

  /**
   * 重置配置为默认值
   */
  resetConfig() {
    this.config = { ...DEFAULT_CONFIG };
    const defaults = this.getDefaultStorageDirs();
    this.config.storage = {
      videoDir: defaults.videoDir,
      outputDir: defaults.outputDir,
      tempDir: defaults.tempDir
    };
    this._saveConfig();
    return { success: true, config: this.config };
  }

  /**
   * 导出配置（隐藏敏感信息）
   */
  exportConfig() {
    const exportData = JSON.parse(JSON.stringify(this.config));

    // 隐藏 API 密钥
    if (exportData.api.dashscopeApiKey) {
      const key = exportData.api.dashscopeApiKey;
      exportData.api.dashscopeApiKey = key.length > 8 ? key.substring(0, 4) + '...' + key.substring(key.length - 4) : '****';
    }
    if (exportData.api.siliconflowApiKey) {
      const key = exportData.api.siliconflowApiKey;
      exportData.api.siliconflowApiKey = key.length > 8 ? key.substring(0, 4) + '...' + key.substring(key.length - 4) : '****';
    }

    return exportData;
  }

  /**
   * 获取后端环境变量
   */
  getBackendEnv() {
    const env = {
      PYTHONUNBUFFERED: '1'
    };

    if (this.config.api.dashscopeApiKey) {
      env.DASHSCOPE_API_KEY = this.config.api.dashscopeApiKey;
    }
    if (this.config.api.siliconflowApiKey) {
      env.SILICONFLOW_API_KEY = this.config.api.siliconflowApiKey;
    }
    if (this.config.api.provider) {
      env.API_PROVIDER = this.config.api.provider;
    }
    if (this.config.api.modelName) {
      env.MODEL_NAME = this.config.api.modelName;
    }
    if (this.config.api.siliconflowModel) {
      env.SILICONFLOW_MODEL = this.config.api.siliconflowModel;
    }

    // FFmpeg 路径
    if (this.config.ffmpeg.path) {
      env.FFMPEG_PATH = this.config.ffmpeg.path;
    }
    if (this.config.ffmpeg.probePath) {
      env.FFPROBE_PATH = this.config.ffmpeg.probePath;
    }

    // 存储路径
    if (this.config.storage.outputDir) {
      env.OUTPUT_DIR = this.config.storage.outputDir;
    }

    return env;
  }
}

// 导出单例
let instance = null;

module.exports = {
  ConfigManagerDesktop,
  getConfigManager: () => {
    if (!instance) {
      instance = new ConfigManagerDesktop();
    }
    return instance;
  }
};
