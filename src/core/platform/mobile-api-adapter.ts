/**
 * 移动端API兼容层 - WeWrite v3.0 架构改造
 * 处理移动端API限制和兼容性问题
 */

import { Notice } from 'obsidian';

/**
 * API兼容性检查结果
 */
export interface APICompatibility {
  available: boolean;
  fallbackAvailable: boolean;
  limitations: string[];
  recommendations: string[];
}

/**
 * 移动端API适配器
 * 提供移动端API的兼容性检查和降级处理
 */
export class MobileAPIAdapter {
  private static _instance: MobileAPIAdapter;
  private apiCompatibilityMap = new Map<string, APICompatibility>();

  private constructor() {
    this.initializeCompatibilityMap();
  }

  public static getInstance(): MobileAPIAdapter {
    if (!MobileAPIAdapter._instance) {
      MobileAPIAdapter._instance = new MobileAPIAdapter();
    }
    return MobileAPIAdapter._instance;
  }

  /**
   * 检查API是否在移动端可用
   * @param apiName API名称
   * @returns 是否可用
   */
  public isAPIAvailable(apiName: string): boolean {
    const compatibility = this.apiCompatibilityMap.get(apiName);
    return compatibility?.available ?? false;
  }

  /**
   * 获取API兼容性信息
   * @param apiName API名称
   * @returns 兼容性信息
   */
  public getAPICompatibility(apiName: string): APICompatibility | null {
    return this.apiCompatibilityMap.get(apiName) || null;
  }

  /**
   * 安全的API调用，带降级处理
   * @param apiCall 主要API调用
   * @param fallback 降级处理函数
   * @param apiName API名称（用于日志）
   * @returns API调用结果
   */
  public async safeAPICall<T>(
    apiCall: () => Promise<T>,
    fallback: () => Promise<T>,
    apiName: string
  ): Promise<T> {
    try {
      // 检查API可用性
      if (!this.isAPIAvailable(apiName)) {
        console.warn(`[WeWrite Mobile] API ${apiName} not available, using fallback`);
        return await fallback();
      }

      // 尝试调用主要API
      return await apiCall();
    } catch (error) {
      console.warn(`[WeWrite Mobile] API ${apiName} failed, using fallback:`, error);
      
      // 记录错误并使用降级方案
      this.recordAPIFailure(apiName, error);
      return await fallback();
    }
  }

  /**
   * 剪贴板API适配
   */
  public async writeToClipboard(text: string): Promise<boolean> {
    return this.safeAPICall(
      async () => {
        // 检查权限和API可用性
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
          throw new Error('Clipboard API not available');
        }

        // 检查是否在安全上下文中
        if (!window.isSecureContext) {
          throw new Error('Clipboard API requires secure context');
        }

        // 尝试写入剪贴板
        await navigator.clipboard.writeText(text);
        return true;
      },
      async () => {
        // 降级方案：使用传统方法或显示提示
        this.showCopyFallback(text);
        return false;
      },
      'clipboard.writeText'
    );
  }

  /**
   * 文件系统API适配
   */
  public async readFile(path: string): Promise<string | null> {
    return this.safeAPICall(
      async () => {
        // 尝试使用Obsidian的文件API
        if ((window as any).app?.vault?.adapter?.read) {
          return await (window as any).app.vault.adapter.read(path);
        }
        throw new Error('File system API not available');
      },
      async () => {
        console.warn('[WeWrite Mobile] File read not available on mobile');
        return null;
      },
      'filesystem.read'
    );
  }

  /**
   * 通知API适配
   */
  public async showNotification(message: string, duration = 5000): Promise<void> {
    return this.safeAPICall(
      async () => {
        if (window.Notification && Notification.permission === 'granted') {
          new Notification('WeWrite', { body: message });
        } else {
          throw new Error('Notification API not available');
        }
      },
      async () => {
        // 降级方案：使用Obsidian的Notice
        new Notice(message, duration);
      },
      'notification'
    );
  }

  /**
   * 网络请求API适配
   */
  public async fetchWithTimeout(
    url: string, 
    options: RequestInit = {}, 
    timeout = 10000
  ): Promise<Response> {
    return this.safeAPICall(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      },
      async () => {
        // 降级方案：使用Obsidian的requestUrl
        if ((window as any).app?.vault?.adapter?.requestUrl) {
          const response = await (window as any).app.vault.adapter.requestUrl({
            url,
            method: options.method || 'GET',
            headers: options.headers,
            body: options.body
          });
          
          return new Response(response.arrayBuffer, {
            status: response.status,
            headers: response.headers
          });
        }
        throw new Error('No network API available');
      },
      'fetch'
    );
  }

  /**
   * 存储API适配
   */
  public async setStorage(key: string, value: any): Promise<void> {
    return this.safeAPICall(
      async () => {
        if (localStorage) {
          localStorage.setItem(key, JSON.stringify(value));
        } else {
          throw new Error('localStorage not available');
        }
      },
      async () => {
        // 降级方案：使用内存存储
        this.memoryStorage.set(key, value);
        console.warn('[WeWrite Mobile] Using memory storage as fallback');
      },
      'localStorage'
    );
  }

  public async getStorage(key: string): Promise<any> {
    return this.safeAPICall(
      async () => {
        if (localStorage) {
          const item = localStorage.getItem(key);
          return item ? JSON.parse(item) : null;
        }
        throw new Error('localStorage not available');
      },
      async () => {
        // 降级方案：从内存存储获取
        return this.memoryStorage.get(key) || null;
      },
      'localStorage'
    );
  }

  /**
   * 触摸事件适配
   */
  public addTouchEventListener(
    element: HTMLElement,
    eventType: 'tap' | 'longpress' | 'swipe',
    handler: (event: TouchEvent) => void
  ): () => void {
    const listeners: Array<() => void> = [];

    switch (eventType) {
      case 'tap':
        const tapHandler = this.createTapHandler(handler);
        element.addEventListener('touchstart', tapHandler.start);
        element.addEventListener('touchend', tapHandler.end);
        listeners.push(
          () => element.removeEventListener('touchstart', tapHandler.start),
          () => element.removeEventListener('touchend', tapHandler.end)
        );
        break;

      case 'longpress':
        const longPressHandler = this.createLongPressHandler(handler);
        element.addEventListener('touchstart', longPressHandler.start);
        element.addEventListener('touchend', longPressHandler.end);
        element.addEventListener('touchmove', longPressHandler.move);
        listeners.push(
          () => element.removeEventListener('touchstart', longPressHandler.start),
          () => element.removeEventListener('touchend', longPressHandler.end),
          () => element.removeEventListener('touchmove', longPressHandler.move)
        );
        break;

      case 'swipe':
        const swipeHandler = this.createSwipeHandler(handler);
        element.addEventListener('touchstart', swipeHandler.start);
        element.addEventListener('touchmove', swipeHandler.move);
        element.addEventListener('touchend', swipeHandler.end);
        listeners.push(
          () => element.removeEventListener('touchstart', swipeHandler.start),
          () => element.removeEventListener('touchmove', swipeHandler.move),
          () => element.removeEventListener('touchend', swipeHandler.end)
        );
        break;
    }

    // 返回清理函数
    return () => {
      listeners.forEach(cleanup => cleanup());
    };
  }

  /**
   * 私有方法
   */
  private memoryStorage = new Map<string, any>();

  private initializeCompatibilityMap(): void {
    // 剪贴板API - 更严格的检查
    const clipboardAvailable = !!(
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function' &&
      window.isSecureContext
    );

    this.apiCompatibilityMap.set('clipboard.writeText', {
      available: clipboardAvailable,
      fallbackAvailable: true,
      limitations: [
        '需要用户手势触发',
        '需要HTTPS安全上下文',
        '某些浏览器可能不支持',
        '需要用户权限'
      ],
      recommendations: ['提供手动复制提示', '使用Notice作为降级方案', '检查安全上下文']
    });

    // 文件系统API
    this.apiCompatibilityMap.set('filesystem.read', {
      available: !!(window as any).showOpenFilePicker,
      fallbackAvailable: false,
      limitations: ['移动端通常不支持', '需要用户交互'],
      recommendations: ['使用Obsidian内置API', '避免直接文件操作']
    });

    // 通知API
    this.apiCompatibilityMap.set('notification', {
      available: !!(window.Notification),
      fallbackAvailable: true,
      limitations: ['需要用户授权', '可能被系统阻止'],
      recommendations: ['使用Obsidian Notice作为降级', '检查权限状态']
    });

    // Electron API
    this.apiCompatibilityMap.set('electron', {
      available: !!(window as any).require || !!(window as any).electron,
      fallbackAvailable: false,
      limitations: ['移动端不可用'],
      recommendations: ['使用Web API替代', '避免依赖Electron特性']
    });

    // 本地存储
    this.apiCompatibilityMap.set('localStorage', {
      available: !!localStorage,
      fallbackAvailable: true,
      limitations: ['存储容量限制', '可能被清理'],
      recommendations: ['使用内存存储作为降级', '定期备份重要数据']
    });
  }

  private recordAPIFailure(apiName: string, error: any): void {
    console.error(`[WeWrite Mobile] API failure recorded for ${apiName}:`, error);
    
    // 可以在这里实现错误统计和上报
    const compatibility = this.apiCompatibilityMap.get(apiName);
    if (compatibility) {
      compatibility.available = false;
    }
  }

  private showCopyFallback(text: string): void {
    // 创建临时文本区域用于复制
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    
    try {
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      new Notice('内容已复制到剪贴板');
    } catch (error) {
      new Notice('复制失败，请手动复制内容');
      console.error('[WeWrite Mobile] Copy fallback failed:', error);
    } finally {
      document.body.removeChild(textArea);
    }
  }

  private createTapHandler(handler: (event: TouchEvent) => void) {
    let startTime: number;
    let startTouch: Touch | null = null;

    return {
      start: (e: TouchEvent) => {
        startTime = Date.now();
        startTouch = e.touches[0];
      },
      end: (e: TouchEvent) => {
        if (!startTouch) return;
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        if (duration < 300) { // 300ms内算作点击
          const endTouch = e.changedTouches[0];
          const distance = Math.sqrt(
            Math.pow(endTouch.clientX - startTouch.clientX, 2) +
            Math.pow(endTouch.clientY - startTouch.clientY, 2)
          );
          
          if (distance < 10) { // 移动距离小于10px
            handler(e);
          }
        }
        
        startTouch = null;
      }
    };
  }

  private createLongPressHandler(handler: (event: TouchEvent) => void) {
    let pressTimer: number | null = null;
    let startTouch: Touch | null = null;

    return {
      start: (e: TouchEvent) => {
        startTouch = e.touches[0];
        pressTimer = window.setTimeout(() => {
          if (startTouch) {
            handler(e);
          }
        }, 500); // 500ms长按
      },
      end: () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        startTouch = null;
      },
      move: (e: TouchEvent) => {
        if (!startTouch || !pressTimer) return;
        
        const currentTouch = e.touches[0];
        const distance = Math.sqrt(
          Math.pow(currentTouch.clientX - startTouch.clientX, 2) +
          Math.pow(currentTouch.clientY - startTouch.clientY, 2)
        );
        
        if (distance > 10) { // 移动超过10px取消长按
          clearTimeout(pressTimer);
          pressTimer = null;
          startTouch = null;
        }
      }
    };
  }

  private createSwipeHandler(handler: (event: TouchEvent) => void) {
    let startTouch: Touch | null = null;
    let startTime: number;

    return {
      start: (e: TouchEvent) => {
        startTouch = e.touches[0];
        startTime = Date.now();
      },
      move: (e: TouchEvent) => {
        e.preventDefault(); // 防止滚动
      },
      end: (e: TouchEvent) => {
        if (!startTouch) return;
        
        const endTouch = e.changedTouches[0];
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        if (duration < 300) { // 300ms内的快速滑动
          const deltaX = endTouch.clientX - startTouch.clientX;
          const deltaY = endTouch.clientY - startTouch.clientY;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          if (distance > 50) { // 滑动距离大于50px
            handler(e);
          }
        }
        
        startTouch = null;
      }
    };
  }
}

/**
 * 便捷的全局访问
 */
export const mobileAPI = MobileAPIAdapter.getInstance();
