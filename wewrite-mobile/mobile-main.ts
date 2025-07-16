import { App, Plugin, PluginSettingTab, Setting, Notice, Modal, MarkdownView } from 'obsidian';

interface MobileSettings {
  enableDebugLog: boolean;
  selectedTheme: string;
}

const DEFAULT_SETTINGS: MobileSettings = {
  enableDebugLog: true,
  selectedTheme: '1. 传统报刊'
}

// 主题列表（包含PC端原有主题）
const AVAILABLE_THEMES = [
  // 原有经典主题
  '1. 传统报刊',
  '2. 网络时代',
  '3. 密集网格',
  '4. 色彩斑斓',
  '5. 梦之蓝',
  '6. 方格笔记',
  '7. 水墨丹青',
  '8. 诗意阑珊',
  '9. 学生时代',
  '10. 绿色森林',
  '11. 薄荷清凉',
  '12. 爱范儿',
  '13. 优质公众号复刻',

  // 新增主题
  '14. 商务蓝调',
  '15. 活力橙红',
  '16. 自然绿意',
  '17. 优雅紫调',
  '18. 极简黑白',

  // WeWrite经典主题
  '19. WeWrite默认',
  '20. 深色模式',
  '21. 护眼绿',
  '22. 温暖橙',
  '23. 科技蓝',
  '24. 简约灰'
];

/**
 * WeWrite移动端专版插件
 * 专为移动设备优化的手动复制体验
 */
export default class WeWriteMobilePlugin extends Plugin {
  settings: MobileSettings;
  
  // 版本标识
  private readonly VERSION_ID = "MOBILE_ONLY_2025_01_15";

  async onload() {
    console.log('WeWrite Mobile: Starting...');
    console.log(`WeWrite Mobile Version: ${this.VERSION_ID}`);
    
    await this.loadSettings();

    // 添加移动端专用命令
    this.addCommand({
      id: 'mobile-preview',
      name: '📱 移动端预览',
      callback: () => {
        this.mobilePreview();
      }
    });

    // 添加状态栏按钮（与命令面板平级）
    this.addStatusBarButton();

    // 添加设置页面
    this.addSettingTab(new MobileSettingTab(this.app, this));

    new Notice('WeWrite移动端专版已加载', 3000);
    console.log('WeWrite Mobile: Plugin loaded successfully');
  }

  onunload() {
    console.log('WeWrite Mobile: Plugin unloaded');
  }

  /**
   * 添加状态栏按钮（右下角）
   */
  addStatusBarButton() {
    try {
      // 添加到状态栏
      const statusBarItem = this.addStatusBarItem();

      // 创建按钮元素
      statusBarItem.setText('📱 WeWrite');
      statusBarItem.addClass('wewrite-mobile-button');

      // 设置样式
      statusBarItem.setAttribute('aria-label', 'WeWrite移动端预览');
      statusBarItem.setAttribute('title', 'WeWrite移动端预览');

      // 添加CSS样式
      statusBarItem.style.cssText = `
        cursor: pointer !important;
        padding: 4px 8px !important;
        border-radius: 4px !important;
        background: #4caf50 !important;
        color: white !important;
        font-size: 12px !important;
        font-weight: bold !important;
        margin: 2px !important;
        border: none !important;
      `;

      // 添加点击事件
      this.registerDomEvent(statusBarItem, 'click', (evt) => {
        evt.preventDefault();
        console.log('[WeWrite Mobile] 状态栏按钮被点击');
        this.mobilePreview();
      });

      console.log('WeWrite Mobile: 状态栏按钮已添加');
    } catch (error) {
      console.error('WeWrite Mobile: 添加状态栏按钮失败:', error);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * 移动端预览功能
   */
  async mobilePreview() {
    try {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView) {
        new Notice('请先打开一个Markdown文件', 3000);
        return;
      }

      const content = activeView.editor.getValue();
      if (!content.trim()) {
        new Notice('文件内容为空', 3000);
        return;
      }

      // 显示加载提示
      new Notice('正在生成预览...', 1000);

      const html = this.convertToMobileHtml(content);

      new MobilePreviewModal(this.app, html, this).open();
    } catch (error) {
      console.error('WeWrite Mobile: Preview failed:', error);
      new Notice(`预览失败: ${error.message}`, 5000);
    }
  }



  /**
   * 转换为移动端优化的HTML（支持主题）
   */
  convertToMobileHtml(markdown: string): string {
    let html = markdown;

    // 根据选择的主题获取样式
    const themeStyles = this.getThemeStyles(this.settings.selectedTheme);

    // 处理标题
    html = html.replace(/^# (.+)$/gm, `<h1 style="${themeStyles.h1}">$1</h1>`);
    html = html.replace(/^## (.+)$/gm, `<h2 style="${themeStyles.h2}">$1</h2>`);
    html = html.replace(/^### (.+)$/gm, `<h3 style="${themeStyles.h3}">$1</h3>`);

    // 处理高亮文本 ==text== -> <mark>
    html = html.replace(/==([^=]+)==/g, `<mark style="${themeStyles.highlight}">$1</mark>`);

    // 处理粗体和斜体
    html = html.replace(/\*\*([^*]+)\*\*/g, `<strong style="${themeStyles.strong}">$1</strong>`);
    html = html.replace(/\*([^*]+)\*/g, `<em style="${themeStyles.em}">$1</em>`);

    // 处理段落
    html = html.replace(/\n\n/g, `</p><p style="${themeStyles.paragraph}">`);
    html = `<p style="${themeStyles.paragraph}">` + html + '</p>';

    // 处理换行
    html = html.replace(/\n/g, '<br>');

    // 处理图片（支持Base64转换）
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
      // 标记需要转换的图片，稍后异步处理
      return `<img src="${src}" alt="${alt}" style="${themeStyles.image}" data-original-src="${src}">`;
    });

    // 处理链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" style="${themeStyles.link}">$1</a>`);

    // 处理分割线
    html = html.replace(/^---+$/gm, '<hr style="border: none; border-top: 2px solid #ddd; margin: 20px 0;">');

    // 处理无序列表
    html = html.replace(/^- (.+)$/gm, `<li style="${themeStyles.listItem}">$1</li>`);
    html = html.replace(/(<li[^>]*>.*?<\/li>)/gs, `<ul style="${themeStyles.list}">$1</ul>`);

    // 处理有序列表
    html = html.replace(/^\d+\. (.+)$/gm, `<li style="${themeStyles.listItem}">$1</li>`);
    html = html.replace(/(<li[^>]*>.*?<\/li>)/gs, (match) => {
      if (!match.includes('<ul')) {
        return `<ol style="${themeStyles.list}">${match}</ol>`;
      }
      return match;
    });

    // 处理代码块
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre style="background: #f5f5f5; padding: 15px; border-radius: 6px; overflow-x: auto; margin: 15px 0;"><code style="font-family: 'Courier New', monospace; font-size: 14px; color: #333;">${code.trim()}</code></pre>`;
    });

    // 处理行内代码
    html = html.replace(/`([^`]+)`/g, '<code style="background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-family: \'Courier New\', monospace; font-size: 14px; color: #d63384;">$1</code>');

    // 处理引用
    html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left: 4px solid #ddd; margin: 15px 0; padding: 10px 15px; background: #f9f9f9; font-style: italic; color: #666;">$1</blockquote>');

    return html;
  }

  /**
   * 将图片链接转换为Base64格式
   */
  async convertImagesToBase64(html: string): Promise<string> {
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
    const matches = Array.from(html.matchAll(imgRegex));

    if (matches.length === 0) {
      return html;
    }

    console.log(`[WeWrite Mobile] 发现 ${matches.length} 张图片，开始转换为Base64`);

    let processedHtml = html;
    let convertedCount = 0;
    let failedCount = 0;

    for (const match of matches) {
      const fullImgTag = match[0];
      const imageUrl = match[1];

      // 跳过已经是Base64的图片
      if (imageUrl.startsWith('data:')) {
        continue;
      }

      // 跳过本地文件路径
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        continue;
      }

      try {
        console.log(`[WeWrite Mobile] 正在转换图片: ${imageUrl}`);
        const base64 = await this.downloadImageAsBase64(imageUrl);

        if (base64) {
          // 替换图片链接为Base64
          const newImgTag = fullImgTag.replace(imageUrl, base64);
          processedHtml = processedHtml.replace(fullImgTag, newImgTag);
          convertedCount++;
          console.log(`[WeWrite Mobile] 图片转换成功: ${imageUrl.substring(0, 50)}...`);
        } else {
          failedCount++;
          console.warn(`[WeWrite Mobile] 图片转换失败: ${imageUrl}`);
        }
      } catch (error) {
        failedCount++;
        console.error(`[WeWrite Mobile] 图片转换错误: ${imageUrl}`, error);
      }
    }

    console.log(`[WeWrite Mobile] 图片转换完成: 成功 ${convertedCount} 张, 失败 ${failedCount} 张`);

    if (convertedCount > 0) {
      new Notice(`✅ 已转换 ${convertedCount} 张图片为Base64格式\n确保微信公众号中图片稳定显示`, 4000);
    }

    if (failedCount > 0) {
      new Notice(`⚠️ ${failedCount} 张图片转换失败\n这些图片在微信中可能无法显示`, 3000);
    }

    return processedHtml;
  }

  /**
   * 下载图片并转换为Base64
   */
  private async downloadImageAsBase64(imageUrl: string): Promise<string | null> {
    try {
      // 设置超时时间
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

      const response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();

      // 检查文件大小（限制为5MB）
      if (blob.size > 5 * 1024 * 1024) {
        console.warn(`[WeWrite Mobile] 图片过大 (${(blob.size / 1024 / 1024).toFixed(2)}MB): ${imageUrl}`);
        return null;
      }

      // 检查是否为图片类型
      if (!blob.type.startsWith('image/')) {
        console.warn(`[WeWrite Mobile] 非图片文件 (${blob.type}): ${imageUrl}`);
        return null;
      }

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });

    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`[WeWrite Mobile] 图片下载超时: ${imageUrl}`);
      } else {
        console.error(`[WeWrite Mobile] 图片下载失败: ${imageUrl}`, error);
      }
      return null;
    }
  }

  /**
   * 获取主题样式（完整版，包含PC端原有主题）
   */
  private getThemeStyles(themeName: string) {
    const baseStyles = {
      h1: 'font-size: 24px; font-weight: bold; margin: 20px 0 15px 0; line-height: 1.3;',
      h2: 'font-size: 20px; font-weight: bold; margin: 18px 0 12px 0; line-height: 1.3;',
      h3: 'font-size: 18px; font-weight: bold; margin: 16px 0 10px 0; line-height: 1.3;',
      paragraph: 'margin: 12px 0; line-height: 1.6;',
      image: 'max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);',
      list: 'margin: 10px 0; padding-left: 20px;',
      listItem: 'margin: 5px 0;'
    };

    // 根据具体主题名称返回对应样式
    switch (themeName) {
      case '5. 梦之蓝':
        return {
          ...baseStyles,
          h1: baseStyles.h1 + ' color: #5fa1e0;',
          h2: baseStyles.h2 + ' color: #5fa1e0;',
          h3: baseStyles.h3 + ' color: #5fa1e0;',
          strong: 'color: #d1a954; font-weight: bold;',
          em: 'color: #666; font-style: italic;',
          link: 'color: #5fa1e0; text-decoration: none;',
          highlight: 'background-color: #e6edf5; color: #3d5c99; padding: 2px 4px; border-radius: 3px;',
          paragraph: baseStyles.paragraph + ' color: #333; background-color: #e6edf5;',
          listItem: baseStyles.listItem + ' color: #333;'
        };

      case '10. 绿色森林':
      case '11. 薄荷清凉':
      case '16. 自然绿意':
      case '21. 护眼绿':
        return {
          ...baseStyles,
          h1: baseStyles.h1 + ' color: #2e7d32;',
          h2: baseStyles.h2 + ' color: #2e7d32;',
          h3: baseStyles.h3 + ' color: #2e7d32;',
          strong: 'color: #2e7d32; font-weight: bold;',
          em: 'color: #666; font-style: italic;',
          link: 'color: #2e7d32; text-decoration: none;',
          highlight: 'background-color: #e8f5e8; color: #2e7d32; padding: 2px 4px; border-radius: 3px;',
          paragraph: baseStyles.paragraph + ' color: #333;',
          listItem: baseStyles.listItem + ' color: #333;'
        };

      case '14. 商务蓝调':
      case '23. 科技蓝':
        return {
          ...baseStyles,
          h1: baseStyles.h1 + ' color: #1976d2;',
          h2: baseStyles.h2 + ' color: #1976d2;',
          h3: baseStyles.h3 + ' color: #1976d2;',
          strong: 'color: #1976d2; font-weight: bold;',
          em: 'color: #666; font-style: italic;',
          link: 'color: #1976d2; text-decoration: none;',
          highlight: 'background-color: #e3f2fd; color: #1976d2; padding: 2px 4px; border-radius: 3px;',
          paragraph: baseStyles.paragraph + ' color: #333;',
          listItem: baseStyles.listItem + ' color: #333;'
        };

      case '15. 活力橙红':
      case '22. 温暖橙':
        return {
          ...baseStyles,
          h1: baseStyles.h1 + ' color: #f57c00;',
          h2: baseStyles.h2 + ' color: #f57c00;',
          h3: baseStyles.h3 + ' color: #f57c00;',
          strong: 'color: #f57c00; font-weight: bold;',
          em: 'color: #666; font-style: italic;',
          link: 'color: #f57c00; text-decoration: none;',
          highlight: 'background-color: #fff3e0; color: #f57c00; padding: 2px 4px; border-radius: 3px;',
          paragraph: baseStyles.paragraph + ' color: #333;',
          listItem: baseStyles.listItem + ' color: #333;'
        };

      case '17. 优雅紫调':
        return {
          ...baseStyles,
          h1: baseStyles.h1 + ' color: #7b1fa2;',
          h2: baseStyles.h2 + ' color: #7b1fa2;',
          h3: baseStyles.h3 + ' color: #7b1fa2;',
          strong: 'color: #7b1fa2; font-weight: bold;',
          em: 'color: #666; font-style: italic;',
          link: 'color: #7b1fa2; text-decoration: none;',
          highlight: 'background-color: #f3e5f5; color: #7b1fa2; padding: 2px 4px; border-radius: 3px;',
          paragraph: baseStyles.paragraph + ' color: #333;',
          listItem: baseStyles.listItem + ' color: #333;'
        };

      case '18. 极简黑白':
      case '24. 简约灰':
        return {
          ...baseStyles,
          h1: baseStyles.h1 + ' color: #333;',
          h2: baseStyles.h2 + ' color: #333;',
          h3: baseStyles.h3 + ' color: #333;',
          strong: 'color: #333; font-weight: bold;',
          em: 'color: #666; font-style: italic;',
          link: 'color: #333; text-decoration: underline;',
          highlight: 'background-color: #f5f5f5; color: #333; padding: 2px 4px; border-radius: 3px;',
          paragraph: baseStyles.paragraph + ' color: #333;',
          listItem: baseStyles.listItem + ' color: #333;'
        };

      case '20. 深色模式':
        return {
          ...baseStyles,
          h1: baseStyles.h1 + ' color: #4fc3f7;',
          h2: baseStyles.h2 + ' color: #4fc3f7;',
          h3: baseStyles.h3 + ' color: #4fc3f7;',
          strong: 'color: #4fc3f7; font-weight: bold;',
          em: 'color: #bbb; font-style: italic;',
          link: 'color: #4fc3f7; text-decoration: none;',
          highlight: 'background-color: #2d2d2d; color: #4fc3f7; padding: 2px 4px; border-radius: 3px;',
          paragraph: baseStyles.paragraph + ' color: #eee; background-color: #1a1a2e;',
          listItem: baseStyles.listItem + ' color: #eee;'
        };

      default:
        // 默认主题（传统报刊等）
        return {
          ...baseStyles,
          h1: baseStyles.h1 + ' color: #1a73e8;',
          h2: baseStyles.h2 + ' color: #1a73e8;',
          h3: baseStyles.h3 + ' color: #1a73e8;',
          strong: 'color: #1a73e8; font-weight: bold;',
          em: 'color: #666; font-style: italic;',
          link: 'color: #1a73e8; text-decoration: none;',
          highlight: 'background-color: #fff3cd; color: #856404; padding: 2px 4px; border-radius: 3px;',
          paragraph: baseStyles.paragraph + ' color: #333;',
          listItem: baseStyles.listItem + ' color: #333;'
        };
    }
  }
}

/**
 * 移动端预览模态框
 */
class MobilePreviewModal extends Modal {
  html: string;
  plugin: WeWriteMobilePlugin;
  previewContainer: HTMLElement;

  constructor(app: App, html: string, plugin: WeWriteMobilePlugin) {
    super(app);
    this.html = html;
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    console.log('[WeWrite Mobile] 移动端预览模态框打开');

    // 设置模态框样式
    contentEl.style.maxWidth = '800px';
    contentEl.style.width = '95vw';
    contentEl.style.maxHeight = '85vh';

    // 添加标题
    const header = contentEl.createDiv({
      cls: 'modal-title',
      attr: { style: 'text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #e1e4e8;' }
    });
    header.createEl('h2', { text: '📱 移动端预览', attr: { style: 'margin: 0; color: #333;' } });

    // 主题选择和使用说明
    const controlPanel = contentEl.createDiv({
      attr: {
        style: 'background: #e8f5e8; border: 1px solid #4caf50; border-radius: 6px; padding: 12px; margin-bottom: 15px; font-size: 13px;'
      }
    });

    // 主题选择区域
    const themeSection = controlPanel.createDiv({
      attr: { style: 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;' }
    });

    themeSection.createSpan({
      text: '🎨 主题：',
      attr: { style: 'color: #2e7d32; font-weight: bold;' }
    });

    const themeSelect = themeSection.createEl('select', {
      attr: { style: 'padding: 4px 8px; border: 1px solid #4caf50; border-radius: 4px; background: white;' }
    });

    // 添加主题选项
    AVAILABLE_THEMES.forEach(theme => {
      const option = themeSelect.createEl('option', {
        text: theme,
        value: theme
      });
      if (theme === this.plugin.settings.selectedTheme) {
        option.selected = true;
      }
    });

    // 主题切换事件
    themeSelect.addEventListener('change', async () => {
      this.plugin.settings.selectedTheme = themeSelect.value;
      await this.plugin.saveSettings();

      // 重新生成HTML并更新预览
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView) {
        const content = activeView.editor.getValue();
        let html = this.plugin.convertToMobileHtml(content);

        // 检查是否有外部图片需要转换
        const hasExternalImages = /<img[^>]+src="https?:\/\/[^"]+"/i.test(html);
        if (hasExternalImages) {
          new Notice('正在转换图片...', 2000);
          html = await this.plugin.convertImagesToBase64(html);
        }

        this.html = html;
        this.updatePreview();
      }

      new Notice(`主题已切换为：${themeSelect.value}`, 2000);
    });

    // 使用说明
    const instructionDiv = controlPanel.createDiv({
      attr: { style: 'text-align: center; color: #2e7d32; font-weight: bold;' }
    });
    instructionDiv.innerHTML = '📱 长按选择内容复制，或使用下方按钮';

    // 预览容器
    this.previewContainer = contentEl.createDiv({
      attr: {
        style: 'border: 1px solid #4caf50; border-radius: 6px; padding: 15px; margin-bottom: 15px; max-height: 400px; overflow-y: auto; background: white;'
      }
    });

    // 设置预览内容
    this.previewContainer.innerHTML = this.html;

    // 优化选择体验
    this.optimizeSelectionExperience(this.previewContainer);

    // 辅助按钮
    this.createAssistantButtons(contentEl);
  }

  /**
   * 优化选择体验
   */
  private optimizeSelectionExperience(container: HTMLElement) {
    // 强制可选择
    container.style.userSelect = 'text';
    container.style.webkitUserSelect = 'text';
    container.style.mozUserSelect = 'text';
    container.style.msUserSelect = 'text';
    
    // 移动端优化
    container.style.webkitTouchCallout = 'default';
    container.style.webkitTapHighlightColor = 'rgba(76, 175, 80, 0.2)';
    container.style.touchAction = 'manipulation';
    
    // 添加选择事件监听
    container.addEventListener('mouseup', () => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        console.log('[WeWrite Mobile] 用户已选择内容，长度:', selection.toString().length);
        new Notice('✅ 内容已选择，请按 Ctrl+C 复制', 2000);
      }
    });

    console.log('[WeWrite Mobile] 选择体验已优化');
  }

  /**
   * 创建复制按钮
   */
  private createAssistantButtons(contentEl: HTMLElement) {
    const buttonContainer = contentEl.createDiv({
      attr: { style: 'text-align: center; display: flex; gap: 10px; justify-content: center; margin-top: 15px; flex-wrap: wrap;' }
    });

    // 模拟手动复制按钮（主要功能）
    const copyButton = buttonContainer.createEl('button', {
      text: '📋 一键复制',
      cls: 'mod-cta',
      attr: { style: 'padding: 10px 20px; font-size: 15px; font-weight: bold;' }
    });
    copyButton.onclick = () => this.simulateManualCopy();

    // 全选按钮（辅助功能）
    const selectAllButton = buttonContainer.createEl('button', {
      text: '📝 全选',
      attr: { style: 'padding: 8px 16px; font-size: 14px;' }
    });
    selectAllButton.onclick = () => this.selectAllContent();

    // 关闭按钮
    const closeButton = buttonContainer.createEl('button', {
      text: '关闭',
      attr: { style: 'padding: 8px 16px; font-size: 14px;' }
    });
    closeButton.onclick = () => this.close();
  }

  /**
   * 模拟手动复制 - 实现和手动复制一样的效果（包含Base64图片处理）
   */
  private async simulateManualCopy() {
    try {
      if (!this.previewContainer) {
        new Notice('❌ 找不到预览容器', 2000);
        return;
      }

      console.log('[WeWrite Mobile] 开始模拟手动复制');

      // 检查是否有外部图片需要转换
      const hasExternalImages = /<img[^>]+src="https?:\/\/[^"]+"/i.test(this.html);
      if (hasExternalImages) {
        new Notice('检测到外部图片，将在复制时转换...', 1000);
      }

      // 1. 选择所有内容（模拟手动选择）
      const range = document.createRange();
      range.selectNodeContents(this.previewContainer);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // 2. 短暂显示选择状态
      new Notice('✅ 内容已选中，正在复制...', 1000);

      // 3. 等待一下让用户看到选择效果
      await new Promise(resolve => setTimeout(resolve, 300));

      // 4. 执行复制（模拟手动Ctrl+C）
      const success = document.execCommand('copy');

      if (success) {
        console.log('[WeWrite Mobile] 模拟手动复制成功');
        const imageCount = (this.html.match(/<img[^>]+src="data:/g) || []).length;
        const message = imageCount > 0
          ? `✅ 复制成功！包含 ${imageCount} 张Base64图片\n直接粘贴到微信公众号即可`
          : '✅ 复制成功！\n直接粘贴到微信公众号即可';
        new Notice(message, 4000);
      } else {
        // 保持选择状态，让用户手动复制
        new Notice('⚠️ 自动复制失败\n内容已选中，请按 Ctrl+C', 3000);
      }

    } catch (error) {
      console.error('[WeWrite Mobile] 模拟手动复制失败:', error);
      new Notice('❌ 复制失败，请尝试手动选择', 2000);
    }
  }

  /**
   * 全选功能
   */
  private selectAllContent() {
    try {
      if (this.previewContainer) {
        const range = document.createRange();
        range.selectNodeContents(this.previewContainer);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        new Notice('✅ 内容已选中\n请按 Ctrl+C 复制', 2000);
        console.log('[WeWrite Mobile] 全选成功');
      } else {
        new Notice('❌ 找不到预览容器', 2000);
      }
    } catch (error) {
      console.error('[WeWrite Mobile] 全选失败:', error);
      new Notice('❌ 全选失败，请手动选择', 2000);
    }
  }

  /**
   * 更新预览内容
   */
  updatePreview() {
    if (this.previewContainer) {
      this.previewContainer.innerHTML = this.html;
      this.optimizeSelectionExperience(this.previewContainer);
      console.log('[WeWrite Mobile] 预览内容已更新');
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * 移动端设置页面
 */
class MobileSettingTab extends PluginSettingTab {
  plugin: WeWriteMobilePlugin;

  constructor(app: App, plugin: WeWriteMobilePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'WeWrite移动端设置' });

    // 主题选择
    new Setting(containerEl)
      .setName('选择主题')
      .setDesc('选择文章的显示主题')
      .addDropdown(dropdown => {
        AVAILABLE_THEMES.forEach(theme => {
          dropdown.addOption(theme, theme);
        });
        dropdown.setValue(this.plugin.settings.selectedTheme);
        dropdown.onChange(async (value) => {
          this.plugin.settings.selectedTheme = value;
          await this.plugin.saveSettings();
          new Notice(`主题已切换为：${value}`, 2000);
        });
      });

    // 调试日志
    new Setting(containerEl)
      .setName('启用调试日志')
      .setDesc('在控制台显示详细的调试信息')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableDebugLog)
        .onChange(async (value) => {
          this.plugin.settings.enableDebugLog = value;
          await this.plugin.saveSettings();
        }));
  }
}
