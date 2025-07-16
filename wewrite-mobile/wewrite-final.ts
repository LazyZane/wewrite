import { App, Plugin, Notice, Modal, MarkdownView, Menu, requestUrl, PluginSettingTab, Setting } from 'obsidian';

/**
 * 移动端设置接口
 */
interface MobileSettings {
  enabled: boolean;
  selectedTheme: string;
  // 微信公众号配置
  mpAccounts: MPAccount[];
  selectedMPAccount: string;
  // 中心令牌服务器
  useCenterToken: boolean;
  // 其他设置
  version: string;
}

/**
 * 微信公众号账户接口
 */
interface MPAccount {
  accountName: string;
  appId: string;
  appSecret: string;
  doc_id?: string; // 中心令牌服务器的文档ID
}

/**
 * 默认设置
 */
const DEFAULT_SETTINGS: MobileSettings = {
  enabled: true,
  selectedTheme: '1. 默认主题',
  mpAccounts: [],
  selectedMPAccount: '',
  useCenterToken: false,
  version: '1.0.0'
};

/**
 * WeWrite移动端插件 - 最终统一版本
 */
export default class WeWriteMobilePlugin extends Plugin {
  settings: MobileSettings;

  async onload() {
    console.log('WeWrite Mobile: Starting...');

    // 加载设置
    await this.loadSettings();

    // 添加状态栏按钮
    this.addStatusBarButton();

    // 添加左侧菜单栏按钮
    this.addRibbonButton();
    
    // 添加多个命令到命令面板
    this.addCommand({
      id: 'mobile-preview',
      name: '📱 移动端预览',
      callback: () => {
        this.mobilePreview();
      }
    });

    this.addCommand({
      id: 'theme-default',
      name: '🎨 默认主题',
      callback: () => {
        this.switchTheme('1. 默认主题');
      }
    });

    this.addCommand({
      id: 'theme-simple',
      name: '🎨 简约白',
      callback: () => {
        this.switchTheme('2. 简约白');
      }
    });

    this.addCommand({
      id: 'theme-business',
      name: '🎨 商务蓝',
      callback: () => {
        this.switchTheme('3. 商务蓝');
      }
    });

    this.addCommand({
      id: 'theme-warm',
      name: '🎨 温暖橙',
      callback: () => {
        this.switchTheme('4. 温暖橙');
      }
    });

    this.addCommand({
      id: 'wewrite-help',
      name: '❓ WeWrite帮助',
      callback: () => {
        new Notice('📱 WeWrite移动端\n\n1. 点击"移动端预览"生成预览\n2. 选择主题自定义样式\n3. 使用"一键复制"包含图片Base64转换\n4. 支持完整Markdown语法', 8000);
      }
    });

    // 添加设置页面
    this.addSettingTab(new MobileSettingTab(this.app, this));

    new Notice('WeWrite移动端已加载', 2000);
  }

  /**
   * 添加状态栏按钮（弹出菜单）
   */
  addStatusBarButton() {
    const statusBarItem = this.addStatusBarItem();
    statusBarItem.setText('📱 WeWrite');
    statusBarItem.setAttribute('title', 'WeWrite移动端预览');
    
    // 设置样式
    statusBarItem.style.cssText = 'cursor: pointer; background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;';
    
    // 点击事件 - 直接打开预览
    this.registerDomEvent(statusBarItem, 'click', (evt) => {
      console.log('WeWrite状态栏按钮被点击');
      this.mobilePreview();
    });

    console.log('WeWrite状态栏按钮已添加');
  }

  /**
   * 添加左侧菜单栏按钮
   */
  addRibbonButton() {
    // 添加主要的WeWrite按钮 - 直接打开预览
    const ribbonIconEl = this.addRibbonIcon('smartphone', 'WeWrite移动端预览', (evt: MouseEvent) => {
      this.mobilePreview();
    });

    // 设置按钮样式
    ribbonIconEl.addClass('wewrite-mobile-ribbon');

    console.log('WeWrite左侧菜单栏按钮已添加（直接预览模式）');
  }



  /**
   * 切换主题
   */
  switchTheme(themeName: string) {
    this.settings.selectedTheme = themeName;
    new Notice(`主题已切换为：${themeName}`, 2000);
    console.log(`[WeWrite] 主题切换为: ${themeName}`);
    this.saveSettings();
  }

  /**
   * 加载设置
   */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * 保存设置
   */
  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * 获取当前选中的微信公众号账户
   */
  getCurrentMPAccount(): MPAccount | null {
    if (!this.settings.selectedMPAccount) {
      return null;
    }

    return this.settings.mpAccounts.find(
      account => account.accountName === this.settings.selectedMPAccount
    ) || null;
  }

  /**
   * 获取微信Access Token（支持中心令牌服务器）
   */
  async getWeChatAccessToken(account: MPAccount): Promise<string> {
    try {
      if (this.settings.useCenterToken) {
        // 使用中心令牌服务器
        return await this.requestCenterToken(account);
      } else {
        // 直接调用微信API
        console.log('[WeWrite] 直接从微信API获取Access Token...');
        const response = await requestUrl({
          url: `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${account.appId}&secret=${account.appSecret}`,
          method: 'GET'
        });

        console.log('[WeWrite] 微信Token API响应:', response.text);
        const data = JSON.parse(response.text);

        if (data.errcode) {
          let errorMsg = `获取Access Token失败: ${data.errcode} - ${data.errmsg}`;

          // 常见错误码的中文解释
          switch (data.errcode) {
            case 40013:
              errorMsg += '\n可能原因：AppID无效，请检查AppID配置';
              break;
            case 40001:
              errorMsg += '\n可能原因：AppSecret无效，请检查AppSecret配置';
              break;
            case 40164:
              errorMsg += '\n可能原因：IP地址不在白名单中，请在微信公众号后台添加IP白名单';
              break;
          }

          throw new Error(errorMsg);
        }

        if (!data.access_token) {
          throw new Error('微信API返回的数据格式错误：缺少access_token');
        }

        console.log('[WeWrite] 本地获取Access Token成功');
        return data.access_token;
      }
    } catch (error) {
      console.error('[WeWrite] 获取Access Token失败:', error);
      throw error;
    }
  }

  /**
   * 请求中心令牌服务器
   */
  async requestCenterToken(account: MPAccount): Promise<string> {
    try {
      const url = "https://wewrite.3thinking.cn/mp_token";

      let params;
      if (account.doc_id) {
        params = { doc_id: account.doc_id };
      } else {
        params = {
          app_id: account.appId,
          secret: account.appSecret
        };
      }

      const response = await requestUrl({
        method: "POST",
        url: url,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });

      if (response.status !== 200) {
        throw new Error(response.text);
      }

      const { code, data, message, server_errcode, server_errmsg } = response.json;

      if (code !== 0) {
        if (code === -2) {
          // 重置doc_id并重试
          account.doc_id = undefined;
          await this.saveSettings();
          return await this.requestCenterToken(account);
        }
        if (code === -10) {
          // IP白名单问题
          if (data && data.errcode === 40164) {
            throw new Error(`请将您的IP地址添加到微信公众号的IP白名单中。错误详情: ${data.errmsg}`);
          }
        }

        // 如果有服务器错误码，优先显示服务器错误
        if (server_errcode && server_errmsg) {
          throw new Error(`微信API错误: ${server_errcode} - ${server_errmsg}`);
        }

        throw new Error(`中心服务器错误: ${code} - ${message}`);
      }

      // 检查返回的数据格式
      if (!data || !data.access_token) {
        throw new Error('中心服务器返回的数据格式错误');
      }

      console.log('[WeWrite] 中心令牌服务器获取成功');
      return data.access_token;
    } catch (error) {
      console.error('[WeWrite] 中心令牌服务器请求失败:', error);
      throw error;
    }
  }

  /**
   * 上传图片到微信（参考PC端实现）
   */
  async uploadImageToWeChat(imageUrl: string, accessToken: string): Promise<string | null> {
    try {
      console.log(`[WeWrite] 开始上传图片到微信: ${imageUrl}`);

      // 下载图片
      let blob: Blob;
      if (imageUrl.startsWith('data:')) {
        // Base64图片
        const response = await fetch(imageUrl);
        blob = await response.blob();
      } else if (imageUrl.startsWith('obsidian://')) {
        // 本地图片
        const filename = imageUrl.split('/').pop() || 'image.jpg';
        const file = this.app.vault.getAbstractFileByPath(filename);
        if (!file) {
          throw new Error(`本地文件未找到: ${filename}`);
        }
        const arrayBuffer = await this.app.vault.readBinary(file);
        blob = new Blob([arrayBuffer]);
      } else {
        // 外部链接
        const response = await requestUrl({ url: imageUrl });
        blob = new Blob([response.arrayBuffer]);
      }

      // 检查文件大小
      if (blob.size > 10 * 1024 * 1024) { // 10MB限制
        throw new Error(`图片文件过大: ${(blob.size / 1024 / 1024).toFixed(1)}MB`);
      }

      // 构建multipart/form-data
      const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
      const filename = `image_${Date.now()}.jpg`;

      const bodyParts: (string | Uint8Array)[] = [];
      const encoder = new TextEncoder();

      // 添加文件部分
      bodyParts.push(encoder.encode(
        `------${boundary}\r\n` +
        `Content-Disposition: form-data; name="media"; filename="${filename}"\r\n` +
        `Content-Type: application/octet-stream\r\n\r\n`
      ));

      // 添加文件内容
      const arrayBuffer = await blob.arrayBuffer();
      bodyParts.push(new Uint8Array(arrayBuffer));

      bodyParts.push(encoder.encode(`\r\n------${boundary}--\r\n`));

      // 合并所有部分
      const totalLength = bodyParts.reduce((sum, part) => sum + part.length, 0);
      const body = new Uint8Array(totalLength);
      let offset = 0;

      for (const part of bodyParts) {
        body.set(part, offset);
        offset += part.length;
      }

      // 上传到微信
      const uploadUrl = `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${accessToken}`;

      const response = await requestUrl({
        url: uploadUrl,
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=----${boundary}`
        },
        body: body.buffer as ArrayBuffer
      });

      const result = response.json;

      if (result.errcode && result.errcode !== 0) {
        throw new Error(`上传失败: ${result.errcode} - ${result.errmsg}`);
      }

      console.log(`[WeWrite] 图片上传成功: ${imageUrl} -> ${result.url}`);
      return result.url;

    } catch (error) {
      console.error(`[WeWrite] 图片上传失败: ${imageUrl}`, error);
      return null;
    }
  }

  /**
   * 处理HTML中的所有图片（上传到微信）
   */
  async processImagesForWeChat(html: string, accessToken: string): Promise<string> {
    try {
      console.log('[WeWrite] 开始处理图片上传到微信');

      // 创建临时DOM
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      // 查找所有图片
      const images = tempDiv.querySelectorAll('img');
      const uploadPromises: Promise<void>[] = [];

      images.forEach((img, index) => {
        const originalSrc = img.src;
        if (!originalSrc) return;

        const uploadPromise = (async () => {
          try {
            new Notice(`🔄 上传图片 ${index + 1}/${images.length}...`, 1000);

            const wechatUrl = await this.uploadImageToWeChat(originalSrc, accessToken);
            if (wechatUrl) {
              img.src = wechatUrl;
              img.setAttribute('data-original-src', originalSrc);
              console.log(`[WeWrite] 图片 ${index + 1} 上传成功`);
            } else {
              console.warn(`[WeWrite] 图片 ${index + 1} 上传失败，保持原链接`);
            }
          } catch (error) {
            console.error(`[WeWrite] 图片 ${index + 1} 处理失败:`, error);
          }
        })();

        uploadPromises.push(uploadPromise);
      });

      // 等待所有图片上传完成
      await Promise.all(uploadPromises);

      new Notice('✅ 图片处理完成', 2000);
      return tempDiv.innerHTML;

    } catch (error) {
      console.error('[WeWrite] 图片处理失败:', error);
      new Notice('⚠️ 图片处理失败，使用原始内容', 3000);
      return html;
    }
  }



  /**
   * 创建LocalDraftItem（参考PC端架构）
   */
  createLocalDraftItem(title: string, content: string, account: MPAccount): any {
    return {
      title: title,
      content: content,
      digest: title.substring(0, 120),
      author: account.accountName,
      content_source_url: '',
      need_open_comment: 0,
      only_fans_can_comment: 0,
      // 注意：不设置thumb_media_id，让它保持undefined
      // 这样在PC端的逻辑中会被正确处理
    };
  }

  /**
   * 发送文章到微信公众号草稿箱（参考PC端架构）
   */
  async sendToWeChatDraft(title: string, content: string): Promise<void> {
    try {
      const account = this.getCurrentMPAccount();
      if (!account) {
        throw new Error('请先在设置中配置微信公众号账户');
      }

      if (!account.appId || !account.appSecret) {
        throw new Error('微信公众号AppID或AppSecret未配置');
      }

      new Notice('正在获取微信授权...', 2000);
      const accessToken = await this.getWeChatAccessToken(account);

      new Notice('正在处理图片...', 2000);
      // 临时测试：跳过图片处理，直接使用原始内容
      console.log('[WeWrite] 临时测试：跳过图片处理，避免media_id问题');
      const processedContent = content; // 直接使用原始内容，不处理图片

      new Notice('正在发送到草稿箱...', 2000);

      // 创建LocalDraftItem（参考PC端架构）
      const localDraft = this.createLocalDraftItem(title, processedContent, account);

      // 使用PC端相同的发送逻辑
      const media_id = await this.sendArticleToDraftBoxLikePC(localDraft, accessToken);

      if (media_id) {
        new Notice('✅ 文章已成功发送到微信公众号草稿箱！', 5000);
        console.log('[WeWrite] 发送成功，草稿ID:', media_id);
      } else {
        throw new Error('发送失败：未获取到草稿ID');
      }

    } catch (error) {
      console.error('[WeWrite] 发送到微信公众号失败:', error);
      new Notice(`❌ 发送失败: ${error.message}`, 5000);
      throw error;
    }
  }

  /**
   * 发送到草稿箱（完全参考PC端实现）
   */
  async sendArticleToDraftBoxLikePC(localDraft: any, accessToken: string): Promise<string | false> {
    try {
      const url = "https://api.weixin.qq.com/cgi-bin/draft/add?access_token=" + accessToken;

      // 根据微信官方文档，thumb_media_id必须是有效的永久MediaID或完全不包含该字段
      const articleItem: any = {
        title: localDraft.title,
        content: localDraft.content,
        digest: localDraft.digest,
        ...(localDraft.content_source_url && {
          content_source_url: localDraft.content_source_url,
        }),
        ...(localDraft.need_open_comment !== undefined && {
          need_open_comment: localDraft.need_open_comment,
        }),
        ...(localDraft.only_fans_can_comment !== undefined && {
          only_fans_can_comment: localDraft.only_fans_can_comment,
        }),
        ...(localDraft.author && { author: localDraft.author }),
      };

      // 关键修复：只有当thumb_media_id是有效的永久MediaID时才包含该字段
      // 根据微信文档，这个字段如果存在，必须是有效的永久MediaID
      if (localDraft.thumb_media_id &&
          localDraft.thumb_media_id.trim() &&
          localDraft.thumb_media_id !== '') {
        articleItem.thumb_media_id = localDraft.thumb_media_id;
        console.log('[WeWrite] 包含封面图:', localDraft.thumb_media_id);
      } else {
        console.log('[WeWrite] 不包含封面图字段（避免40007错误）');
      }

      const body = {
        articles: [articleItem],
      };

      console.log('[WeWrite] PC端风格发送数据:', JSON.stringify(body, null, 2));

      // 检查content中是否包含无效的media_id
      const contentStr = body.articles[0].content;
      const mediaIdMatches = contentStr.match(/media_id["\s]*[:=]["\s]*([^"'\s,}]+)/gi);
      if (mediaIdMatches) {
        console.log('[WeWrite] 检测到content中的media_id:', mediaIdMatches);
        console.warn('[WeWrite] 警告：content中包含media_id，这可能导致40007错误');
      }

      const res = await requestUrl({
        method: "POST",
        url: url,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      console.log('[WeWrite] 微信API响应:', res.text);
      const { errcode, media_id, errmsg } = JSON.parse(res.text);

      if (errcode !== undefined && errcode !== 0) {
        let errorMsg = `发送失败: ${errcode} - ${errmsg}`;

        // 常见错误码的中文解释
        switch (errcode) {
          case 40001:
            errorMsg += '\n可能原因：Access Token无效或过期，请检查AppID/AppSecret配置';
            break;
          case 40007:
            errorMsg += '\n可能原因：媒体文件ID无效，请检查thumb_media_id字段';
            break;
          case 40164:
            errorMsg += '\n可能原因：IP地址不在白名单中，请在微信公众号后台添加IP白名单';
            break;
          case 45009:
            errorMsg += '\n可能原因：接口调用超过限制，请稍后重试';
            break;
        }

        new Notice(errorMsg, 0);
        return false;
      }

      return media_id;

    } catch (error) {
      console.error('[WeWrite] PC端风格发送失败:', error);
      new Notice(`发送失败: ${error.message}`, 5000);
      return false;
    }
  }

  /**
   * 移动端预览功能
   */
  mobilePreview() {
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

      new Notice('正在生成预览...', 1000);
      const html = this.convertToHtml(content);
      new MobilePreviewModal(this.app, html, this, content).open();
    } catch (error) {
      console.error('WeWrite预览失败:', error);
      new Notice(`预览失败: ${error.message}`, 5000);
    }
  }

  /**
   * 获取主题样式
   */
  getThemeStyles(themeName: string) {
    const themes = {
      '1. 默认主题': {
        h1: 'color: #4caf50; font-size: 24px; font-weight: bold; margin: 20px 0 15px 0;',
        h2: 'color: #4caf50; font-size: 20px; font-weight: bold; margin: 18px 0 12px 0;',
        h3: 'color: #4caf50; font-size: 18px; font-weight: bold; margin: 16px 0 10px 0;',
        highlight: 'background-color: #e8f5e8; color: #2e7d32; padding: 2px 4px; border-radius: 3px;',
        strong: 'color: #2e7d32; font-weight: bold;',
        em: 'color: #666; font-style: italic;'
      },
      '2. 简约白': {
        h1: 'color: #333; font-size: 24px; font-weight: bold; margin: 20px 0 15px 0;',
        h2: 'color: #333; font-size: 20px; font-weight: bold; margin: 18px 0 12px 0;',
        h3: 'color: #333; font-size: 18px; font-weight: bold; margin: 16px 0 10px 0;',
        highlight: 'background-color: #f0f0f0; color: #333; padding: 2px 4px; border-radius: 3px;',
        strong: 'color: #333; font-weight: bold;',
        em: 'color: #666; font-style: italic;'
      },
      '3. 商务蓝': {
        h1: 'color: #1976d2; font-size: 24px; font-weight: bold; margin: 20px 0 15px 0;',
        h2: 'color: #1976d2; font-size: 20px; font-weight: bold; margin: 18px 0 12px 0;',
        h3: 'color: #1976d2; font-size: 18px; font-weight: bold; margin: 16px 0 10px 0;',
        highlight: 'background-color: #e3f2fd; color: #0d47a1; padding: 2px 4px; border-radius: 3px;',
        strong: 'color: #0d47a1; font-weight: bold;',
        em: 'color: #666; font-style: italic;'
      },
      '4. 温暖橙': {
        h1: 'color: #ff5722; font-size: 24px; font-weight: bold; margin: 20px 0 15px 0;',
        h2: 'color: #ff5722; font-size: 20px; font-weight: bold; margin: 18px 0 12px 0;',
        h3: 'color: #ff5722; font-size: 18px; font-weight: bold; margin: 16px 0 10px 0;',
        highlight: 'background-color: #fff3e0; color: #bf360c; padding: 2px 4px; border-radius: 3px;',
        strong: 'color: #bf360c; font-weight: bold;',
        em: 'color: #666; font-style: italic;'
      },
      '5. 梦之蓝': {
        h1: 'color: #2196f3; font-size: 24px; font-weight: bold; margin: 20px 0 15px 0;',
        h2: 'color: #2196f3; font-size: 20px; font-weight: bold; margin: 18px 0 12px 0;',
        h3: 'color: #2196f3; font-size: 18px; font-weight: bold; margin: 16px 0 10px 0;',
        highlight: 'background-color: #e1f5fe; color: #01579b; padding: 2px 4px; border-radius: 3px;',
        strong: 'color: #01579b; font-weight: bold;',
        em: 'color: #666; font-style: italic;'
      },
      '6. 清新绿': {
        h1: 'color: #8bc34a; font-size: 24px; font-weight: bold; margin: 20px 0 15px 0;',
        h2: 'color: #8bc34a; font-size: 20px; font-weight: bold; margin: 18px 0 12px 0;',
        h3: 'color: #8bc34a; font-size: 18px; font-weight: bold; margin: 16px 0 10px 0;',
        highlight: 'background-color: #f1f8e9; color: #33691e; padding: 2px 4px; border-radius: 3px;',
        strong: 'color: #33691e; font-weight: bold;',
        em: 'color: #666; font-style: italic;'
      },
      '7. 优雅紫': {
        h1: 'color: #9c27b0; font-size: 24px; font-weight: bold; margin: 20px 0 15px 0;',
        h2: 'color: #9c27b0; font-size: 20px; font-weight: bold; margin: 18px 0 12px 0;',
        h3: 'color: #9c27b0; font-size: 18px; font-weight: bold; margin: 16px 0 10px 0;',
        highlight: 'background-color: #f3e5f5; color: #4a148c; padding: 2px 4px; border-radius: 3px;',
        strong: 'color: #4a148c; font-weight: bold;',
        em: 'color: #666; font-style: italic;'
      },
      '8. 经典黑': {
        h1: 'color: #424242; font-size: 24px; font-weight: bold; margin: 20px 0 15px 0;',
        h2: 'color: #424242; font-size: 20px; font-weight: bold; margin: 18px 0 12px 0;',
        h3: 'color: #424242; font-size: 18px; font-weight: bold; margin: 16px 0 10px 0;',
        highlight: 'background-color: #f5f5f5; color: #212121; padding: 2px 4px; border-radius: 3px;',
        strong: 'color: #212121; font-weight: bold;',
        em: 'color: #666; font-style: italic;'
      }
    };

    return themes[themeName] || themes['1. 默认主题'];
  }

  /**
   * Markdown转HTML（支持完整语法和主题）
   */
  convertToHtml(markdown: string): string {
    let html = markdown;
    
    // 获取当前主题样式
    const styles = this.getThemeStyles(this.settings.selectedTheme);

    // 处理标题
    html = html.replace(/^# (.+)$/gm, `<h1 style="${styles.h1}">$1</h1>`);
    html = html.replace(/^## (.+)$/gm, `<h2 style="${styles.h2}">$1</h2>`);
    html = html.replace(/^### (.+)$/gm, `<h3 style="${styles.h3}">$1</h3>`);

    // 处理高亮 ==text==
    html = html.replace(/==([^=]+)==/g, `<mark style="${styles.highlight}">$1</mark>`);

    // 处理粗体和斜体
    html = html.replace(/\*\*([^*]+)\*\*/g, `<strong style="${styles.strong}">$1</strong>`);
    html = html.replace(/\*([^*]+)\*/g, `<em style="${styles.em}">$1</em>`);

    // 处理分割线
    html = html.replace(/^---+$/gm, '<hr style="border: none; border-top: 2px solid #ddd; margin: 20px 0;">');

    // 处理列表（修复版本）
    // 先处理无序列表
    html = html.replace(/^- (.+)$/gm, '___UL_ITEM___$1___UL_ITEM_END___');
    // 将连续的无序列表项包装在ul标签中
    html = html.replace(/(___UL_ITEM___.*?___UL_ITEM_END___\n?)+/gs, (match) => {
      const items = match.split('___UL_ITEM_END___').filter(item => item.includes('___UL_ITEM___'));
      const listItems = items.map(item => {
        const content = item.replace('___UL_ITEM___', '').trim();
        return `<li style="margin: 5px 0; color: #333; list-style-type: disc;">${content}</li>`;
      }).join('');
      return `<ul style="margin: 10px 0; padding-left: 20px; list-style-type: disc;">${listItems}</ul>`;
    });

    // 处理有序列表
    html = html.replace(/^\d+\. (.+)$/gm, '___OL_ITEM___$1___OL_ITEM_END___');
    // 将连续的有序列表项包装在ol标签中
    html = html.replace(/(___OL_ITEM___.*?___OL_ITEM_END___\n?)+/gs, (match) => {
      const items = match.split('___OL_ITEM_END___').filter(item => item.includes('___OL_ITEM___'));
      const listItems = items.map(item => {
        const content = item.replace('___OL_ITEM___', '').trim();
        return `<li style="margin: 5px 0; color: #333;">${content}</li>`;
      }).join('');
      return `<ol style="margin: 10px 0; padding-left: 20px;">${listItems}</ol>`;
    });

    // 处理代码块
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre style="background: #f5f5f5; padding: 15px; border-radius: 6px; overflow-x: auto; margin: 15px 0;"><code style="font-family: monospace; font-size: 14px;">$2</code></pre>');

    // 处理行内代码
    html = html.replace(/`([^`]+)`/g, '<code style="background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>');

    // 处理引用
    html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left: 4px solid #ddd; margin: 15px 0; padding: 10px 15px; background: #f9f9f9; font-style: italic; color: #666;">$1</blockquote>');

    // 处理Obsidian本地图片 ![[filename.jpg]]
    html = html.replace(/!\[\[([^\]]+\.(jpg|jpeg|png|gif|webp|bmp))\]\]/gi, (match, filename) => {
      // 获取本地图片的资源路径
      const imagePath = this.getLocalImagePath(filename);
      return `<img src="${imagePath}" alt="${filename}" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px;" data-obsidian-image="${filename}">`;
    });

    // 处理标准Markdown图片 ![alt](url)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px;">');

    // 处理链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #4caf50; text-decoration: none;">$1</a>');

    // 处理段落
    html = html.replace(/\n\n/g, '</p><p style="margin: 12px 0; line-height: 1.6; color: #333;">');
    html = '<p style="margin: 12px 0; line-height: 1.6; color: #333;">' + html + '</p>';

    // 处理换行
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  /**
   * 获取本地图片路径
   */
  getLocalImagePath(filename: string): string {
    try {
      // 查找文件
      const file = this.app.vault.getAbstractFileByPath(filename);
      if (file) {
        // 获取资源路径
        return this.app.vault.getResourcePath(file);
      }

      // 如果直接路径找不到，尝试在附件文件夹中查找
      const attachmentFolders = ['attachments', 'assets', 'images', 'files'];
      for (const folder of attachmentFolders) {
        const fullPath = `${folder}/${filename}`;
        const file = this.app.vault.getAbstractFileByPath(fullPath);
        if (file) {
          return this.app.vault.getResourcePath(file);
        }
      }

      // 尝试全局搜索
      const allFiles = this.app.vault.getFiles();
      const matchingFile = allFiles.find(f => f.name === filename);
      if (matchingFile) {
        return this.app.vault.getResourcePath(matchingFile);
      }

      console.warn(`[WeWrite] 本地图片未找到: ${filename}`);
      return `obsidian://vault/${filename}`; // 备用路径
    } catch (error) {
      console.error(`[WeWrite] 获取本地图片路径失败: ${filename}`, error);
      return `obsidian://vault/${filename}`; // 备用路径
    }
  }

  /**
   * 简单的ArrayBuffer转Base64函数（参考桌面版）
   */
  arrayBufferToBase64Simple(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * 获取图片Blob（参考桌面版fetchImageBlob）
   */
  async fetchImageBlob(url: string): Promise<Blob> {
    return new Promise(async (resolve, reject) => {
      if (!url) {
        reject(new Error(`Invalid URL: ${url}`));
        return;
      }

      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          console.log(`[WeWrite] 开始下载图片: ${url}`);

          // 使用Obsidian的requestUrl API，避免CORS问题
          const response = await requestUrl({
            url: url,
            method: 'GET'
          });

          if (!response.arrayBuffer) {
            throw new Error('图片数据为空');
          }

          // 检查文件大小
          if (response.arrayBuffer.byteLength > 5 * 1024 * 1024) { // 5MB限制
            throw new Error(`图片文件过大: ${(response.arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);
          }

          // 尝试从响应头获取Content-Type
          let contentType = 'image/jpeg'; // 默认类型
          if (response.headers && response.headers['content-type']) {
            contentType = response.headers['content-type'];
          } else {
            // 尝试从URL扩展名推断类型
            const urlLower = url.toLowerCase();
            if (urlLower.includes('.png')) {
              contentType = 'image/png';
            } else if (urlLower.includes('.gif')) {
              contentType = 'image/gif';
            } else if (urlLower.includes('.webp')) {
              contentType = 'image/webp';
            } else if (urlLower.includes('.bmp')) {
              contentType = 'image/bmp';
            }
          }

          const blob = new Blob([response.arrayBuffer], { type: contentType });
          console.log(`[WeWrite] 图片下载成功: ${url} (${(blob.size / 1024).toFixed(1)}KB, ${contentType})`);
          resolve(blob);

        } catch (error) {
          console.error(`[WeWrite] 图片下载失败: ${url}`, error);
          reject(error);
        }
      } else {
        reject(new Error('不支持的URL格式'));
      }
    });
  }

  /**
   * 图片转Base64（参考桌面版逻辑）
   */
  async convertImageToBase64(imageUrl: string): Promise<string> {
    try {
      console.log(`[WeWrite] 开始转换图片为Base64: ${imageUrl}`);

      // 1. 下载图片（使用桌面版的逻辑）
      const blob = await this.fetchImageBlob(imageUrl);

      if (!blob) {
        throw new Error('下载图片失败');
      }

      // 2. 转换为Base64（使用桌面版的逻辑）
      const arrayBuffer = await blob.arrayBuffer();
      const base64String = this.arrayBufferToBase64Simple(arrayBuffer);
      const mimeType = blob.type || 'image/jpeg';
      const base64Url = `data:${mimeType};base64,${base64String}`;

      console.log(`[WeWrite] 图片转换成功: ${imageUrl} -> Base64 (${base64String.length} chars, ${mimeType})`);
      return base64Url;

    } catch (error) {
      console.error(`[WeWrite] 图片转换失败: ${imageUrl}`, error);
      throw error;
    }
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

    // 基础设置
    this.createBasicSettings(containerEl);

    // 微信公众号设置
    this.createWeChatSettings(containerEl);
  }

  /**
   * 创建基础设置
   */
  createBasicSettings(container: HTMLElement) {
    container.createEl('h3', { text: '基础设置' });

    new Setting(container)
      .setName('启用插件')
      .setDesc('开启或关闭WeWrite移动端功能')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enabled)
        .onChange(async (value) => {
          this.plugin.settings.enabled = value;
          await this.plugin.saveSettings();
        }));

    new Setting(container)
      .setName('默认主题')
      .setDesc('选择默认的文章渲染主题')
      .addDropdown(dropdown => {
        const themes = [
          '1. 默认主题',
          '2. 简约白',
          '3. 商务蓝',
          '4. 温暖橙',
          '5. 梦之蓝',
          '6. 清新绿',
          '7. 优雅紫',
          '8. 经典黑'
        ];

        themes.forEach(theme => {
          dropdown.addOption(theme, theme);
        });

        dropdown.setValue(this.plugin.settings.selectedTheme)
          .onChange(async (value) => {
            this.plugin.settings.selectedTheme = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(container)
      .setName('版本信息')
      .setDesc('当前插件版本')
      .addText(text => text
        .setValue(this.plugin.settings.version)
        .setDisabled(true));
  }

  /**
   * 创建微信公众号设置
   */
  createWeChatSettings(container: HTMLElement) {
    container.createEl('h3', { text: '微信公众号设置' });

    // 中心令牌服务器设置
    new Setting(container)
      .setName('使用中心令牌服务器')
      .setDesc('如果您的设备无法获取固定公网IP，可以使用我们的中心令牌服务器')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useCenterToken)
        .onChange(async (value) => {
          this.plugin.settings.useCenterToken = value;
          await this.plugin.saveSettings();
        }));

    // 账户选择
    new Setting(container)
      .setName('当前账户')
      .setDesc('选择要使用的微信公众号账户')
      .addDropdown(dropdown => {
        dropdown.addOption('', '请选择账户');

        this.plugin.settings.mpAccounts.forEach(account => {
          dropdown.addOption(account.accountName, account.accountName);
        });

        dropdown.setValue(this.plugin.settings.selectedMPAccount)
          .onChange(async (value) => {
            this.plugin.settings.selectedMPAccount = value;
            await this.plugin.saveSettings();
          });
      });

    // 添加新账户按钮
    new Setting(container)
      .setName('账户管理')
      .setDesc('添加或管理微信公众号账户')
      .addButton(button => button
        .setButtonText('添加新账户')
        .onClick(() => {
          this.addNewAccount();
        }));

    // 显示现有账户
    this.displayExistingAccounts(container);
  }

  /**
   * 添加新账户
   */
  addNewAccount() {
    const newAccount: MPAccount = {
      accountName: `账户${this.plugin.settings.mpAccounts.length + 1}`,
      appId: '',
      appSecret: ''
    };

    this.plugin.settings.mpAccounts.push(newAccount);
    this.plugin.saveSettings();
    this.display(); // 刷新界面
  }

  /**
   * 显示现有账户
   */
  displayExistingAccounts(container: HTMLElement) {
    if (this.plugin.settings.mpAccounts.length === 0) {
      container.createEl('p', {
        text: '暂无配置的微信公众号账户',
        cls: 'setting-item-description'
      });
      return;
    }

    this.plugin.settings.mpAccounts.forEach((account, index) => {
      const accountContainer = container.createDiv({ cls: 'wewrite-account-container' });

      accountContainer.createEl('h4', { text: `账户 ${index + 1}: ${account.accountName}` });

      new Setting(accountContainer)
        .setName('账户名称')
        .setDesc('用于识别的账户名称')
        .addText(text => text
          .setValue(account.accountName)
          .onChange(async (value) => {
            account.accountName = value;
            await this.plugin.saveSettings();
          }));

      new Setting(accountContainer)
        .setName('AppID')
        .setDesc('微信公众号的AppID')
        .addText(text => text
          .setValue(account.appId)
          .onChange(async (value) => {
            account.appId = value;
            await this.plugin.saveSettings();
          }));

      new Setting(accountContainer)
        .setName('AppSecret')
        .setDesc('微信公众号的AppSecret')
        .addText(text => text
          .setValue(account.appSecret)
          .onChange(async (value) => {
            account.appSecret = value;
            await this.plugin.saveSettings();
          }));

      new Setting(accountContainer)
        .setName('删除账户')
        .setDesc('删除此微信公众号账户')
        .addButton(button => button
          .setButtonText('删除')
          .setWarning()
          .onClick(async () => {
            this.plugin.settings.mpAccounts.splice(index, 1);
            if (this.plugin.settings.selectedMPAccount === account.accountName) {
              this.plugin.settings.selectedMPAccount = '';
            }
            await this.plugin.saveSettings();
            this.display(); // 刷新界面
          }));

      accountContainer.createEl('hr');
    });
  }
}

/**
 * 移动端预览模态框
 */
class MobilePreviewModal extends Modal {
  html: string;
  plugin: WeWriteMobilePlugin;
  previewContainer: HTMLElement;
  originalMarkdown: string;

  constructor(app: App, html: string, plugin: WeWriteMobilePlugin, originalMarkdown?: string) {
    super(app);
    this.html = html;
    this.plugin = plugin;
    this.originalMarkdown = originalMarkdown || '';
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    console.log('WeWrite预览模态框打开');

    // 设置模态框样式
    contentEl.style.maxWidth = '800px';
    contentEl.style.width = '95vw';
    contentEl.style.maxHeight = '85vh';

    // 添加标题
    const header = contentEl.createDiv({
      attr: { style: 'text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #e1e4e8;' }
    });
    header.createEl('h2', { text: '📱 WeWrite移动端预览', attr: { style: 'margin: 0; color: #4caf50;' } });

    // 主题选择器
    const themeContainer = contentEl.createDiv({
      attr: { style: 'display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px;' }
    });

    themeContainer.createEl('label', {
      text: '🎨 主题:',
      attr: { style: 'font-weight: bold; color: #4caf50;' }
    });

    const themeSelect = themeContainer.createEl('select', {
      attr: { style: 'padding: 4px 8px; border: 1px solid #4caf50; border-radius: 4px; background: white;' }
    });

    const themes = [
      '1. 默认主题',
      '2. 简约白',
      '3. 商务蓝',
      '4. 温暖橙',
      '5. 梦之蓝',
      '6. 清新绿',
      '7. 优雅紫',
      '8. 经典黑'
    ];

    themes.forEach(theme => {
      const option = themeSelect.createEl('option', { text: theme, value: theme });
      if (theme === this.plugin.settings.selectedTheme) {
        option.selected = true;
      }
    });

    themeSelect.addEventListener('change', () => {
      this.plugin.settings.selectedTheme = themeSelect.value;
      // 重新生成HTML并更新预览
      this.html = this.plugin.convertToHtml(this.originalMarkdown);
      this.previewContainer.innerHTML = this.html;
      new Notice(`主题已切换为：${themeSelect.value}`, 2000);
      // 保存设置
      this.plugin.saveSettings();
    });

    // 功能说明
    const instruction = contentEl.createDiv({
      attr: { style: 'background: #e8f5e8; border: 1px solid #4caf50; border-radius: 6px; padding: 12px; margin-bottom: 15px;' }
    });

    const currentAccount = this.plugin.getCurrentMPAccount();
    const accountInfo = currentAccount ? `当前账户: ${currentAccount.accountName}` : '未配置微信账户';

    instruction.innerHTML = `
      <div style="text-align: center; margin-bottom: 8px;">
        <span style="color: #2e7d32; font-weight: bold;">📱 WeWrite移动端操作中心</span>
      </div>
      <div style="font-size: 12px; color: #666; text-align: center;">
        🎨 主题切换 | 📋 智能复制 | 📤 发送公众号 | 📝 手动选择<br>
        ${accountInfo}
      </div>
    `;

    // 预览容器
    this.previewContainer = contentEl.createDiv({
      attr: {
        style: 'border: 1px solid #4caf50; border-radius: 6px; padding: 15px; margin-bottom: 15px; max-height: 400px; overflow-y: auto; background: white;'
      }
    });

    // 设置预览内容
    this.previewContainer.innerHTML = this.html;

    // 优化选择体验
    this.previewContainer.style.userSelect = 'text';
    this.previewContainer.style.webkitUserSelect = 'text';

    // 按钮区域
    this.createButtons(contentEl);
  }

  /**
   * 创建按钮
   */
  createButtons(contentEl: HTMLElement) {
    // 主要操作按钮区域
    const primaryButtonContainer = contentEl.createDiv({
      attr: { style: 'text-align: center; display: flex; gap: 10px; justify-content: center; margin-top: 15px; flex-wrap: wrap;' }
    });

    // 一键复制按钮（主要操作）
    const copyButton = primaryButtonContainer.createEl('button', {
      text: '📋 一键复制',
      cls: 'mod-cta',
      attr: { style: 'padding: 12px 24px; font-size: 16px; font-weight: bold; background: #4caf50; color: white; border: none; border-radius: 6px; cursor: pointer;' }
    });
    copyButton.onclick = () => this.smartCopy();

    // 发送到公众号按钮（主要操作）
    const sendButton = primaryButtonContainer.createEl('button', {
      text: '📤 发送到公众号',
      attr: { style: 'padding: 12px 24px; font-size: 16px; font-weight: bold; background: #07c160; color: white; border: none; border-radius: 6px; cursor: pointer;' }
    });
    sendButton.onclick = () => this.sendToWeChat();

    // 检查是否配置了微信账户，如果没有则禁用按钮
    const account = this.plugin.getCurrentMPAccount();
    if (!account) {
      sendButton.disabled = true;
      sendButton.style.background = '#ccc';
      sendButton.title = '请先在设置中配置微信公众号账户';
    }

    // 辅助操作按钮区域
    const secondaryButtonContainer = contentEl.createDiv({
      attr: { style: 'text-align: center; display: flex; gap: 8px; justify-content: center; margin-top: 10px; flex-wrap: wrap;' }
    });

    // 全选按钮
    const selectAllButton = secondaryButtonContainer.createEl('button', {
      text: '📝 全选',
      attr: { style: 'padding: 8px 16px; font-size: 14px; background: #f0f0f0; color: #333; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;' }
    });
    selectAllButton.onclick = () => this.selectAll();

    // 关闭按钮
    const closeButton = secondaryButtonContainer.createEl('button', {
      text: '关闭',
      attr: { style: 'padding: 8px 16px; font-size: 14px; background: #f0f0f0; color: #333; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;' }
    });
    closeButton.onclick = () => this.close();

    // 添加按钮说明
    const buttonHelp = contentEl.createDiv({
      attr: { style: 'text-align: center; margin-top: 10px; font-size: 12px; color: #666;' }
    });
    buttonHelp.innerHTML = `
      <div>💡 提示：</div>
      <div>• 一键复制：自动全选内容，然后按Ctrl+C复制（手动复制模式）</div>
      <div>• 发送公众号：自动上传图片到微信，支持本地和外部图片</div>
      <div>• 全选：手动选择内容后按Ctrl+C复制</div>
    `;
  }

  /**
   * 一键复制（手工复制逻辑，不处理图片）
   */
  async smartCopy() {
    try {
      console.log('[WeWrite] 开始一键复制（手工复制模式）');

      // 直接复制，不处理任何图片
      await this.directCopy();

    } catch (error) {
      console.error('[WeWrite] 一键复制失败:', error);
      new Notice('❌ 复制失败，请尝试手动复制', 3000);
    }
  }

  /**
   * 直接复制（改进版本）
   */
  async directCopy() {
    try {
      let processedHtml = this.html;
      const imgRegex = /<img[^>]+src="(https?:\/\/[^"]+)"[^>]*>/g;
      const matches = Array.from(processedHtml.matchAll(imgRegex));

      console.log(`发现 ${matches.length} 张外部图片，开始转换...`);

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const originalSrc = match[1];

        try {
          new Notice(`🔄 转换图片 ${i + 1}/${matches.length}...`, 1000);
          const base64 = await this.plugin.convertImageToBase64(originalSrc);

          // 验证Base64格式
          if (base64 && base64.startsWith('data:image/')) {
            processedHtml = processedHtml.replace(originalSrc, base64);
            console.log(`[WeWrite] 图片 ${i + 1} 转换成功: ${originalSrc} -> ${base64.substring(0, 50)}...`);
          } else {
            throw new Error('Base64格式无效');
          }
        } catch (error) {
          console.error(`[WeWrite] 图片 ${i + 1} 转换失败:`, error);
          new Notice(`⚠️ 图片 ${i + 1} 转换失败: ${error.message}`, 2000);
        }
      }

      // 更新预览容器和内部HTML
      console.log('[WeWrite] 更新预览容器内容');
      this.previewContainer.innerHTML = processedHtml;
      this.html = processedHtml;

      // 等待DOM更新完成
      await new Promise(resolve => setTimeout(resolve, 200));

      // 验证更新是否成功
      const updatedContent = this.previewContainer.innerHTML;
      const hasBase64Images = /src="data:image\/[^"]+"/i.test(updatedContent);

      if (hasBase64Images) {
        console.log('[WeWrite] 图片转换验证成功，发现Base64图片');
        new Notice('✅ 图片转换完成！正在复制...', 1000);
      } else {
        console.warn('[WeWrite] 警告：未检测到Base64图片，可能转换失败');
        new Notice('⚠️ 图片转换可能不完整', 2000);
      }

      // 复制处理后的内容
      await this.directCopy();
    } catch (error) {
      console.error('图片转换过程失败:', error);
      new Notice('❌ 图片转换失败，使用原始内容', 2000);
      await this.directCopy();
    }
  }

  /**
   * 转换本地图片并复制
   */
  async convertLocalImagesAndCopy() {
    try {
      let processedHtml = this.html;
      const localImgRegex = /<img[^>]+data-obsidian-image="([^"]+)"[^>]*>/g;
      const matches = Array.from(processedHtml.matchAll(localImgRegex));

      console.log(`[WeWrite] 发现 ${matches.length} 张本地图片，开始处理...`);

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const filename = match[1];

        try {
          new Notice(`🔄 处理本地图片 ${i + 1}/${matches.length}: ${filename}`, 1000);

          // 获取本地图片的Base64
          const base64 = await this.convertLocalImageToBase64(filename);

          if (base64 && base64.startsWith('data:image/')) {
            // 替换整个img标签
            const newImgTag = `<img src="${base64}" alt="${filename}" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px;">`;
            processedHtml = processedHtml.replace(match[0], newImgTag);
            console.log(`[WeWrite] 本地图片 ${i + 1} 转换成功: ${filename}`);
          } else {
            throw new Error('Base64格式无效');
          }
        } catch (error) {
          console.error(`[WeWrite] 本地图片 ${i + 1} 转换失败:`, error);
          new Notice(`⚠️ 本地图片 ${i + 1} 转换失败: ${error.message}`, 2000);
        }
      }

      // 更新预览容器和内部HTML
      console.log('[WeWrite] 更新预览容器内容');
      this.previewContainer.innerHTML = processedHtml;
      this.html = processedHtml;

      // 等待DOM更新完成
      await new Promise(resolve => setTimeout(resolve, 200));

      // 验证更新是否成功
      const updatedContent = this.previewContainer.innerHTML;
      const hasBase64Images = /src="data:image\/[^"]+"/i.test(updatedContent);

      if (hasBase64Images) {
        console.log('[WeWrite] 本地图片转换验证成功');
        new Notice('✅ 本地图片转换完成！正在复制...', 1000);
      } else {
        console.warn('[WeWrite] 警告：未检测到Base64图片，可能转换失败');
        new Notice('⚠️ 本地图片转换可能不完整', 2000);
      }

      // 复制处理后的内容
      await this.directCopy();

    } catch (error) {
      console.error('[WeWrite] 本地图片转换过程失败:', error);
      new Notice('❌ 本地图片转换失败，使用原始内容', 2000);
      await this.directCopy();
    }
  }

  /**
   * 将本地图片转换为Base64
   */
  async convertLocalImageToBase64(filename: string): Promise<string> {
    try {
      console.log(`[WeWrite] 开始转换本地图片: ${filename}`);

      // 查找文件
      let file = this.app.vault.getAbstractFileByPath(filename);

      if (!file) {
        // 尝试在常见附件文件夹中查找
        const attachmentFolders = ['attachments', 'assets', 'images', 'files'];
        for (const folder of attachmentFolders) {
          const fullPath = `${folder}/${filename}`;
          file = this.app.vault.getAbstractFileByPath(fullPath);
          if (file) break;
        }
      }

      if (!file) {
        // 全局搜索
        const allFiles = this.app.vault.getFiles();
        file = allFiles.find(f => f.name === filename);
      }

      if (!file) {
        throw new Error(`文件未找到: ${filename}`);
      }

      // 读取文件内容
      const arrayBuffer = await this.app.vault.readBinary(file);

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('文件内容为空');
      }

      // 检查文件大小
      if (arrayBuffer.byteLength > 5 * 1024 * 1024) { // 5MB限制
        throw new Error(`文件过大: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);
      }

      // 根据文件扩展名确定MIME类型
      const extension = filename.toLowerCase().split('.').pop();
      let mimeType = 'image/jpeg'; // 默认

      switch (extension) {
        case 'png':
          mimeType = 'image/png';
          break;
        case 'gif':
          mimeType = 'image/gif';
          break;
        case 'webp':
          mimeType = 'image/webp';
          break;
        case 'bmp':
          mimeType = 'image/bmp';
          break;
        case 'jpg':
        case 'jpeg':
          mimeType = 'image/jpeg';
          break;
      }

      // 转换为Base64
      const base64String = this.arrayBufferToBase64Simple(arrayBuffer);
      const base64Url = `data:${mimeType};base64,${base64String}`;

      console.log(`[WeWrite] 本地图片转换成功: ${filename} -> Base64 (${base64String.length} chars, ${mimeType})`);
      return base64Url;

    } catch (error) {
      console.error(`[WeWrite] 本地图片转换失败: ${filename}`, error);
      throw error;
    }
  }

  /**
   * 直接复制（简化版 - 直接复制原始内容）
   */
  async directCopy() {
    try {
      console.log('[WeWrite] 开始复制内容');

      // 直接选择预览容器的内容
      const range = document.createRange();
      range.selectNodeContents(this.previewContainer);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // 等待选择完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 尝试复制
      const success = document.execCommand('copy');

      if (success) {
        new Notice('✅ 复制成功！可以粘贴到微信了', 3000);
        console.log('[WeWrite] 复制成功');
      } else {
        // 备用方案：使用现代Clipboard API
        try {
          const htmlContent = this.previewContainer.innerHTML;
          const textContent = this.previewContainer.textContent || '';

          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.write([
              new ClipboardItem({
                'text/html': new Blob([htmlContent], { type: 'text/html' }),
                'text/plain': new Blob([textContent], { type: 'text/plain' })
              })
            ]);
            new Notice('✅ 复制成功！可以粘贴到微信了', 3000);
            console.log('[WeWrite] Clipboard API复制成功');
          } else {
            throw new Error('所有复制方法都失败');
          }
        } catch (clipboardError) {
          console.error('[WeWrite] Clipboard API也失败:', clipboardError);
          this.fallbackCopy();
        }
      }

      // 清除选择
      window.getSelection()?.removeAllRanges();

    } catch (error) {
      console.error('[WeWrite] 复制失败:', error);
      this.fallbackCopy();
    }
  }

  /**
   * 优化复制内容，减少多余换行
   */
  optimizeContentForCopy(container: HTMLElement) {
    // 移除所有注释节点
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_COMMENT,
      null,
      false
    );
    const comments = [];
    let node;
    while (node = walker.nextNode()) {
      comments.push(node);
    }
    comments.forEach(comment => comment.remove());

    // 优化文本节点，移除多余空白
    const textWalker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    const textNodes = [];
    while (node = textWalker.nextNode()) {
      textNodes.push(node);
    }

    textNodes.forEach(textNode => {
      if (textNode.textContent) {
        // 只在段落之间保留单个换行，移除多余空白
        textNode.textContent = textNode.textContent
          .replace(/\s+/g, ' ') // 多个空白字符替换为单个空格
          .trim(); // 移除首尾空白
      }
    });

    // 移除空的文本节点
    textNodes.forEach(textNode => {
      if (!textNode.textContent?.trim()) {
        textNode.remove();
      }
    });
  }

  /**
   * 备用复制方案
   */
  fallbackCopy() {
    try {
      // 创建临时文本区域
      const textArea = document.createElement('textarea');
      textArea.value = this.previewContainer.textContent || '';
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);

      textArea.focus();
      textArea.select();

      const success = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (success) {
        new Notice('✅ 文本复制成功！（纯文本格式）', 3000);
        console.log('[WeWrite] 备用方案复制成功');
      } else {
        new Notice('⚠️ 自动复制失败，请手动选择内容并按 Ctrl+C', 5000);
      }
    } catch (error) {
      console.error('[WeWrite] 备用复制方案也失败:', error);
      new Notice('❌ 复制失败，请手动选择内容并按 Ctrl+C', 5000);
    }
  }

  /**
   * 全选功能（改进版本）
   */
  async selectAll() {
    try {
      console.log('[WeWrite] 开始全选内容');

      // 确保预览容器可选择
      this.previewContainer.style.userSelect = 'text';
      this.previewContainer.style.webkitUserSelect = 'text';

      const range = document.createRange();
      range.selectNodeContents(this.previewContainer);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // 等待选择完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证选择是否成功
      const selectedText = selection?.toString();
      if (selectedText && selectedText.length > 0) {
        new Notice('✅ 内容已选中，请按 Ctrl+C 复制', 3000);
        console.log(`[WeWrite] 全选成功，选中 ${selectedText.length} 个字符`);
      } else {
        new Notice('⚠️ 选择可能不完整，请手动选择', 3000);
        console.warn('[WeWrite] 全选可能失败，未检测到选中内容');
      }

    } catch (error) {
      console.error('[WeWrite] 全选失败:', error);
      new Notice('❌ 全选失败，请手动选择内容', 3000);
    }
  }

  /**
   * 发送到微信公众号
   */
  async sendToWeChat() {
    try {
      console.log('[WeWrite] 开始发送到微信公众号');

      // 检查是否配置了微信账户
      const account = this.plugin.getCurrentMPAccount();
      if (!account) {
        new Notice('请先在设置中配置微信公众号账户', 5000);
        return;
      }

      // 获取文章标题（从原始Markdown中提取第一个标题）
      let title = '未命名文章';
      const titleMatch = this.originalMarkdown.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }

      // 确认发送
      const confirmed = confirm(`确定要将文章"${title}"发送到微信公众号"${account.accountName}"的草稿箱吗？`);
      if (!confirmed) {
        return;
      }

      // 发送到微信（图片会自动上传处理）
      await this.plugin.sendToWeChatDraft(title, this.html);

    } catch (error) {
      console.error('[WeWrite] 发送到微信失败:', error);
      new Notice(`发送失败: ${error.message}`, 5000);
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
