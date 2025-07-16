/**
 * 平台检测服务 - WeWrite v3.0 架构改造
 * 负责检测当前运行平台并提供平台相关信息
 */

export type Platform = 'desktop' | 'mobile';

export interface ScreenInfo {
  width: number;
  height: number;
  devicePixelRatio: number;
  touchSupport: boolean;
  orientation?: 'portrait' | 'landscape';
}

export interface PlatformCapabilities {
  hasClipboardAPI: boolean;
  hasFileSystemAPI: boolean;
  hasNotificationAPI: boolean;
  hasElectronAPI: boolean;
  maxMemoryMB: number;
  supportedImageFormats: string[];
}

/**
 * 平台检测器
 * 提供统一的平台检测和能力查询接口
 */
export class PlatformDetector {
  private static _instance: PlatformDetector;
  private _platform: Platform;
  private _screenInfo: ScreenInfo;
  private _capabilities: PlatformCapabilities;

  private constructor() {
    this._platform = this.detectPlatform();
    this._screenInfo = this.getScreenInformation();
    this._capabilities = this.detectCapabilities();
  }

  public static getInstance(): PlatformDetector {
    if (!PlatformDetector._instance) {
      PlatformDetector._instance = new PlatformDetector();
    }
    return PlatformDetector._instance;
  }

  /**
   * 检测当前运行平台
   * @returns 平台类型
   */
  public static detect(): Platform {
    return PlatformDetector.getInstance().platform;
  }

  /**
   * 获取屏幕信息
   * @returns 屏幕相关信息
   */
  public static getScreenInfo(): ScreenInfo {
    return PlatformDetector.getInstance().screenInfo;
  }

  /**
   * 获取平台能力
   * @returns 平台支持的功能列表
   */
  public static getCapabilities(): PlatformCapabilities {
    return PlatformDetector.getInstance().capabilities;
  }

  /**
   * 检查是否为移动端
   * @returns 是否为移动端
   */
  public static isMobile(): boolean {
    return PlatformDetector.detect() === 'mobile';
  }

  /**
   * 检查是否为桌面端
   * @returns 是否为桌面端
   */
  public static isDesktop(): boolean {
    return PlatformDetector.detect() === 'desktop';
  }

  // Getter methods
  public get platform(): Platform {
    return this._platform;
  }

  public get screenInfo(): ScreenInfo {
    return this._screenInfo;
  }

  public get capabilities(): PlatformCapabilities {
    return this._capabilities;
  }

  /**
   * 检测平台类型的核心逻辑
   */
  private detectPlatform(): Platform {
    // 首先检查Obsidian的移动端标识
    if (typeof window !== 'undefined' && (window as any).app?.isMobile) {
      return 'mobile';
    }

    // 检查用户代理字符串
    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = [
        'android', 'iphone', 'ipad', 'ipod', 
        'blackberry', 'windows phone', 'mobile'
      ];
      
      if (mobileKeywords.some(keyword => userAgent.includes(keyword))) {
        return 'mobile';
      }
    }

    // 检查触摸支持和屏幕尺寸
    if (typeof window !== 'undefined') {
      const hasTouchSupport = 'ontouchstart' in window || 
                             navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 768;
      
      if (hasTouchSupport && isSmallScreen) {
        return 'mobile';
      }
    }

    return 'desktop';
  }

  /**
   * 获取屏幕信息
   */
  private getScreenInformation(): ScreenInfo {
    if (typeof window === 'undefined') {
      return {
        width: 1920,
        height: 1080,
        devicePixelRatio: 1,
        touchSupport: false,
        orientation: 'landscape'
      };
    }

    const orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';

    return {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      orientation
    };
  }

  /**
   * 检测平台能力
   */
  private detectCapabilities(): PlatformCapabilities {
    const capabilities: PlatformCapabilities = {
      hasClipboardAPI: false,
      hasFileSystemAPI: false,
      hasNotificationAPI: false,
      hasElectronAPI: false,
      maxMemoryMB: 512, // 默认值
      supportedImageFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp']
    };

    if (typeof window === 'undefined') {
      return capabilities;
    }

    // 检查剪贴板API
    capabilities.hasClipboardAPI = !!(navigator.clipboard && navigator.clipboard.writeText);

    // 检查文件系统API
    capabilities.hasFileSystemAPI = !!(window as any).showOpenFilePicker;

    // 检查通知API
    capabilities.hasNotificationAPI = !!window.Notification;

    // 检查Electron环境
    capabilities.hasElectronAPI = !!(window as any).require || !!(window as any).electron;

    // 估算可用内存（移动端通常较少）
    if (this._platform === 'mobile') {
      capabilities.maxMemoryMB = 256;
      // 移动端可能不支持某些图片格式
      capabilities.supportedImageFormats = ['png', 'jpg', 'jpeg'];
    } else {
      capabilities.maxMemoryMB = 1024;
    }

    return capabilities;
  }

  /**
   * 监听屏幕变化
   */
  public onScreenChange(callback: (screenInfo: ScreenInfo) => void): () => void {
    const handler = () => {
      this._screenInfo = this.getScreenInformation();
      callback(this._screenInfo);
    };

    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);

    // 返回清理函数
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }

  /**
   * 获取平台特定的配置建议
   */
  public getRecommendedConfig(): {
    maxConcurrentTasks: number;
    cacheSize: number;
    renderBatchSize: number;
    enableVirtualScrolling: boolean;
  } {
    if (this._platform === 'mobile') {
      return {
        maxConcurrentTasks: 2,
        cacheSize: 50,
        renderBatchSize: 10,
        enableVirtualScrolling: true
      };
    } else {
      return {
        maxConcurrentTasks: 4,
        cacheSize: 200,
        renderBatchSize: 50,
        enableVirtualScrolling: false
      };
    }
  }
}
