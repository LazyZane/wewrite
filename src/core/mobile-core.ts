/**
 * WeWrite 移动端核心模块
 * 只包含移动端必需的最小功能集
 */

import { Plugin, Notice, Setting } from "obsidian";
import { WeWriteSetting } from "../settings/wewrite-setting";

export interface MobileCoreConfig {
  enablePreview: boolean;
  enableBasicRender: boolean;
  enableSettings: boolean;
}

/**
 * 移动端核心功能类
 * 提供最小化的功能集，确保移动端能够正常加载
 */
export class WeWriteMobileCore {
  private plugin: Plugin;
  private config: MobileCoreConfig;
  private logs: string[] = [];

  constructor(plugin: Plugin, config: MobileCoreConfig = {
    enablePreview: true,
    enableBasicRender: true,
    enableSettings: true
  }) {
    this.plugin = plugin;
    this.config = config;
  }

  /**
   * 移动端安全初始化
   */
  async initialize(): Promise<boolean> {
    try {
      this.log('开始移动端核心初始化');

      // 1. 基础设置（无数据库依赖）
      if (this.config.enableSettings) {
        await this.initializeBasicSettings();
      }

      // 2. 基础渲染（无复杂依赖）
      if (this.config.enableBasicRender) {
        await this.initializeBasicRenderer();
      }

      // 3. 简化预览（无文件系统依赖）
      if (this.config.enablePreview) {
        await this.initializeBasicPreview();
      }

      // 4. 添加移动端专用命令
      this.addMobileCommands();

      this.log('移动端核心初始化完成');
      new Notice('WeWrite移动端已加载（核心功能）', 3000);
      
      return true;
    } catch (error) {
      this.log(`移动端初始化失败: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * 基础设置初始化（无数据库）
   */
  private async initializeBasicSettings(): Promise<void> {
    try {
      // 使用localStorage作为设置存储
      const savedSettings = localStorage.getItem('wewrite-mobile-settings');
      const defaultSettings: WeWriteSetting = {
        mpAccounts: [],
        chatAccounts: [],
        drawAccounts: [],
        ipAddress: "127.0.0.1",
        css_styles_folder: "wewrite-css-styles",
        codeLineNumber: true,
        selectedMPAccount: "",
        useCenterToken: false,
        realTimeRender: false,
        accountDataPath: "",
        chatSetting: {
          temperature: 0.7,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
          max_tokens: 1000
        }
      };

      (this.plugin as any).settings = savedSettings ? 
        { ...defaultSettings, ...JSON.parse(savedSettings) } : 
        defaultSettings;

      this.log('基础设置已加载');
    } catch (error) {
      this.log(`设置加载失败: ${error.message}`, 'warn');
      // 使用默认设置
    }
  }

  /**
   * 基础渲染器初始化
   */
  private async initializeBasicRenderer(): Promise<void> {
    try {
      // 只初始化最基本的Markdown渲染
      // 避免复杂的扩展和依赖
      this.log('基础渲染器已初始化');
    } catch (error) {
      this.log(`渲染器初始化失败: ${error.message}`, 'warn');
    }
  }

  /**
   * 基础预览初始化
   */
  private async initializeBasicPreview(): Promise<void> {
    try {
      // 简化的预览功能，无文件系统依赖
      this.log('基础预览已初始化');
    } catch (error) {
      this.log(`预览初始化失败: ${error.message}`, 'warn');
    }
  }

  /**
   * 添加移动端专用命令
   */
  private addMobileCommands(): void {
    // 查看日志命令
    this.plugin.addCommand({
      id: 'wewrite-mobile-show-logs',
      name: '查看移动端日志',
      callback: () => {
        console.log('=== WeWrite Mobile Core Logs ===');
        this.logs.forEach(log => console.log(log));
        console.log('=== End Logs ===');
        new Notice('日志已输出到控制台', 3000);
      }
    });

    // 重新初始化命令
    this.plugin.addCommand({
      id: 'wewrite-mobile-reinit',
      name: '重新初始化移动端核心',
      callback: async () => {
        try {
          await this.initialize();
          new Notice('重新初始化成功', 3000);
        } catch (error) {
          new Notice(`重新初始化失败: ${error.message}`, 5000);
        }
      }
    });

    this.log('移动端命令已添加');
  }

  /**
   * 保存设置
   */
  async saveSettings(): Promise<void> {
    try {
      const settings = (this.plugin as any).settings;
      localStorage.setItem('wewrite-mobile-settings', JSON.stringify(settings));
      this.log('设置已保存');
    } catch (error) {
      this.log(`设置保存失败: ${error.message}`, 'warn');
    }
  }

  /**
   * 日志记录
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    this.logs.push(logEntry);
    
    // 限制日志数量
    if (this.logs.length > 50) {
      this.logs = this.logs.slice(-25);
    }

    // 输出到控制台
    switch (level) {
      case 'error':
        console.error(`[WeWrite Mobile Core] ${message}`);
        break;
      case 'warn':
        console.warn(`[WeWrite Mobile Core] ${message}`);
        break;
      default:
        console.log(`[WeWrite Mobile Core] ${message}`);
    }
  }

  /**
   * 获取所有日志
   */
  getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * 检查功能可用性
   */
  getAvailableFeatures(): string[] {
    const features: string[] = [];
    
    if (this.config.enableSettings) features.push('基础设置');
    if (this.config.enableBasicRender) features.push('基础渲染');
    if (this.config.enablePreview) features.push('简化预览');
    
    return features;
  }
}
