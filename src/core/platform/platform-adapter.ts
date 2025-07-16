/**
 * 平台适配器接口 - WeWrite v3.0 架构改造
 * 定义不同平台的适配接口和实现
 */

import { Platform, PlatformCapabilities, ScreenInfo } from './platform-detector';

/**
 * UI组件接口
 */
export interface UIComponent {
  render(): HTMLElement;
  destroy(): void;
  update(data: any): void;
}

/**
 * 平台事件类型
 */
export type PlatformEvent = 
  | 'orientation-change'
  | 'memory-warning'
  | 'network-change'
  | 'app-background'
  | 'app-foreground';

/**
 * 平台适配器基础接口
 */
export interface PlatformAdapter {
  readonly platform: Platform;
  readonly capabilities: PlatformCapabilities;
  
  // 平台特定的API适配
  getAvailableAPIs(): string[];
  
  // UI创建和管理
  createUI(container: HTMLElement, type: string): UIComponent;
  
  // 平台事件处理
  handlePlatformEvents(): void;
  addEventListener(event: PlatformEvent, callback: (data: any) => void): void;
  removeEventListener(event: PlatformEvent, callback: (data: any) => void): void;
  
  // 资源管理
  getMaxMemoryUsage(): number;
  optimizeForPlatform(data: any): any;
  
  // 存储适配
  getStorageAdapter(): StorageAdapter;
  
  // 网络适配
  getNetworkAdapter(): NetworkAdapter;
}

/**
 * 存储适配器接口
 */
export interface StorageAdapter {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  getSize(): Promise<number>;
  optimize(): Promise<void>;
}

/**
 * 网络适配器接口
 */
export interface NetworkAdapter {
  fetch(url: string, options?: RequestInit): Promise<Response>;
  upload(blob: Blob, options: UploadOptions): Promise<UploadResult>;
  download(url: string, options?: DownloadOptions): Promise<Blob>;
  getConnectionInfo(): ConnectionInfo;
}

export interface UploadOptions {
  filename?: string;
  contentType?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface DownloadOptions {
  timeout?: number;
  maxSize?: number;
}

export interface ConnectionInfo {
  type: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  speed: 'slow' | 'medium' | 'fast';
  isOnline: boolean;
}

/**
 * 桌面端适配器实现
 */
export class DesktopAdapter implements PlatformAdapter {
  readonly platform: Platform = 'desktop';
  readonly capabilities: PlatformCapabilities;
  
  private eventListeners = new Map<PlatformEvent, Set<(data: any) => void>>();

  constructor(capabilities: PlatformCapabilities) {
    this.capabilities = capabilities;
    this.initializeEventListeners();
  }

  getAvailableAPIs(): string[] {
    return [
      'clipboard',
      'filesystem',
      'notification',
      'electron',
      'fullscreen'
    ];
  }

  createUI(container: HTMLElement, type: string): UIComponent {
    // 桌面端UI组件创建逻辑
    switch (type) {
      case 'settings':
        return new DesktopSettingsComponent(container);
      case 'preview':
        return new DesktopPreviewComponent(container);
      default:
        return new DefaultUIComponent(container);
    }
  }

  handlePlatformEvents(): void {
    // 桌面端特定事件处理
    window.addEventListener('resize', () => {
      this.emitEvent('orientation-change', { 
        width: window.innerWidth, 
        height: window.innerHeight 
      });
    });
  }

  addEventListener(event: PlatformEvent, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  removeEventListener(event: PlatformEvent, callback: (data: any) => void): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  getMaxMemoryUsage(): number {
    return this.capabilities.maxMemoryMB * 1024 * 1024; // 转换为字节
  }

  optimizeForPlatform(data: any): any {
    // 桌面端优化逻辑
    return data;
  }

  getStorageAdapter(): StorageAdapter {
    return new DesktopStorageAdapter();
  }

  getNetworkAdapter(): NetworkAdapter {
    return new DesktopNetworkAdapter();
  }

  private initializeEventListeners(): void {
    this.handlePlatformEvents();
  }

  private emitEvent(event: PlatformEvent, data: any): void {
    this.eventListeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[WeWrite] Error in platform event handler for ${event}:`, error);
      }
    });
  }
}

/**
 * 移动端适配器实现
 */
export class MobileAdapter implements PlatformAdapter {
  readonly platform: Platform = 'mobile';
  readonly capabilities: PlatformCapabilities;
  
  private eventListeners = new Map<PlatformEvent, Set<(data: any) => void>>();

  constructor(capabilities: PlatformCapabilities) {
    this.capabilities = capabilities;
    this.initializeEventListeners();
  }

  getAvailableAPIs(): string[] {
    return [
      'touch',
      'orientation',
      'vibration',
      'geolocation'
    ];
  }

  createUI(container: HTMLElement, type: string): UIComponent {
    // 移动端UI组件创建逻辑
    switch (type) {
      case 'settings':
        return new MobileSettingsComponent(container);
      case 'preview':
        return new MobilePreviewComponent(container);
      default:
        return new DefaultUIComponent(container);
    }
  }

  handlePlatformEvents(): void {
    // 移动端特定事件处理
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.emitEvent('orientation-change', {
          orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
        });
      }, 100);
    });

    // 内存警告处理
    if ('memory' in performance) {
      setInterval(() => {
        const memInfo = (performance as any).memory;
        if (memInfo && memInfo.usedJSHeapSize > this.getMaxMemoryUsage() * 0.8) {
          this.emitEvent('memory-warning', { usage: memInfo.usedJSHeapSize });
        }
      }, 30000);
    }
  }

  addEventListener(event: PlatformEvent, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  removeEventListener(event: PlatformEvent, callback: (data: any) => void): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  getMaxMemoryUsage(): number {
    return this.capabilities.maxMemoryMB * 1024 * 1024; // 转换为字节
  }

  optimizeForPlatform(data: any): any {
    // 移动端优化逻辑：压缩数据、减少内存使用
    if (Array.isArray(data) && data.length > 100) {
      // 对大数组进行分页处理
      return data.slice(0, 50);
    }
    return data;
  }

  getStorageAdapter(): StorageAdapter {
    return new MobileStorageAdapter();
  }

  getNetworkAdapter(): NetworkAdapter {
    return new MobileNetworkAdapter();
  }

  private initializeEventListeners(): void {
    this.handlePlatformEvents();
  }

  private emitEvent(event: PlatformEvent, data: any): void {
    this.eventListeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[WeWrite] Error in mobile platform event handler for ${event}:`, error);
      }
    });
  }
}

// 基础UI组件实现（占位符）
class DefaultUIComponent implements UIComponent {
  constructor(private container: HTMLElement) {}
  
  render(): HTMLElement {
    return this.container;
  }
  
  destroy(): void {
    this.container.innerHTML = '';
  }
  
  update(data: any): void {
    // 默认更新逻辑
  }
}

class DesktopSettingsComponent extends DefaultUIComponent {}
class DesktopPreviewComponent extends DefaultUIComponent {}
class MobileSettingsComponent extends DefaultUIComponent {}
class MobilePreviewComponent extends DefaultUIComponent {}

// 存储适配器实现（占位符）
class DesktopStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<any> { return null; }
  async set(key: string, value: any): Promise<void> {}
  async remove(key: string): Promise<void> {}
  async clear(): Promise<void> {}
  async getSize(): Promise<number> { return 0; }
  async optimize(): Promise<void> {}
}

class MobileStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<any> { return null; }
  async set(key: string, value: any): Promise<void> {}
  async remove(key: string): Promise<void> {}
  async clear(): Promise<void> {}
  async getSize(): Promise<number> { return 0; }
  async optimize(): Promise<void> {}
}

// 网络适配器实现（占位符）
class DesktopNetworkAdapter implements NetworkAdapter {
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    return fetch(url, options);
  }
  
  async upload(blob: Blob, options: UploadOptions): Promise<UploadResult> {
    return { success: false };
  }
  
  async download(url: string, options?: DownloadOptions): Promise<Blob> {
    const response = await fetch(url);
    return response.blob();
  }
  
  getConnectionInfo(): ConnectionInfo {
    return {
      type: 'ethernet',
      speed: 'fast',
      isOnline: navigator.onLine
    };
  }
}

class MobileNetworkAdapter implements NetworkAdapter {
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    return fetch(url, options);
  }
  
  async upload(blob: Blob, options: UploadOptions): Promise<UploadResult> {
    return { success: false };
  }
  
  async download(url: string, options?: DownloadOptions): Promise<Blob> {
    const response = await fetch(url);
    return response.blob();
  }
  
  getConnectionInfo(): ConnectionInfo {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    return {
      type: connection?.type || 'unknown',
      speed: this.getSpeedFromConnection(connection),
      isOnline: navigator.onLine
    };
  }
  
  private getSpeedFromConnection(connection: any): 'slow' | 'medium' | 'fast' {
    if (!connection) return 'medium';
    
    const effectiveType = connection.effectiveType;
    if (effectiveType === '4g') return 'fast';
    if (effectiveType === '3g') return 'medium';
    return 'slow';
  }
}
