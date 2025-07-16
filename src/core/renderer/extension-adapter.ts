/**
 * 扩展适配器 - WeWrite v3.0 架构改造
 * 将现有的marked扩展适配到新的统一渲染系统
 */

import { Platform } from '../platform/platform-detector';
import { RenderExtension, RenderOptions } from './render-interface';
import { WeWriteMarkedExtension } from '../../render/marked-extensions/extension';
import { Marked, MarkedExtension } from 'marked';
import WeWritePlugin from '../../main';

/**
 * Marked扩展适配器
 * 将现有的WeWriteMarkedExtension适配到新的RenderExtension接口
 */
export class MarkedExtensionAdapter implements RenderExtension {
  readonly name: string;
  readonly priority: number;
  readonly supportedPlatforms: Platform[];
  
  private originalExtension: WeWriteMarkedExtension;
  private marked: Marked;
  private isInitialized = false;

  constructor(
    originalExtension: WeWriteMarkedExtension,
    priority: number = 50,
    supportedPlatforms: Platform[] = ['desktop', 'mobile']
  ) {
    this.originalExtension = originalExtension;
    this.name = originalExtension.constructor.name;
    this.priority = priority;
    this.supportedPlatforms = supportedPlatforms;
    this.marked = new Marked();
  }

  /**
   * 准备阶段
   */
  async prepare(): Promise<void> {
    try {
      // 调用原扩展的prepare方法
      await this.originalExtension.prepare();
      
      // 初始化marked实例
      if (!this.isInitialized) {
        const markedExtension = this.originalExtension.markedExtension();
        this.marked.use(markedExtension);
        this.isInitialized = true;
      }
      
      console.log(`[WeWrite] Extension ${this.name} prepared`);
    } catch (error) {
      console.error(`[WeWrite] Extension ${this.name} prepare failed:`, error);
      throw error;
    }
  }

  /**
   * 处理内容
   */
  async process(content: string, options: RenderOptions): Promise<string> {
    try {
      // 使用marked处理内容
      const result = await this.marked.parse(content);
      return result;
    } catch (error) {
      console.error(`[WeWrite] Extension ${this.name} process failed:`, error);
      // 返回原内容，避免中断整个渲染流程
      return content;
    }
  }

  /**
   * 后处理阶段
   */
  async postprocess(html: string): Promise<string> {
    try {
      return await this.originalExtension.postprocess(html);
    } catch (error) {
      console.error(`[WeWrite] Extension ${this.name} postprocess failed:`, error);
      return html;
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    try {
      await this.originalExtension.cleanup();
      this.isInitialized = false;
      console.log(`[WeWrite] Extension ${this.name} cleaned up`);
    } catch (error) {
      console.error(`[WeWrite] Extension ${this.name} cleanup failed:`, error);
    }
  }

  /**
   * 检查平台支持
   */
  supportsPlatform(platform: Platform): boolean {
    return this.supportedPlatforms.includes(platform);
  }

  /**
   * 错误处理
   */
  handleError(error: Error): void {
    console.error(`[WeWrite] Extension ${this.name} error:`, error);
  }

  /**
   * 获取原始扩展实例
   */
  getOriginalExtension(): WeWriteMarkedExtension {
    return this.originalExtension;
  }
}

/**
 * 扩展工厂
 * 负责创建和管理扩展适配器
 */
export class ExtensionAdapterFactory {
  private static _instance: ExtensionAdapterFactory;
  private adapters = new Map<string, MarkedExtensionAdapter>();
  private plugin: WeWritePlugin;

  private constructor(plugin: WeWritePlugin) {
    this.plugin = plugin;
  }

  public static getInstance(plugin: WeWritePlugin): ExtensionAdapterFactory {
    if (!ExtensionAdapterFactory._instance) {
      ExtensionAdapterFactory._instance = new ExtensionAdapterFactory(plugin);
    }
    return ExtensionAdapterFactory._instance;
  }

  /**
   * 创建所有标准扩展适配器
   */
  async createStandardExtensions(previewRender: any): Promise<MarkedExtensionAdapter[]> {
    const adapters: MarkedExtensionAdapter[] = [];

    try {
      // 动态导入所有扩展
      const extensions = await this.importExtensions(previewRender);
      
      for (const [name, { extension, config }] of extensions) {
        try {
          const adapter = new MarkedExtensionAdapter(
            extension,
            config.priority,
            config.supportedPlatforms
          );
          
          this.adapters.set(name, adapter);
          adapters.push(adapter);
          
          console.log(`[WeWrite] Created adapter for extension: ${name}`);
        } catch (error) {
          console.error(`[WeWrite] Failed to create adapter for ${name}:`, error);
        }
      }
    } catch (error) {
      console.error('[WeWrite] Failed to create standard extensions:', error);
    }

    return adapters;
  }

  /**
   * 动态导入所有扩展
   */
  private async importExtensions(previewRender: any): Promise<Map<string, ExtensionConfig>> {
    const extensions = new Map<string, ExtensionConfig>();

    // 高亮扩展 - 最高优先级
    try {
      const { HighlightRenderer } = await import('../../render/marked-extensions/highlight');
      extensions.set('HighlightRenderer', {
        extension: new HighlightRenderer(this.plugin, previewRender, new Marked()),
        config: {
          priority: 100,
          supportedPlatforms: ['desktop', 'mobile']
        }
      });
    } catch (error) {
      console.warn('[WeWrite] Failed to import HighlightRenderer:', error);
    }

    // 脚注扩展
    try {
      const { Footnote } = await import('../../render/marked-extensions/footnote');
      extensions.set('Footnote', {
        extension: new Footnote(this.plugin, previewRender, new Marked()),
        config: {
          priority: 90,
          supportedPlatforms: ['desktop', 'mobile']
        }
      });
    } catch (error) {
      console.warn('[WeWrite] Failed to import Footnote:', error);
    }

    // 图标扩展 - 桌面端优先
    try {
      const { IconizeRender } = await import('../../render/marked-extensions/iconize');
      extensions.set('IconizeRender', {
        extension: new IconizeRender(this.plugin, previewRender, new Marked()),
        config: {
          priority: 80,
          supportedPlatforms: ['desktop'] // 移动端可能不支持图标插件
        }
      });
    } catch (error) {
      console.warn('[WeWrite] Failed to import IconizeRender:', error);
    }

    // 标题扩展
    try {
      const { Heading } = await import('../../render/marked-extensions/heading');
      extensions.set('Heading', {
        extension: new Heading(this.plugin, previewRender, new Marked()),
        config: {
          priority: 70,
          supportedPlatforms: ['desktop', 'mobile']
        }
      });
    } catch (error) {
      console.warn('[WeWrite] Failed to import Heading:', error);
    }

    // 嵌入扩展
    try {
      const { Embed } = await import('../../render/marked-extensions/embed');
      extensions.set('Embed', {
        extension: new Embed(this.plugin, previewRender, new Marked()),
        config: {
          priority: 60,
          supportedPlatforms: ['desktop', 'mobile']
        }
      });
    } catch (error) {
      console.warn('[WeWrite] Failed to import Embed:', error);
    }

    // 代码扩展
    try {
      const { CodeRenderer } = await import('../../render/marked-extensions/code');
      extensions.set('CodeRenderer', {
        extension: new CodeRenderer(this.plugin, previewRender, new Marked()),
        config: {
          priority: 50,
          supportedPlatforms: ['desktop', 'mobile']
        }
      });
    } catch (error) {
      console.warn('[WeWrite] Failed to import CodeRenderer:', error);
    }

    // 代码片段扩展
    try {
      const { CodespanRenderer } = await import('../../render/marked-extensions/codespan');
      extensions.set('CodespanRenderer', {
        extension: new CodespanRenderer(this.plugin, previewRender, new Marked()),
        config: {
          priority: 40,
          supportedPlatforms: ['desktop', 'mobile']
        }
      });
    } catch (error) {
      console.warn('[WeWrite] Failed to import CodespanRenderer:', error);
    }

    // 代码高亮扩展
    try {
      const { CodeHighlight } = await import('../../render/marked-extensions/code-highlight');
      extensions.set('CodeHighlight', {
        extension: new CodeHighlight(this.plugin, previewRender, new Marked()),
        config: {
          priority: 30,
          supportedPlatforms: ['desktop', 'mobile']
        }
      });
    } catch (error) {
      console.warn('[WeWrite] Failed to import CodeHighlight:', error);
    }

    // 数学扩展
    try {
      const { MathRenderer } = await import('../../render/marked-extensions/math');
      extensions.set('MathRenderer', {
        extension: new MathRenderer(this.plugin, previewRender, new Marked()),
        config: {
          priority: 20,
          supportedPlatforms: ['desktop', 'mobile']
        }
      });
    } catch (error) {
      console.warn('[WeWrite] Failed to import MathRenderer:', error);
    }

    // 表格扩展
    try {
      const { Table } = await import('../../render/marked-extensions/table');
      extensions.set('Table', {
        extension: new Table(this.plugin, previewRender, new Marked()),
        config: {
          priority: 10,
          supportedPlatforms: ['desktop', 'mobile']
        }
      });
    } catch (error) {
      console.warn('[WeWrite] Failed to import Table:', error);
    }

    console.log(`[WeWrite] Imported ${extensions.size} extensions`);
    return extensions;
  }

  /**
   * 获取适配器
   */
  getAdapter(name: string): MarkedExtensionAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * 获取所有适配器
   */
  getAllAdapters(): MarkedExtensionAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * 清理所有适配器
   */
  async cleanup(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.cleanup();
    }
    this.adapters.clear();
    console.log('[WeWrite] All extension adapters cleaned up');
  }
}

/**
 * 扩展配置接口
 */
interface ExtensionConfig {
  extension: WeWriteMarkedExtension;
  config: {
    priority: number;
    supportedPlatforms: Platform[];
  };
}
