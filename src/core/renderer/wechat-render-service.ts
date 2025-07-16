/**
 * 微信渲染服务 - WeWrite v3.0 架构改造
 * 实现ObsidianRenderService和WechatRenderService接口
 */

import { Component } from 'obsidian';
import { Platform } from '../platform/platform-detector';
import { UnifiedRenderer } from './unified-renderer';
import { ExtensionAdapterFactory } from './extension-adapter';
import {
  ObsidianRenderService,
  WechatRenderService,
  RenderOptions,
  RenderResult,
  WechatRenderOptions
} from './render-interface';
import { PreviewRender } from '../../render/marked-extensions/extension';
import WeWritePlugin from '../../main';

/**
 * WeChat渲染服务实现
 * 整合Obsidian渲染和微信格式转换
 */
export class WechatRenderServiceImpl implements ObsidianRenderService, WechatRenderService {
  private unifiedRenderer: UnifiedRenderer;
  private extensionFactory: ExtensionAdapterFactory;
  private plugin: WeWritePlugin;
  private previewRender: PreviewRender;
  private isInitialized = false;

  constructor(plugin: WeWritePlugin, platform: Platform) {
    this.plugin = plugin;
    // 创建PreviewRender实现
    this.previewRender = {
      updateElementByID: (id: string, html: string) => {
        const element = document.getElementById(id);
        if (element) element.innerHTML = html;
      },
      addElementByID: (id: string, node: HTMLElement | string) => {
        const element = document.getElementById(id);
        if (element) {
          if (typeof node === 'string') {
            element.innerHTML += node;
          } else {
            element.appendChild(node);
          }
        }
      },
      articleProperties: new Map<string, string>()
    };
    this.extensionFactory = ExtensionAdapterFactory.getInstance(plugin);
    this.unifiedRenderer = new UnifiedRenderer(platform);
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('[WeWrite] Initializing WechatRenderService...');
      
      // 创建并注册所有扩展适配器
      const adapters = await this.extensionFactory.createStandardExtensions(this.previewRender);
      
      for (const adapter of adapters) {
        this.unifiedRenderer.addExtension(adapter);
      }
      
      this.isInitialized = true;
      console.log(`[WeWrite] WechatRenderService initialized with ${adapters.length} extensions`);
    } catch (error) {
      console.error('[WeWrite] Failed to initialize WechatRenderService:', error);
      throw error;
    }
  }

  /**
   * 主要渲染方法
   */
  async render(content: string, options?: RenderOptions): Promise<RenderResult> {
    await this.ensureInitialized();
    return this.unifiedRenderer.render(content, options);
  }

  /**
   * 平台特定渲染
   */
  async renderForPlatform(content: string, platform: Platform, options?: RenderOptions): Promise<RenderResult> {
    await this.ensureInitialized();
    return this.unifiedRenderer.renderForPlatform(content, platform, options);
  }

  /**
   * 批量渲染
   */
  async renderBatch(contents: string[], options?: RenderOptions): Promise<RenderResult[]> {
    await this.ensureInitialized();
    return this.unifiedRenderer.renderBatch(contents, options);
  }

  /**
   * 渲染Obsidian笔记
   */
  async renderNote(path: string, container: HTMLElement, view: Component): Promise<RenderResult> {
    await this.ensureInitialized();
    
    try {
      // 读取笔记内容
      const content = await this.plugin.app.vault.adapter.read(path);
      
      // 使用Obsidian原生渲染器进行预渲染
      const processedContent = await this.renderWithObsidianRenderer(content, container, path, view);
      
      // 使用统一渲染器进行最终渲染
      const result = await this.unifiedRenderer.render(processedContent, {
        platform: this.unifiedRenderer['platform'],
        enableCache: true
      });
      
      // 更新容器内容
      container.innerHTML = result.html;
      
      return result;
    } catch (error) {
      console.error(`[WeWrite] Failed to render note ${path}:`, error);
      throw error;
    }
  }

  /**
   * 使用Obsidian渲染器渲染内容
   */
  async renderWithObsidianRenderer(
    content: string, 
    container: HTMLElement, 
    path: string, 
    view: Component
  ): Promise<string> {
    try {
      const { ObsidianMarkdownRenderer } = await import('../../render/markdown-render');
      const renderer = ObsidianMarkdownRenderer.getInstance(this.plugin.app);
      
      if (!renderer) {
        console.warn('[WeWrite] ObsidianMarkdownRenderer not available, using content as-is');
        return content;
      }
      
      // 使用Obsidian渲染器处理内容
      const processedContent = await renderer.render(path, container, view, this.plugin);
      
      return processedContent || content;
    } catch (error) {
      console.error('[WeWrite] Obsidian renderer failed:', error);
      return content;
    }
  }

  /**
   * 渲染插件内容
   */
  async renderWithPlugins(content: string, enabledPlugins: string[]): Promise<RenderResult> {
    await this.ensureInitialized();
    
    // 根据启用的插件过滤扩展
    const availableExtensions = this.unifiedRenderer.getExtensions();
    const filteredExtensions = availableExtensions.filter(ext => 
      enabledPlugins.includes(ext.name)
    );
    
    // 创建临时渲染器
    const tempRenderer = new UnifiedRenderer(this.unifiedRenderer['platform']);
    for (const ext of filteredExtensions) {
      tempRenderer.addExtension(ext);
    }
    
    return tempRenderer.render(content);
  }

  /**
   * 应用主题
   */
  async applyTheme(html: string, themeName: string): Promise<string> {
    try {
      const { ThemeManager } = await import('../../theme/theme-manager');
      const themeManager = ThemeManager.getInstance(this.plugin);
      
      // 创建临时DOM元素
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // 应用主题
      const styledElement = await themeManager.applyTheme(tempDiv);
      
      return styledElement.outerHTML;
    } catch (error) {
      console.error('[WeWrite] Failed to apply theme:', error);
      return html;
    }
  }

  /**
   * 提取主题变量
   */
  async extractThemeVariables(): Promise<Record<string, string>> {
    try {
      // 简化实现：直接从CSS变量中提取
      const extractedColors: Record<string, string> = {};

      // 获取根元素的计算样式
      const rootStyles = getComputedStyle(document.documentElement);

      // 提取常用的CSS变量
      const cssVariables = [
        '--background-primary',
        '--background-secondary',
        '--text-normal',
        '--text-muted',
        '--color-accent',
        '--background-modifier-border'
      ];

      for (const variable of cssVariables) {
        const value = rootStyles.getPropertyValue(variable).trim();
        if (value) {
          extractedColors[variable] = value;
        }
      }

      return extractedColors;
    } catch (error) {
      console.error('[WeWrite] Failed to extract theme variables:', error);
      return {};
    }
  }

  /**
   * 微信格式渲染
   */
  async renderForWechat(content: string, options?: WechatRenderOptions): Promise<RenderResult> {
    await this.ensureInitialized();
    
    const wechatOptions: RenderOptions = {
      ...options,
      platform: 'mobile', // 微信主要在移动端使用
      performanceMode: 'fast',
      imageOptimization: {
        maxWidth: 800,
        maxHeight: 600,
        quality: 0.8,
        format: 'jpeg',
        enableLazyLoading: false // 微信不支持懒加载
      }
    };
    
    let result = await this.unifiedRenderer.render(content, wechatOptions);
    
    // 微信特定处理
    if (options?.uploadImages) {
      result.html = await this.uploadImages(result.html);
    }
    
    if (options?.inlineStyles) {
      result.html = await this.inlineStyles(result.html);
    }
    
    if (options?.optimizeForMobile) {
      result.html = await this.optimizeForWechat(result.html);
    }
    
    return result;
  }

  /**
   * 处理图片
   */
  async processImages(html: string): Promise<string> {
    try {
      const { uploadURLImage, uploadCanvas, uploadSVGs } = await import('../../render/post-render');
      
      // 创建临时DOM
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // 处理各种类型的图片
      await uploadURLImage(tempDiv, this.plugin.wechatClient);
      await uploadCanvas(tempDiv, this.plugin.wechatClient);
      await uploadSVGs(tempDiv, this.plugin.wechatClient);
      
      return tempDiv.innerHTML;
    } catch (error) {
      console.error('[WeWrite] Failed to process images:', error);
      return html;
    }
  }

  /**
   * 上传图片
   */
  async uploadImages(html: string): Promise<string> {
    return this.processImages(html);
  }

  /**
   * 转换为微信格式
   */
  async convertToWechatFormat(html: string): Promise<string> {
    // 微信格式转换逻辑
    let result = html;
    
    // 移除不支持的标签和属性
    result = result.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    result = result.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    result = result.replace(/on\w+="[^"]*"/gi, ''); // 移除事件处理器
    
    return result;
  }

  /**
   * 内联样式
   */
  async inlineStyles(html: string): Promise<string> {
    try {
      const { ThemeManager } = await import('../../theme/theme-manager');
      const themeManager = ThemeManager.getInstance(this.plugin);
      
      // 获取CSS样式
      const css = await themeManager.getCSS();
      
      // 这里可以实现CSS内联逻辑
      // 简化实现：直接在头部添加style标签
      return `<style>${css}</style>${html}`;
    } catch (error) {
      console.error('[WeWrite] Failed to inline styles:', error);
      return html;
    }
  }

  /**
   * 微信优化
   */
  async optimizeForWechat(html: string): Promise<string> {
    let result = await this.convertToWechatFormat(html);
    
    // 移动端优化
    result = result.replace(/font-size:\s*(\d+)px/gi, (match, size) => {
      const newSize = Math.max(14, parseInt(size)); // 最小字体14px
      return `font-size: ${newSize}px`;
    });
    
    // 图片优化
    result = result.replace(/<img([^>]*)>/gi, (match, attrs) => {
      if (!attrs.includes('style=')) {
        return `<img${attrs} style="max-width: 100%; height: auto;">`;
      }
      return match;
    });
    
    return result;
  }

  /**
   * 扩展管理方法
   */
  addExtension(extension: any): void {
    this.unifiedRenderer.addExtension(extension);
  }

  removeExtension(name: string): void {
    this.unifiedRenderer.removeExtension(name);
  }

  getExtensions(): any[] {
    return this.unifiedRenderer.getExtensions();
  }

  clearCache(): void {
    this.unifiedRenderer.clearCache();
  }

  getCacheSize(): number {
    return this.unifiedRenderer.getCacheSize();
  }

  setCacheLimit(limit: number): void {
    this.unifiedRenderer.setCacheLimit(limit);
  }

  getPerformanceMetrics(): any {
    return this.unifiedRenderer.getPerformanceMetrics();
  }

  resetMetrics(): void {
    this.unifiedRenderer.resetMetrics();
  }

  getErrors(): any[] {
    return this.unifiedRenderer.getErrors();
  }

  clearErrors(): void {
    this.unifiedRenderer.clearErrors();
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.extensionFactory.cleanup();
    this.isInitialized = false;
    console.log('[WeWrite] WechatRenderService cleaned up');
  }

  /**
   * 确保服务已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}
