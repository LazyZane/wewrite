/**
 * 统一渲染接口 - WeWrite v3.0 架构改造
 * 定义统一的渲染服务接口，消除渲染器冗余
 */

import { Platform } from '../platform/platform-detector';
import { Component } from 'obsidian';

/**
 * 渲染选项接口
 */
export interface RenderOptions {
  platform?: Platform;
  enableCache?: boolean;
  maxCacheSize?: number;
  enableLazyLoading?: boolean;
  batchSize?: number;
  timeout?: number;
  theme?: string;
  customCSS?: string;
  imageOptimization?: ImageOptimizationOptions;
  performanceMode?: 'fast' | 'balanced' | 'quality';
}

/**
 * 图片优化选项
 */
export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  enableLazyLoading?: boolean;
}

/**
 * 渲染结果接口
 */
export interface RenderResult {
  html: string;
  metadata: RenderMetadata;
  performance: PerformanceMetrics;
  errors: RenderError[];
  warnings: string[];
}

/**
 * 渲染元数据
 */
export interface RenderMetadata {
  renderTime: number;
  contentLength: number;
  imageCount: number;
  codeBlockCount: number;
  mathBlockCount: number;
  linkCount: number;
  cacheHit: boolean;
  platform: Platform;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  totalTime: number;
  parseTime: number;
  renderTime: number;
  postProcessTime: number;
  memoryUsage: number;
  cacheSize: number;
}

/**
 * 渲染错误
 */
export interface RenderError {
  type: 'parse' | 'render' | 'postprocess' | 'extension';
  message: string;
  line?: number;
  column?: number;
  extension?: string;
  stack?: string;
}

/**
 * 渲染扩展接口
 */
export interface RenderExtension {
  readonly name: string;
  readonly priority: number;
  readonly supportedPlatforms: Platform[];
  
  // 生命周期方法
  prepare(): Promise<void>;
  process(content: string, options: RenderOptions): Promise<string>;
  postprocess(html: string): Promise<string>;
  cleanup(): Promise<void>;
  
  // 平台支持检查
  supportsPlatform(platform: Platform): boolean;
  
  // 错误处理
  handleError(error: Error): void;
}

/**
 * 渲染上下文接口
 */
export interface RenderContext {
  platform: Platform;
  options: RenderOptions;
  metadata: Partial<RenderMetadata>;
  cache: Map<string, any>;
  errors: RenderError[];
  warnings: string[];
  startTime: number;
}

/**
 * 核心渲染服务接口
 */
export interface RenderService {
  // 主要渲染方法
  render(content: string, options?: RenderOptions): Promise<RenderResult>;
  
  // 平台特定渲染
  renderForPlatform(content: string, platform: Platform, options?: RenderOptions): Promise<RenderResult>;
  
  // 批量渲染
  renderBatch(contents: string[], options?: RenderOptions): Promise<RenderResult[]>;
  
  // 扩展管理
  addExtension(extension: RenderExtension): void;
  removeExtension(name: string): void;
  getExtensions(): RenderExtension[];
  
  // 缓存管理
  clearCache(): void;
  getCacheSize(): number;
  setCacheLimit(limit: number): void;
  
  // 性能监控
  getPerformanceMetrics(): PerformanceMetrics;
  resetMetrics(): void;
  
  // 错误处理
  getErrors(): RenderError[];
  clearErrors(): void;
}

/**
 * Obsidian特定渲染接口
 */
export interface ObsidianRenderService extends RenderService {
  // Obsidian特定方法
  renderNote(path: string, container: HTMLElement, view: Component): Promise<RenderResult>;
  renderWithObsidianRenderer(content: string, container: HTMLElement, path: string, view: Component): Promise<string>;
  
  // 插件集成
  renderWithPlugins(content: string, enabledPlugins: string[]): Promise<RenderResult>;
  
  // 主题支持
  applyTheme(html: string, themeName: string): Promise<string>;
  extractThemeVariables(): Promise<Record<string, string>>;
}

/**
 * 微信渲染特定接口
 */
export interface WechatRenderService extends RenderService {
  // 微信特定方法
  renderForWechat(content: string, options?: WechatRenderOptions): Promise<RenderResult>;
  
  // 图片处理
  processImages(html: string): Promise<string>;
  uploadImages(html: string): Promise<string>;
  
  // 格式转换
  convertToWechatFormat(html: string): Promise<string>;
  
  // 样式处理
  inlineStyles(html: string): Promise<string>;
  optimizeForWechat(html: string): Promise<string>;
}

/**
 * 微信渲染选项
 */
export interface WechatRenderOptions extends RenderOptions {
  uploadImages?: boolean;
  inlineStyles?: boolean;
  optimizeForMobile?: boolean;
  maxImageSize?: number;
  imageQuality?: number;
}

/**
 * 渲染管道接口
 */
export interface RenderPipeline {
  // 管道阶段
  preProcess(content: string, context: RenderContext): Promise<string>;
  parse(content: string, context: RenderContext): Promise<string>;
  render(content: string, context: RenderContext): Promise<string>;
  postProcess(html: string, context: RenderContext): Promise<string>;
  
  // 管道控制
  execute(content: string, options: RenderOptions): Promise<RenderResult>;
  addStage(stage: RenderStage): void;
  removeStage(name: string): void;
}

/**
 * 渲染阶段接口
 */
export interface RenderStage {
  readonly name: string;
  readonly order: number;
  
  execute(input: string, context: RenderContext): Promise<string>;
  shouldExecute(context: RenderContext): boolean;
}

/**
 * 缓存接口
 */
export interface RenderCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
  
  // 缓存策略
  generateKey(content: string, options: RenderOptions): string;
  shouldCache(content: string, options: RenderOptions): boolean;
}

/**
 * 性能监控接口
 */
export interface PerformanceMonitor {
  startTimer(name: string): void;
  endTimer(name: string): number;
  recordMemoryUsage(): void;
  getMetrics(): PerformanceMetrics;
  reset(): void;
  
  // 性能分析
  analyze(): PerformanceAnalysis;
  getBottlenecks(): string[];
  getSuggestions(): string[];
}

/**
 * 性能分析结果
 */
export interface PerformanceAnalysis {
  totalTime: number;
  slowestStages: Array<{ name: string; time: number }>;
  memoryPeaks: Array<{ stage: string; usage: number }>;
  recommendations: string[];
  score: number; // 0-100
}

/**
 * 错误处理器接口
 */
export interface ErrorHandler {
  handleError(error: RenderError, context: RenderContext): void;
  handleWarning(warning: string, context: RenderContext): void;
  getErrorSummary(): ErrorSummary;
  clearErrors(): void;
}

/**
 * 错误摘要
 */
export interface ErrorSummary {
  totalErrors: number;
  errorsByType: Record<string, number>;
  recentErrors: RenderError[];
  suggestions: string[];
}
