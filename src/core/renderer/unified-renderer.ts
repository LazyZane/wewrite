/**
 * 统一渲染器 - WeWrite v3.0 架构改造
 * 整合现有多个渲染器，提供统一的渲染服务
 */

import { Platform } from '../platform/platform-detector';
import {
  RenderService,
  RenderOptions,
  RenderResult,
  RenderExtension,
  RenderContext,
  RenderMetadata,
  PerformanceMetrics,
  RenderError,
  RenderCache,
  PerformanceMonitor,
  ErrorHandler
} from './render-interface';

/**
 * 统一渲染器实现
 */
export class UnifiedRenderer implements RenderService {
  private extensions: Map<string, RenderExtension> = new Map();
  private cache: RenderCache;
  private performanceMonitor: PerformanceMonitor;
  private errorHandler: ErrorHandler;
  private platform: Platform;
  private defaultOptions: RenderOptions;

  constructor(
    platform: Platform,
    cache?: RenderCache,
    performanceMonitor?: PerformanceMonitor,
    errorHandler?: ErrorHandler
  ) {
    this.platform = platform;
    this.cache = cache || new DefaultRenderCache();
    this.performanceMonitor = performanceMonitor || new DefaultPerformanceMonitor();
    this.errorHandler = errorHandler || new DefaultErrorHandler();
    
    this.defaultOptions = this.getDefaultOptions();
    this.initializeExtensions();
  }

  /**
   * 主要渲染方法
   */
  async render(content: string, options?: RenderOptions): Promise<RenderResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const context = this.createRenderContext(mergedOptions);
    
    this.performanceMonitor.startTimer('total');
    
    try {
      // 检查缓存
      if (mergedOptions.enableCache) {
        const cacheKey = this.cache.generateKey(content, mergedOptions);
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          context.metadata.cacheHit = true;
          return this.createResult(cached, context);
        }
      }

      // 执行渲染管道
      let result = content;
      
      // 预处理
      this.performanceMonitor.startTimer('preprocess');
      result = await this.preProcess(result, context);
      this.performanceMonitor.endTimer('preprocess');

      // 扩展处理
      this.performanceMonitor.startTimer('extensions');
      result = await this.processExtensions(result, context);
      this.performanceMonitor.endTimer('extensions');

      // 后处理
      this.performanceMonitor.startTimer('postprocess');
      result = await this.postProcess(result, context);
      this.performanceMonitor.endTimer('postprocess');

      // 缓存结果
      if (mergedOptions.enableCache && this.cache.shouldCache(content, mergedOptions)) {
        const cacheKey = this.cache.generateKey(content, mergedOptions);
        await this.cache.set(cacheKey, result);
      }

      return this.createResult(result, context);

    } catch (error) {
      const renderError: RenderError = {
        type: 'render',
        message: error.message,
        stack: error.stack
      };
      context.errors.push(renderError);
      this.errorHandler.handleError(renderError, context);
      
      return this.createResult('', context);
    } finally {
      this.performanceMonitor.endTimer('total');
      this.performanceMonitor.recordMemoryUsage();
    }
  }

  /**
   * 平台特定渲染
   */
  async renderForPlatform(content: string, platform: Platform, options?: RenderOptions): Promise<RenderResult> {
    const platformOptions = {
      ...options,
      platform,
      ...this.getPlatformSpecificOptions(platform)
    };
    
    return this.render(content, platformOptions);
  }

  /**
   * 批量渲染
   */
  async renderBatch(contents: string[], options?: RenderOptions): Promise<RenderResult[]> {
    const batchSize = options?.batchSize || this.getOptimalBatchSize();
    const results: RenderResult[] = [];
    
    for (let i = 0; i < contents.length; i += batchSize) {
      const batch = contents.slice(i, i + batchSize);
      const batchPromises = batch.map(content => this.render(content, options));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // 移动端内存管理
      if (this.platform === 'mobile' && i % (batchSize * 2) === 0) {
        await this.performMemoryCleanup();
      }
    }
    
    return results;
  }

  /**
   * 扩展管理
   */
  addExtension(extension: RenderExtension): void {
    if (!extension.supportsPlatform(this.platform)) {
      console.warn(`[WeWrite] Extension ${extension.name} does not support platform ${this.platform}`);
      return;
    }
    
    this.extensions.set(extension.name, extension);
    console.log(`[WeWrite] Added extension: ${extension.name} for platform: ${this.platform}`);
  }

  removeExtension(name: string): void {
    const extension = this.extensions.get(name);
    if (extension) {
      extension.cleanup();
      this.extensions.delete(name);
      console.log(`[WeWrite] Removed extension: ${name}`);
    }
  }

  getExtensions(): RenderExtension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * 缓存管理
   */
  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    // 由于cache.size()是异步的，我们需要同步版本
    if (this.cache instanceof DefaultRenderCache) {
      return (this.cache as any).cache.size;
    }
    return 0;
  }

  setCacheLimit(limit: number): void {
    // 实现缓存限制逻辑
  }

  /**
   * 性能监控
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMonitor.getMetrics();
  }

  resetMetrics(): void {
    this.performanceMonitor.reset();
  }

  /**
   * 错误处理
   */
  getErrors(): RenderError[] {
    return this.errorHandler.getErrorSummary().recentErrors;
  }

  clearErrors(): void {
    this.errorHandler.clearErrors();
  }

  /**
   * 私有方法
   */
  private createRenderContext(options: RenderOptions): RenderContext {
    return {
      platform: this.platform,
      options,
      metadata: {
        platform: this.platform,
        cacheHit: false,
        renderTime: 0,
        contentLength: 0,
        imageCount: 0,
        codeBlockCount: 0,
        mathBlockCount: 0,
        linkCount: 0
      },
      cache: new Map(),
      errors: [],
      warnings: [],
      startTime: Date.now()
    };
  }

  private async preProcess(content: string, context: RenderContext): Promise<string> {
    // 预处理逻辑：清理内容、准备扩展等
    context.metadata.contentLength = content.length;
    
    // 移动端特定预处理
    if (this.platform === 'mobile') {
      // 移动端内容优化
      content = this.optimizeForMobile(content);
    }
    
    return content;
  }

  private async processExtensions(content: string, context: RenderContext): Promise<string> {
    // 按优先级排序扩展
    const sortedExtensions = Array.from(this.extensions.values())
      .filter(ext => ext.supportsPlatform(this.platform))
      .sort((a, b) => b.priority - a.priority);

    let result = content;
    
    // 准备所有扩展
    for (const extension of sortedExtensions) {
      try {
        await extension.prepare();
      } catch (error) {
        const renderError: RenderError = {
          type: 'extension',
          message: `Extension ${extension.name} prepare failed: ${error.message}`,
          extension: extension.name
        };
        context.errors.push(renderError);
        this.errorHandler.handleError(renderError, context);
      }
    }

    // 处理扩展
    for (const extension of sortedExtensions) {
      try {
        result = await extension.process(result, context.options);
      } catch (error) {
        const renderError: RenderError = {
          type: 'extension',
          message: `Extension ${extension.name} process failed: ${error.message}`,
          extension: extension.name
        };
        context.errors.push(renderError);
        this.errorHandler.handleError(renderError, context);
      }
    }

    return result;
  }

  private async postProcess(html: string, context: RenderContext): Promise<string> {
    let result = html;
    
    // 扩展后处理
    const extensions = Array.from(this.extensions.values())
      .filter(ext => ext.supportsPlatform(this.platform));
      
    for (const extension of extensions) {
      try {
        result = await extension.postprocess(result);
      } catch (error) {
        const renderError: RenderError = {
          type: 'postprocess',
          message: `Extension ${extension.name} postprocess failed: ${error.message}`,
          extension: extension.name
        };
        context.errors.push(renderError);
        this.errorHandler.handleError(renderError, context);
      }
    }

    // 统计元数据
    this.updateMetadata(result, context);
    
    return result;
  }

  private createResult(html: string, context: RenderContext): RenderResult {
    const endTime = Date.now();
    context.metadata.renderTime = endTime - context.startTime;
    
    return {
      html,
      metadata: context.metadata as RenderMetadata,
      performance: this.performanceMonitor.getMetrics(),
      errors: context.errors,
      warnings: context.warnings
    };
  }

  private getDefaultOptions(): RenderOptions {
    const platformConfig = this.getPlatformSpecificOptions(this.platform);
    
    return {
      platform: this.platform,
      enableCache: true,
      maxCacheSize: platformConfig.maxCacheSize || 100,
      enableLazyLoading: this.platform === 'mobile',
      batchSize: platformConfig.batchSize || 10,
      timeout: 30000,
      performanceMode: this.platform === 'mobile' ? 'fast' : 'balanced',
      ...platformConfig
    };
  }

  private getPlatformSpecificOptions(platform: Platform): Partial<RenderOptions> {
    if (platform === 'mobile') {
      return {
        batchSize: 5,
        maxCacheSize: 50,
        enableLazyLoading: true,
        performanceMode: 'fast',
        imageOptimization: {
          maxWidth: 800,
          maxHeight: 600,
          quality: 0.8,
          format: 'webp',
          enableLazyLoading: true
        }
      };
    } else {
      return {
        batchSize: 20,
        maxCacheSize: 200,
        enableLazyLoading: false,
        performanceMode: 'quality',
        imageOptimization: {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.9,
          format: 'webp'
        }
      };
    }
  }

  private getOptimalBatchSize(): number {
    return this.platform === 'mobile' ? 3 : 10;
  }

  private optimizeForMobile(content: string): string {
    // 移动端内容优化逻辑
    // 例如：减少复杂的嵌套结构、优化图片等
    return content;
  }

  private async performMemoryCleanup(): Promise<void> {
    // 移动端内存清理
    if (typeof window !== 'undefined' && window.gc) {
      window.gc();
    }
    
    // 清理缓存
    const cacheSize = await this.cache.size();
    if (cacheSize > 50) {
      await this.cache.clear();
    }
  }

  private updateMetadata(html: string, context: RenderContext): void {
    // 更新渲染元数据
    context.metadata.imageCount = (html.match(/<img/g) || []).length;
    context.metadata.codeBlockCount = (html.match(/<pre/g) || []).length;
    context.metadata.mathBlockCount = (html.match(/\$\$/g) || []).length / 2;
    context.metadata.linkCount = (html.match(/<a/g) || []).length;
  }

  private initializeExtensions(): void {
    // 初始化默认扩展
    console.log(`[WeWrite] Initializing unified renderer for platform: ${this.platform}`);
  }
}

// 默认实现类（占位符）
class DefaultRenderCache implements RenderCache {
  private cache = new Map<string, { value: string; ttl: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (item && item.ttl > Date.now()) {
      return item.value;
    }
    this.cache.delete(key);
    return null;
  }

  async set(key: string, value: string, ttl = 3600000): Promise<void> {
    this.cache.set(key, { value, ttl: Date.now() + ttl });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  generateKey(content: string, options: RenderOptions): string {
    const hash = this.simpleHash(content + JSON.stringify(options));
    return `render_${hash}`;
  }

  shouldCache(content: string, options: RenderOptions): boolean {
    return content.length > 100 && options.enableCache !== false;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

class DefaultPerformanceMonitor implements PerformanceMonitor {
  private timers = new Map<string, number>();
  private metrics: PerformanceMetrics = {
    totalTime: 0,
    parseTime: 0,
    renderTime: 0,
    postProcessTime: 0,
    memoryUsage: 0,
    cacheSize: 0
  };

  startTimer(name: string): void {
    this.timers.set(name, Date.now());
  }

  endTimer(name: string): number {
    const start = this.timers.get(name);
    if (start) {
      const duration = Date.now() - start;
      this.timers.delete(name);
      
      // 更新指标
      if (name === 'total') this.metrics.totalTime = duration;
      else if (name === 'parse') this.metrics.parseTime = duration;
      else if (name === 'render') this.metrics.renderTime = duration;
      else if (name === 'postprocess') this.metrics.postProcessTime = duration;
      
      return duration;
    }
    return 0;
  }

  recordMemoryUsage(): void {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      this.metrics.memoryUsage = (performance as any).memory.usedJSHeapSize;
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.timers.clear();
    this.metrics = {
      totalTime: 0,
      parseTime: 0,
      renderTime: 0,
      postProcessTime: 0,
      memoryUsage: 0,
      cacheSize: 0
    };
  }

  analyze() {
    return {
      totalTime: this.metrics.totalTime,
      slowestStages: [],
      memoryPeaks: [],
      recommendations: [],
      score: 85
    };
  }

  getBottlenecks(): string[] {
    return [];
  }

  getSuggestions(): string[] {
    return [];
  }
}

class DefaultErrorHandler implements ErrorHandler {
  private errors: RenderError[] = [];
  private warnings: string[] = [];

  handleError(error: RenderError, context: RenderContext): void {
    this.errors.push(error);
    console.error(`[WeWrite] Render error in ${error.type}:`, error.message);
  }

  handleWarning(warning: string, context: RenderContext): void {
    this.warnings.push(warning);
    console.warn(`[WeWrite] Render warning:`, warning);
  }

  getErrorSummary() {
    return {
      totalErrors: this.errors.length,
      errorsByType: this.errors.reduce((acc, err) => {
        acc[err.type] = (acc[err.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recentErrors: this.errors.slice(-10),
      suggestions: []
    };
  }

  clearErrors(): void {
    this.errors = [];
    this.warnings = [];
  }
}
