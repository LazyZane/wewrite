/**
 * 平台适配器工厂 - WeWrite v3.0 架构改造
 * 负责创建和管理平台适配器实例
 */

import { PlatformDetector, Platform } from './platform-detector';
import { PlatformAdapter, DesktopAdapter, MobileAdapter } from './platform-adapter';

/**
 * 平台适配器工厂
 * 单例模式，负责创建和管理平台适配器
 */
export class PlatformAdapterFactory {
  private static _instance: PlatformAdapterFactory;
  private _currentAdapter: PlatformAdapter | null = null;
  private _platformDetector: PlatformDetector;

  private constructor() {
    this._platformDetector = PlatformDetector.getInstance();
  }

  public static getInstance(): PlatformAdapterFactory {
    if (!PlatformAdapterFactory._instance) {
      PlatformAdapterFactory._instance = new PlatformAdapterFactory();
    }
    return PlatformAdapterFactory._instance;
  }

  /**
   * 获取当前平台的适配器
   * @returns 平台适配器实例
   */
  public getCurrentAdapter(): PlatformAdapter {
    if (!this._currentAdapter) {
      this._currentAdapter = this.createAdapter();
    }
    return this._currentAdapter;
  }

  /**
   * 创建平台适配器
   * @param platform 可选的平台类型，如果不提供则自动检测
   * @returns 平台适配器实例
   */
  public createAdapter(platform?: Platform): PlatformAdapter {
    const targetPlatform = platform || this._platformDetector.platform;
    const capabilities = this._platformDetector.capabilities;

    switch (targetPlatform) {
      case 'mobile':
        return new MobileAdapter(capabilities);
      case 'desktop':
        return new DesktopAdapter(capabilities);
      default:
        console.warn(`[WeWrite] Unknown platform: ${targetPlatform}, falling back to desktop`);
        return new DesktopAdapter(capabilities);
    }
  }

  /**
   * 重新初始化适配器（用于平台切换场景）
   */
  public reinitialize(): void {
    if (this._currentAdapter) {
      // 清理当前适配器的事件监听器
      this.cleanupAdapter(this._currentAdapter);
    }
    
    // 重新检测平台
    this._platformDetector = PlatformDetector.getInstance();
    this._currentAdapter = this.createAdapter();
    
    console.log(`[WeWrite] Platform adapter reinitialized for ${this._currentAdapter.platform}`);
  }

  /**
   * 检查是否需要切换适配器
   * @returns 是否需要切换
   */
  public needsAdapterSwitch(): boolean {
    if (!this._currentAdapter) {
      return true;
    }
    
    const currentPlatform = this._platformDetector.platform;
    return this._currentAdapter.platform !== currentPlatform;
  }

  /**
   * 获取平台特定的配置
   * @returns 平台配置对象
   */
  public getPlatformConfig(): PlatformConfig {
    const adapter = this.getCurrentAdapter();
    const detector = this._platformDetector;
    
    return {
      platform: adapter.platform,
      capabilities: adapter.capabilities,
      screenInfo: detector.screenInfo,
      recommendedConfig: detector.getRecommendedConfig(),
      availableAPIs: adapter.getAvailableAPIs()
    };
  }

  /**
   * 清理适配器资源
   */
  private cleanupAdapter(adapter: PlatformAdapter): void {
    try {
      // 这里可以添加清理逻辑，比如移除事件监听器
      console.log(`[WeWrite] Cleaning up ${adapter.platform} adapter`);
    } catch (error) {
      console.error('[WeWrite] Error cleaning up adapter:', error);
    }
  }
}

/**
 * 平台配置接口
 */
export interface PlatformConfig {
  platform: Platform;
  capabilities: any;
  screenInfo: any;
  recommendedConfig: any;
  availableAPIs: string[];
}

/**
 * 平台适配器管理器
 * 提供更高级的平台适配功能
 */
export class PlatformManager {
  private static _instance: PlatformManager;
  private _factory: PlatformAdapterFactory;
  private _currentConfig: PlatformConfig;
  private _eventListeners: Map<string, Set<Function>> = new Map();

  private constructor() {
    this._factory = PlatformAdapterFactory.getInstance();
    this._currentConfig = this._factory.getPlatformConfig();
    this.initializeEventListeners();
  }

  public static getInstance(): PlatformManager {
    if (!PlatformManager._instance) {
      PlatformManager._instance = new PlatformManager();
    }
    return PlatformManager._instance;
  }

  /**
   * 获取当前平台适配器
   */
  public getAdapter(): PlatformAdapter {
    return this._factory.getCurrentAdapter();
  }

  /**
   * 获取当前平台配置
   */
  public getConfig(): PlatformConfig {
    return this._currentConfig;
  }

  /**
   * 检查平台能力
   * @param capability 能力名称
   * @returns 是否支持该能力
   */
  public hasCapability(capability: string): boolean {
    const apis = this._currentConfig.availableAPIs;
    return apis.includes(capability);
  }

  /**
   * 获取平台优化的配置值
   * @param key 配置键
   * @param defaultValue 默认值
   * @returns 优化后的配置值
   */
  public getOptimizedValue<T>(key: string, defaultValue: T): T {
    const config = this._currentConfig.recommendedConfig;
    return config[key] !== undefined ? config[key] : defaultValue;
  }

  /**
   * 监听平台变化事件
   * @param event 事件名称
   * @param callback 回调函数
   */
  public addEventListener(event: string, callback: Function): void {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event)!.add(callback);
  }

  /**
   * 移除事件监听器
   * @param event 事件名称
   * @param callback 回调函数
   */
  public removeEventListener(event: string, callback: Function): void {
    this._eventListeners.get(event)?.delete(callback);
  }

  /**
   * 触发平台事件
   * @param event 事件名称
   * @param data 事件数据
   */
  private emitEvent(event: string, data: any): void {
    this._eventListeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[WeWrite] Error in platform event handler for ${event}:`, error);
      }
    });
  }

  /**
   * 初始化事件监听器
   */
  private initializeEventListeners(): void {
    // 监听屏幕变化
    const detector = PlatformDetector.getInstance();
    detector.onScreenChange((screenInfo) => {
      this._currentConfig.screenInfo = screenInfo;
      this.emitEvent('screen-change', screenInfo);
    });

    // 监听平台适配器变化
    setInterval(() => {
      if (this._factory.needsAdapterSwitch()) {
        console.log('[WeWrite] Platform change detected, reinitializing adapter...');
        this._factory.reinitialize();
        this._currentConfig = this._factory.getPlatformConfig();
        this.emitEvent('platform-change', this._currentConfig);
      }
    }, 5000); // 每5秒检查一次
  }

  /**
   * 执行平台特定的优化
   * @param data 需要优化的数据
   * @returns 优化后的数据
   */
  public optimizeData(data: any): any {
    const adapter = this.getAdapter();
    return adapter.optimizeForPlatform(data);
  }

  /**
   * 获取平台特定的存储适配器
   */
  public getStorageAdapter() {
    return this.getAdapter().getStorageAdapter();
  }

  /**
   * 获取平台特定的网络适配器
   */
  public getNetworkAdapter() {
    return this.getAdapter().getNetworkAdapter();
  }

  /**
   * 创建平台特定的UI组件
   * @param container 容器元素
   * @param type 组件类型
   * @returns UI组件实例
   */
  public createUIComponent(container: HTMLElement, type: string) {
    return this.getAdapter().createUI(container, type);
  }
}

/**
 * 便捷的全局访问函数
 */
export const platformManager = PlatformManager.getInstance();
export const platformAdapter = () => platformManager.getAdapter();
export const platformConfig = () => platformManager.getConfig();
export const isMobilePlatform = () => platformConfig().platform === 'mobile';
export const isDesktopPlatform = () => platformConfig().platform === 'desktop';
