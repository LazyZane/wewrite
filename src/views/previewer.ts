/**
 * Define the right-side leaf of view as Previewer view
 */

import { EditorView } from "@codemirror/view";
import {
	Component,
	debounce,
	DropdownComponent,
	Editor,
	EventRef,
	ItemView,
	MarkdownView,
	Notice,
	sanitizeHTMLToDom,
	Setting,
	TFile,
	WorkspaceLeaf,
} from "obsidian";
import { $t } from "src/lang/i18n";
import WeWritePlugin from "src/main";
import { PreviewRender } from "src/render/marked-extensions/extension";
import {
	uploadCanvas,
	uploadSVGs,
	uploadURLImage,
	uploadURLVideo,
	convertExternalImagesToBase64,
} from "src/render/post-render";
import { WechatRender } from "src/render/wechat-render";
import { ResourceManager } from "../assets/resource-manager";
import { WechatClient } from "../wechat-api/wechat-client";
import { MPArticleHeader } from "./mp-article-header";
import { ThemeManager } from "../theme/theme-manager";
import { ThemeSelector } from "../theme/theme-selector";
import { WebViewModal } from "./webview";
import { processTemplate, mergeVariables } from "../utils/template-engine";
import { log } from "console";

export const VIEW_TYPE_WEWRITE_PREVIEW = "wewrite-article-preview";
export interface ElectronWindow extends Window {
	WEBVIEW_SERVER_URL: string;
}

/**
 * PreviewPanel is a view component that renders and previews markdown content with WeChat integration.
 * It provides real-time rendering, theme selection, and draft management capabilities for WeChat articles.
 * 
 * Features:
 * - Real-time markdown rendering with debounced updates
 * - Theme selection and application
 * - Draft management (send to WeChat draft box, copy to clipboard)
 * - Frontmatter property handling
 * - Shadow DOM rendering container
 * 
 * The panel integrates with WeChatClient for draft operations and maintains article properties in sync with markdown frontmatter.
 */
export class PreviewPanel extends ItemView implements PreviewRender {
	markdownView: MarkdownView | null = null;
	private articleDiv: HTMLDivElement;
	private listeners: EventRef[] = [];
	currentView: EditorView;
	observer: any;
	private wechatClient: WechatClient;
	private plugin: WeWritePlugin;
	private themeSelector: ThemeSelector;
	private debouncedRender = debounce(async () => {
		if (this.plugin.settings.realTimeRender) {
			await this.renderDraft();
		}
	}, 2000);
	private debouncedUpdate = debounce(async () => {
		if (this.plugin.settings.realTimeRender) {
			await this.renderDraft();
		}
	}, 1000);
	private debouncedCustomThemeChange = debounce(async (theme: string) => {
		this.getArticleProperties();
		this.articleProperties.set("custom_theme", theme);
		this.setArticleProperties();
		this.renderDraft();
	}, 2000);

	private draftHeader: MPArticleHeader;
	articleProperties: Map<string, string> = new Map();
	editorView: EditorView | null = null;
	lastLeaf: WorkspaceLeaf | undefined;
	renderDiv: any;
	elementMap: Map<string, Node | string>;
	articleTitle: Setting;
	containerDiv: HTMLElement;
	mpModal: WebViewModal;
	isActive: boolean = false;
	renderPreviewer: any;
	getViewType(): string {
		return VIEW_TYPE_WEWRITE_PREVIEW;
	}
	getDisplayText(): string {
		return $t("views.previewer.wewrite-previewer");
	}
	getIcon() {
		return "pen-tool";
	}
	constructor(leaf: WorkspaceLeaf, plugin: WeWritePlugin) {
		super(leaf);
		this.plugin = plugin;
		this.wechatClient = WechatClient.getInstance(this.plugin);
		this.themeSelector = new ThemeSelector(plugin);
	}

	async onOpen() {
		this.buildUI();
		this.startListen();

		this.plugin.messageService.registerListener(
			"draft-title-updated",
			(title: string) => {
				this.articleTitle.setName(title);
			}
		);
		this.themeSelector.startWatchThemes();
		this.plugin.messageService.registerListener(
			"custom-theme-changed",
			async (theme: string) => {
				this.debouncedCustomThemeChange(theme);
			}
		);
		this.plugin.messageService.sendMessage("active-file-changed", null);
		this.loadComponents();
	}

	getArticleProperties() {
		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (
			activeFile?.extension === "md" ||
			activeFile?.extension === "markdown"
		) {
			const cache = this.app.metadataCache.getCache(activeFile.path);
			const frontmatter = cache?.frontmatter;
			this.articleProperties.clear();
			if (frontmatter !== undefined && frontmatter !== null) {
				Object.keys(frontmatter).forEach((key) => {
					this.articleProperties.set(key, frontmatter[key]);
				});
			}
		}
		return this.articleProperties;
	}
	async setArticleProperties() {
		const path = this.getCurrentMarkdownFile();

		if (path && this.articleProperties.size > 0) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) {
				throw new Error(
					$t("views.previewer.file-not-found-path", [path])
				);
			}
			this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				this.articleProperties.forEach((value, key) => {
					frontmatter[key] = value;
				});
			});
		}

	}

	public getCurrentMarkdownFile() {
		const currentFile = this.plugin.app.workspace.getActiveFile();
		const leaves = this.plugin.app.workspace.getLeavesOfType("markdown");
		for (let leaf of leaves) {
			const markdownView = leaf.view as MarkdownView;
			if (markdownView.file?.path === currentFile?.path) {
				return markdownView.file?.path;
			}
		}
		return null;
	}
	async buildUI() {
		const container = this.containerEl.children[1];
		container.empty();

		const mainDiv = container.createDiv({
			cls: "wewrite-previewer-container",
		});
		// 创建顶部工具栏容器
		const toolbarContainer = mainDiv.createDiv({ cls: "wewrite-integrated-toolbar" });

		// 左侧：文章属性按钮
		const leftSection = toolbarContainer.createDiv({ cls: "toolbar-left" });
		const articlePropsBtn = leftSection.createEl("button", {
			text: "文章属性",
			cls: "toolbar-btn article-props-btn"
		});

		// 中间：主题和操作按钮
		const centerSection = toolbarContainer.createDiv({ cls: "toolbar-center" });

		// 主题选择 - 使用临时Setting来创建DropdownComponent
		const themeContainer = centerSection.createDiv({ cls: "theme-container" });
		themeContainer.createSpan({ text: "主题:", cls: "theme-label" });
		const tempSetting = new Setting(themeContainer)
			.setClass("theme-setting")
			.addDropdown((dropdown) => {
				this.themeSelector.dropdown(dropdown);
			});

		// 生成Obsidian主题按钮
		const generateThemeBtn = themeContainer.createEl("button", {
			cls: "toolbar-btn generate-theme-btn",
			attr: { "aria-label": "生成Obsidian主题" }
		});
		generateThemeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M12 2L2 7l10 5 10-5-10-5z"></path>
			<path d="M2 17l10 5 10-5"></path>
			<path d="M2 12l10 5 10-5"></path>
		</svg>`;
		generateThemeBtn.onclick = async () => {
			await this.generateObsidianTheme();
		};

		// 操作按钮组 - 使用图标
		const actionsContainer = centerSection.createDiv({ cls: "actions-container" });

		const refreshBtn = actionsContainer.createEl("button", {
			cls: "toolbar-btn action-btn icon-btn",
			attr: { "aria-label": "刷新渲染" }
		});
		refreshBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<polyline points="23 4 23 10 17 10"></polyline>
			<polyline points="1 20 1 14 7 14"></polyline>
			<path d="m20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
		</svg>`;
		refreshBtn.onclick = async () => {
			this.renderDraft();
		};

		const sendBtn = actionsContainer.createEl("button", {
			cls: "toolbar-btn action-btn icon-btn",
			attr: { "aria-label": "发送到草稿箱" }
		});
		sendBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<line x1="22" y1="2" x2="11" y2="13"></line>
			<polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
		</svg>`;
		sendBtn.onclick = async () => {
			if (await this.checkCoverImage()) {
				this.sendArticleToDraftBox();
			} else {
				new Notice($t("views.previewer.please-set-cover-image"));
			}
		};

		const copyBtn = actionsContainer.createEl("button", {
			cls: "toolbar-btn action-btn icon-btn",
			attr: {
				"aria-label": "复制到剪贴板（Base64转换）",
				"title": "左键：Base64转换复制\n右键：选择复制方式"
			}
		});
		copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
			<path d="m5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
		</svg>`;
		// 默认使用Base64转换，右键显示选项菜单
		copyBtn.onclick = async () => {
			await this.copyArticleWithBase64Images();
		};

		// 右键显示选项菜单
		copyBtn.oncontextmenu = (event) => {
			event.preventDefault();
			this.showCopyOptionsMenu(event, copyBtn);
		};

		// 创建文章属性下拉面板
		const articlePropsPanel = mainDiv.createDiv({ cls: "article-props-panel" });
		articlePropsPanel.style.display = "none"; // 默认收起

		// 文章属性按钮点击事件
		let isPanelOpen = false; // 默认收起状态
		articlePropsBtn.textContent = "文章属性"; // 初始显示展开
		articlePropsBtn.onclick = () => {
			isPanelOpen = !isPanelOpen;
			articlePropsPanel.style.display = isPanelOpen ? "block" : "none";
			articlePropsBtn.textContent = isPanelOpen ? "收起属性" : "文章属性";
		};

		this.draftHeader = new MPArticleHeader(this.plugin, articlePropsPanel);

		// 确保文章属性details在面板展开时自动展开
		setTimeout(() => {
			const detailsElement = articlePropsPanel.querySelector('details');
			if (detailsElement) {
				detailsElement.open = true; // 当面板显示时，details应该是展开的
			}
		}, 100);

		this.renderDiv = mainDiv.createDiv({ cls: "render-container" });
		this.renderDiv.id = "render-div";
		this.renderPreviewer = mainDiv.createDiv({
			cls: ".wewrite-render-preview",
		})
		this.renderPreviewer.hide()

		// 检查Shadow DOM支持（移动端兼容性）
		let shadowDom = this.renderDiv.shadowRoot;
		if (shadowDom === undefined || shadowDom === null) {
			try {
				// 检查是否支持attachShadow
				if (this.renderDiv.attachShadow) {
					shadowDom = this.renderDiv.attachShadow({ mode: 'open' });

					// 检查是否支持adoptedStyleSheets
					if (shadowDom.adoptedStyleSheets !== undefined) {
						shadowDom.adoptedStyleSheets = [
							ThemeManager.getInstance(this.plugin).getShadowStleSheet()
						];
					} else {
						console.warn('[WeWrite] adoptedStyleSheets not supported, using fallback');
						// 移动端fallback：直接添加style元素
						const styleEl = shadowDom.createElement('style');
						styleEl.textContent = ThemeManager.getInstance(this.plugin).getShadowStyleText();
						shadowDom.appendChild(styleEl);
					}
				} else {
					console.warn('[WeWrite] Shadow DOM not supported, using regular DOM');
					// 如果不支持Shadow DOM，直接使用普通DOM
					shadowDom = this.renderDiv;
				}
			} catch (error) {
				console.error('[WeWrite] Shadow DOM creation failed:', error);
				// Fallback到普通DOM
				shadowDom = this.renderDiv;
			}
		}

		this.containerDiv = shadowDom.createDiv({ cls: "wewrite-article" });
		this.articleDiv = this.containerDiv.createDiv({ cls: "article-div" });
	}
	async checkCoverImage() {
		return this.draftHeader.checkCoverImage();
	}
	async sendArticleToDraftBox() {
		try {
			// 🎯 直接使用与复制功能完全相同的处理逻辑
			console.log('[WeWrite] 🎯 使用复制功能的处理逻辑进行发送');

			// 1. 克隆DOM以避免影响原始预览
			const clonedDiv = this.articleDiv.cloneNode(true) as HTMLElement;

			// 2. 临时添加到文档中以获取正确的计算样式
			clonedDiv.style.position = 'absolute';
			clonedDiv.style.top = '-9999px';
			clonedDiv.style.left = '-9999px';
			clonedDiv.style.visibility = 'hidden';
			document.body.appendChild(clonedDiv);

			// 3. 执行图片处理（与复制功能相同）
			await uploadSVGs(clonedDiv, this.plugin.wechatClient);
			await uploadCanvas(clonedDiv, this.plugin.wechatClient);
			await uploadURLImage(clonedDiv, this.plugin.wechatClient);
			await uploadURLVideo(clonedDiv, this.plugin.wechatClient);

			// 4. 应用样式转换（与复制功能相同）
			await this.convertComputedStylesToInline(clonedDiv);

		// 5. 🔧 最小侵入性修复：在发送前处理高亮问题
		this.fixHighlightForWechat(clonedDiv);

		// 6. 修复CSS变量问题：微信不支持CSS变量，需要替换为实际值
		this.replaceCSSVariablesWithActualValues(clonedDiv);

			// 7. 获取处理后的HTML内容
			const finalContent = clonedDiv.innerHTML;

			// 8. 清理临时DOM
			document.body.removeChild(clonedDiv);

			// 9. 发送到草稿箱
			const media_id = await this.wechatClient.sendArticleToDraftBox(
				this.draftHeader.getActiveLocalDraft()!,
				finalContent
			);

			if (media_id) {
				this.draftHeader.updateDraftDraftId(media_id);
				const news_item = await this.wechatClient.getDraftById(
					this.plugin.settings.selectedMPAccount!,
					media_id
				);
				if (news_item) {
					open(news_item[0].url);
					const item = {
						media_id: media_id,
						content: {
							news_item: news_item,
						},
						update_time: Date.now(),
					};
					this.plugin.messageService.sendMessage(
						"draft-item-updated",
						item
					);
				}
			}
		} catch (error) {
			console.error('[WeWrite] 发送到草稿箱时发生错误:', error);
			new Notice("发送失败，请重试");
		}
	}
	public getArticleContent() {
		return this.articleDiv.innerHTML;
	}

	/**
	 * 复制文章内容到剪贴板，包含图片处理
	 * 与发送到草稿箱使用相同的图片上传逻辑
	 */
	async copyArticleWithImageProcessing() {
		try {
			// 1. 显示加载提示
			new Notice("正在处理图片，请稍候...");

			// 2. 克隆DOM以避免影响原始预览
			const clonedDiv = this.articleDiv.cloneNode(true) as HTMLElement;

			// 重要：将克隆的DOM临时添加到文档中，以便获取正确的计算样式
			clonedDiv.style.position = 'absolute';
			clonedDiv.style.top = '-9999px';
			clonedDiv.style.left = '-9999px';
			clonedDiv.style.visibility = 'hidden';
			document.body.appendChild(clonedDiv);



			// 3. 统计处理前的外部图片数量
			const externalImagesBefore = clonedDiv.querySelectorAll('img[src^="http"]:not([src*="mmbiz.qpic.cn"])');

			// 4. 对克隆的DOM执行图片上传处理（与发送到草稿箱相同的逻辑）
			await uploadSVGs(clonedDiv, this.plugin.wechatClient);
			await uploadCanvas(clonedDiv, this.plugin.wechatClient);
			await uploadURLImage(clonedDiv, this.plugin.wechatClient);
			await uploadURLVideo(clonedDiv, this.plugin.wechatClient);

			// 5. 统计处理后的外部图片数量
			const externalImagesAfter = clonedDiv.querySelectorAll('img[src^="http"]:not([src*="mmbiz.qpic.cn"])');

			// 6. 应用样式转换：将计算样式转换为内联样式
			await this.convertComputedStylesToInline(clonedDiv);

			// 8. 获取处理后的HTML内容
			const processedContent = clonedDiv.innerHTML;

			// 9. 清理临时DOM
			document.body.removeChild(clonedDiv);

			// 10. 复制到剪贴板
			await navigator.clipboard.write([
				new ClipboardItem({
					"text/html": new Blob([processedContent], { type: "text/html" }),
				}),
			]);

			// 8. 显示成功提示
			const successMessage = externalImagesBefore.length > 0
				? `文章已复制到剪贴板（${externalImagesBefore.length - externalImagesAfter.length} 张图片已转换为微信链接）`
				: "文章已复制到剪贴板";

			new Notice(successMessage);

		} catch (error) {
			console.error('[WeWrite] 复制文章时发生错误:', error);

			// 发生错误时，降级到简单复制
			try {
				const fallbackContent = this.getArticleContent();
				await navigator.clipboard.write([
					new ClipboardItem({
						"text/html": new Blob([fallbackContent], { type: "text/html" }),
					}),
				]);
				new Notice("文章已复制到剪贴板（图片处理失败，使用原始链接）");
			} catch (fallbackError) {
				console.error('[WeWrite] 降级复制也失败:', fallbackError);
				new Notice("复制失败，请重试");
			}
		}
	}

	/**
	 * 复制文章内容到剪贴板，使用Base64转换图片（不需要微信API）
	 * 模仿Obsidian本地图片的处理方式
	 */
	async copyArticleWithBase64Images() {
		try {
			// 1. 显示加载提示
			new Notice("正在将图片转换为Base64格式，请稍候...");

			// 2. 克隆DOM以避免影响原始预览
			const clonedDiv = this.articleDiv.cloneNode(true) as HTMLElement;

			// 重要：将克隆的DOM临时添加到文档中，以便获取正确的计算样式
			clonedDiv.style.position = 'absolute';
			clonedDiv.style.top = '-9999px';
			clonedDiv.style.left = '-9999px';
			clonedDiv.style.visibility = 'hidden';
			document.body.appendChild(clonedDiv);

			// 3. 统计处理前的外部图片数量
			const externalImagesBefore = clonedDiv.querySelectorAll('img[src^="http"]:not([src*="mmbiz.qpic.cn"])');
			console.log(`[WeWrite] Found ${externalImagesBefore.length} external images to convert to Base64`);

			// 4. 对克隆的DOM执行图片处理
			await uploadSVGs(clonedDiv, this.plugin.wechatClient);
			await uploadCanvas(clonedDiv, this.plugin.wechatClient);

			// 🎯 关键改变：使用Base64转换而不是微信API上传
			await convertExternalImagesToBase64(clonedDiv);

			await uploadURLVideo(clonedDiv, this.plugin.wechatClient);

			// 5. 统计处理后的外部图片数量
			const externalImagesAfter = clonedDiv.querySelectorAll('img[src^="http"]:not([src*="mmbiz.qpic.cn"])');
			const convertedCount = externalImagesBefore.length - externalImagesAfter.length;

			// 6. 应用样式转换：将计算样式转换为内联样式
			await this.convertComputedStylesToInline(clonedDiv);

			// 7. 获取处理后的HTML内容
			const processedContent = clonedDiv.innerHTML;

			// 8. 清理临时DOM
			document.body.removeChild(clonedDiv);

			// 9. 复制到剪贴板
			await navigator.clipboard.write([
				new ClipboardItem({
					"text/html": new Blob([processedContent], { type: "text/html" }),
				}),
			]);

			// 10. 显示成功提示
			const successMessage = externalImagesBefore.length > 0
				? `✅ 文章已复制到剪贴板！\n\n📊 图片处理结果：\n• ${convertedCount} 张图床图片已转换为Base64格式\n• 可直接粘贴到微信编辑器，图片会自动显示\n\n💡 右键复制按钮可选择其他复制方式`
				: "✅ 文章已复制到剪贴板";

			new Notice(successMessage, 6000);

			console.log(`[WeWrite] Base64 copy completed: ${convertedCount}/${externalImagesBefore.length} images converted`);

		} catch (error) {
			console.error('[WeWrite] 复制文章时发生错误:', error);

			// 发生错误时，降级到简单复制
			try {
				const fallbackContent = this.getArticleContent();
				await navigator.clipboard.write([
					new ClipboardItem({
						"text/html": new Blob([fallbackContent], { type: "text/html" }),
					}),
				]);
				new Notice("⚠️ Base64转换失败，已复制原始内容（图片保持原链接）");
			} catch (fallbackError) {
				console.error('[WeWrite] 降级复制也失败:', fallbackError);
				new Notice("❌ 复制失败，请重试");
			}
		}
	}

	/**
	 * 显示复制选项菜单
	 */
	private showCopyOptionsMenu(event: MouseEvent, button: HTMLElement) {
		event.preventDefault();

		// 创建菜单容器
		const menu = document.createElement('div');
		menu.className = 'wewrite-copy-menu';
		menu.style.cssText = `
			position: absolute;
			background: white;
			border: 1px solid #ccc;
			border-radius: 6px;
			box-shadow: 0 4px 12px rgba(0,0,0,0.15);
			z-index: 1000;
			min-width: 200px;
			padding: 8px 0;
		`;

		// 选项1：Base64转换（默认）
		const option1 = document.createElement('div');
		option1.className = 'wewrite-copy-option';
		option1.style.cssText = `
			padding: 8px 16px;
			cursor: pointer;
			border-bottom: 1px solid #eee;
		`;
		option1.innerHTML = `
			<div style="font-weight: bold; color: #1a73e8;">📷 Base64转换（默认）</div>
			<div style="font-size: 12px; color: #666; margin-top: 2px;">图床图片转Base64，无需微信API（左键默认）</div>
		`;
		option1.onclick = async () => {
			document.body.removeChild(menu);
			await this.copyArticleWithBase64Images();
		};

		// 选项2：微信API上传
		const option2 = document.createElement('div');
		option2.className = 'wewrite-copy-option';
		option2.style.cssText = `
			padding: 8px 16px;
			cursor: pointer;
		`;
		option2.innerHTML = `
			<div style="font-weight: bold; color: #333;">🔗 微信API上传</div>
			<div style="font-size: 12px; color: #666; margin-top: 2px;">上传到微信素材库（需要API配置）</div>
		`;
		option2.onclick = async () => {
			document.body.removeChild(menu);
			await this.copyArticleWithImageProcessing();
		};

		// 添加悬停效果
		[option1, option2].forEach(option => {
			option.addEventListener('mouseenter', () => {
				option.style.backgroundColor = '#f5f5f5';
			});
			option.addEventListener('mouseleave', () => {
				option.style.backgroundColor = 'transparent';
			});
		});

		menu.appendChild(option1);
		menu.appendChild(option2);

		// 定位菜单
		const rect = button.getBoundingClientRect();
		menu.style.left = `${rect.left}px`;
		menu.style.top = `${rect.bottom + 5}px`;

		// 添加到页面
		document.body.appendChild(menu);

		// 点击外部关闭菜单
		const closeMenu = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				document.body.removeChild(menu);
				document.removeEventListener('click', closeMenu);
			}
		};
		setTimeout(() => {
			document.addEventListener('click', closeMenu);
		}, 100);
	}

	/**
	 * 将计算样式转换为内联样式
	 * 确保复制到公众号时样式正确显示
	 */
	private async convertComputedStylesToInline(rootElement: HTMLElement): Promise<void> {
		// 递归处理所有元素
		this.processElementStyles(rootElement);

		// 处理所有子元素
		const allElements = rootElement.querySelectorAll('*');
		allElements.forEach(element => {
			if (element instanceof HTMLElement) {
				this.processElementStyles(element);
			}
		});
	}

	/**
	 * 处理单个元素的样式转换
	 */
	private processElementStyles(element: HTMLElement): void {
		const computedStyle = getComputedStyle(element);

		// 特别处理高亮元素
		if (this.isHighlightElement(element)) {
			this.processHighlightStyles(element, computedStyle);
			// 高亮元素不需要处理通用样式，避免覆盖
			return;
		}

		// 处理其他重要样式
		this.processGeneralStyles(element, computedStyle);
	}

	/**
	 * 判断是否为高亮元素
	 * 基于实际观察，高亮元素是有特定内联样式的span
	 */
	private isHighlightElement(element: HTMLElement): boolean {
		// 优先检查WeWrite高亮类名
		if (element.classList.contains('wewrite-highlight')) {
			console.log(`[WeWrite] ✅ 找到wewrite-highlight类名元素:`, element.textContent?.substring(0, 20));
			return true;
		}

		// 检查传统的mark标签
		if (element.tagName.toLowerCase() === 'mark') {
			console.log(`[WeWrite] ✅ 找到mark标签元素:`, element.textContent?.substring(0, 20));
			return true;
		}

		// 检查其他可能的高亮类名
		if (element.className.includes('highlight')) {
			console.log(`[WeWrite] ✅ 找到包含highlight的类名元素:`, element.textContent?.substring(0, 20));
			return true;
		}

		// 检查是否为高亮span（基于内联样式特征）
		if (element.tagName.toLowerCase() === 'span') {
			const style = element.style;
			const textContent = element.textContent || '';

			// 检查是否有高亮特征的内联样式
			const hasHighlightStyles =
				// 检查是否有背景色相关样式
				(style.backgroundColor || style.background) ||
				// 检查是否有padding（高亮通常有padding）
				style.padding ||
				// 检查是否有border-radius（高亮通常有圆角）
				style.borderRadius;

			// 检查文本内容特征
			const isReasonableLength = textContent.length > 0 && textContent.length < 50; // 高亮文本通常较短
			const isNotWhitespace = textContent.trim().length > 0; // 不是纯空白

			// 排除明显不是高亮的元素
			const isNotTitle = !element.closest('h1, h2, h3, h4, h5, h6'); // 不在标题中

			if (hasHighlightStyles && isReasonableLength && isNotWhitespace && isNotTitle) {
				console.log(`[WeWrite] ✅ 找到疑似高亮span:`, {
					textContent: textContent.substring(0, 20),
					hasBackground: !!(style.backgroundColor || style.background),
					hasPadding: !!style.padding,
					hasBorderRadius: !!style.borderRadius
				});
				return true;
			}
		}

		return false;
	}

	/**
	 * 处理高亮元素的样式
	 */
	private processHighlightStyles(element: HTMLElement, computedStyle: CSSStyleDeclaration): void {
		console.log(`[WeWrite] 🎯 开始处理高亮元素:`, element.textContent?.substring(0, 20));

		const bgColor = computedStyle.backgroundColor;
		const textColor = computedStyle.color;
		const padding = computedStyle.padding;
		const borderRadius = computedStyle.borderRadius;

		// 调试：检查元素的display状态
		console.log(`[WeWrite] 处理高亮元素:`, {
			textContent: element.textContent?.substring(0, 20),
			display: computedStyle.display,
			backgroundColor: bgColor,
			color: textColor,
			outerHTML: element.outerHTML.substring(0, 150)
		});

		// 强制设置高亮样式为内联样式
		if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
			element.style.setProperty('background-color', bgColor, 'important');
			console.log(`[WeWrite] ✅ 使用计算背景色: ${bgColor}`);
		} else {
			// 背景色透明时，使用默认的高亮背景色
			const defaultHighlightBg = '#e3f2fd'; // 浅蓝色背景
			element.style.setProperty('background-color', defaultHighlightBg, 'important');
			console.log(`[WeWrite] ⚠️ 背景色透明，使用默认色: ${defaultHighlightBg}`);
		}

		if (textColor && textColor !== 'rgba(0, 0, 0, 0)') {
			element.style.setProperty('color', textColor, 'important');
			console.log(`[WeWrite] ✅ 使用计算文字色: ${textColor}`);
		} else {
			// 文字色透明时，使用默认的高亮文字色
			const defaultHighlightColor = '#1565c0'; // 深蓝色文字
			element.style.setProperty('color', defaultHighlightColor, 'important');
			console.log(`[WeWrite] ⚠️ 文字色透明，使用默认色: ${defaultHighlightColor}`);
		}

		if (padding && padding !== '0px') {
			element.style.setProperty('padding', padding, 'important');
		}
		if (borderRadius && borderRadius !== '0px') {
			element.style.setProperty('border-radius', borderRadius, 'important');
		}

		// 确保高亮元素的显示样式
		element.style.setProperty('display', 'inline', 'important');
		element.style.setProperty('border', 'none', 'important');
		element.style.setProperty('text-decoration', 'none', 'important');
		element.style.setProperty('background-image', 'none', 'important');

		// 添加一些高亮特有的样式
		element.style.setProperty('padding', '0.125em 0.375em', 'important');
		element.style.setProperty('border-radius', '0.25em', 'important');
		element.style.setProperty('margin', '0', 'important');

		console.log(`[WeWrite] ✅ 高亮样式设置完成:`, {
			display: element.style.display,
			backgroundColor: element.style.backgroundColor,
			color: element.style.color,
			allStyles: element.getAttribute('style')
		});
	}

	/**
	 * 处理通用样式
	 */
	private processGeneralStyles(element: HTMLElement, computedStyle: CSSStyleDeclaration): void {
		// 需要转换的关键样式属性
		const importantStyles = [
			'font-size', 'font-weight', 'font-style', 'font-family',
			'text-align', 'line-height', 'letter-spacing',
			'margin', 'border', 'box-shadow'
		];

		const appliedStyles: string[] = [];
		importantStyles.forEach(property => {
			const value = computedStyle.getPropertyValue(property);
			if (value &&
			    value !== 'initial' &&
			    value !== 'normal' &&
			    value !== 'rgba(0, 0, 0, 0)' &&
			    value !== '0px' &&
			    value !== 'none') {
				element.style.setProperty(property, value, 'important');
				appliedStyles.push(`${property}: ${value}`);
			}
		});

		if (appliedStyles.length > 0) {
			console.log(`[WeWrite] 通用样式应用到 ${element.tagName}:`, appliedStyles);
		}
	}

	// async getCSS() {
	// 	return await ThemeManager.getInstance(this.plugin).getCSS();
	// }

	async onClose() {
		// Clean up our view
		this.stopListen();
	}

	async parseActiveMarkdown() {
		// get properties
		const prop = this.getArticleProperties();
		const mview = ResourceManager.getInstance(
			this.plugin
		).getCurrentMarkdownView();
		if (!mview) {
			return $t("views.previewer.not-a-markdown-view");
		}
		this.articleDiv.empty();
		this.elementMap = new Map<string, HTMLElement | string>();
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			return `<h1>No active file</h1>`;
		}
		if (activeFile.extension !== "md") {
			return `<h1>Not a markdown file</h1>`;
		}

		let html = await WechatRender.getInstance(this.plugin, this).parseNote(
			activeFile.path,
			this.renderPreviewer,
			this
		);

		// return; //to see the render tree.
		const articleSection = createEl("section", {
			cls: "wewrite-article-content wewrite",
		});

		// 现在开头结尾已经在markdown渲染阶段统一处理了
		const dom = sanitizeHTMLToDom(html);
		articleSection.appendChild(dom);

		this.articleDiv.empty();
		this.articleDiv.appendChild(articleSection);

		this.elementMap.forEach(
			async (node: HTMLElement | string, id: string) => {
				const item = this.articleDiv.querySelector(
					"#" + id
				) as HTMLElement;

				if (!item) return;
				if (typeof node === "string") {
					const tf = ResourceManager.getInstance(
						this.plugin
					).getFileOfLink(node);
					if (tf) {
						const file = this.plugin.app.vault.getFileByPath(
							tf.path
						);
						if (file) {
							const body = await WechatRender.getInstance(
								this.plugin,
								this
							).parseNote(file.path, this.articleDiv, this);
							item.empty();
							item.appendChild(sanitizeHTMLToDom(body));
						}
					}
				} else {
					item.appendChild(node);
				}
			}
		);
		// return this.articleDiv.innerHTML;
	}
	async renderDraft() {
		if (!this.isViewActive()) {
			return;
		}

		await this.parseActiveMarkdown();
		if (this.articleDiv === null || this.articleDiv.firstChild === null) {
			return;
		}
		await ThemeManager.getInstance(this.plugin).applyTheme(
			this.articleDiv.firstChild as HTMLElement
		);
	}
	isViewActive(): boolean {
		return this.isActive && !this.app.workspace.rightSplit.collapsed
	}

	startListen() {
		this.registerEvent(
			this.plugin.app.vault.on("rename", (file: TFile) => {
				this.draftHeader.onNoteRename(file);
			})
		);
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				const isOpen = this.app.workspace.getLeavesOfType(VIEW_TYPE_WEWRITE_PREVIEW).length > 0;
				this.isActive = isOpen;
			})
		);

		const ec = this.app.workspace.on(
			"editor-change",
			(editor: Editor, info: MarkdownView) => {
				this.onEditorChange(editor, info);
			}
		);
		this.listeners.push(ec);

		const el = this.app.workspace.on("active-leaf-change", async (leaf) => {
			if (leaf){
				if(leaf.view.getViewType() === "markdown") {
					this.plugin.messageService.sendMessage(
						"active-file-changed",
						null
					);
					this.debouncedUpdate();
				}else {
					
					this.isActive = (leaf.view === this)
				}

			}
		});
		this.listeners.push(el);
	}
	stopListen() {
		this.listeners.forEach((e) => this.app.workspace.offref(e));
	}

	onEditorChange(editor: Editor, info: MarkdownView) {
		this.debouncedRender();
	}
	updateElementByID(id: string, html: string): void {
		const item = this.articleDiv.querySelector("#" + id) as HTMLElement;
		if (!item) return;
		const doc = sanitizeHTMLToDom(html);

		item.empty();
		item.appendChild(doc);
		// if (doc.childElementCount > 0) {
		// 	for (const child of doc.children) {
		// 		item.appendChild(child.cloneNode(true));
		// 	}
		// } else {
		// 	item.innerText = $t("views.previewer.article-render-failed");
		// }
	}
	addElementByID(id: string, node: HTMLElement | string): void {
		if (typeof node === "string") {
			this.elementMap.set(id, node);
		} else {
			this.elementMap.set(id, node.cloneNode(true));
		}
	}
	private async loadComponents() {
			const view = this;
			type InternalComponent = Component & {
				_children: Component[];
				onload: () => void | Promise<void>;
			}
	
			const internalView = view as unknown as InternalComponent;
	
			// recursively call onload() on all children, depth-first
			const loadChildren = async (
				component: Component,
				visited: Set<Component> = new Set()
			): Promise<void> => {
				if (visited.has(component)) {
					return;  // Skip if already visited
				}
	
				visited.add(component);
	
				const internalComponent = component as InternalComponent;
	
				if (internalComponent._children?.length) {
					for (const child of internalComponent._children) {
						await loadChildren(child, visited);
					}
				}
				try {
					// relies on the Sheet plugin (advanced-table-xt) not to be minified
					if (component?.constructor?.name === 'SheetElement') {
						await component.onload();
					}
				} catch (error) {
					console.error(`Error calling onload()`, error);
				}
			};
			await loadChildren(internalView);
		}

	// 生成Obsidian主题
	async generateObsidianTheme() {
		try {
			const themeManager = ThemeManager.getInstance(this.plugin);
			const result = await themeManager.saveCurrentObsidianTheme();

			if (result) {
				new Notice(`✅ 已生成Obsidian主题: ${result}`);
				// 刷新主题选择器
				await this.themeSelector.updateThemeOptions();
			} else {
				new Notice("❌ 生成Obsidian主题失败");
			}
		} catch (error) {
			console.error('[WeWrite] 生成Obsidian主题失败:', error);
			new Notice("❌ 生成Obsidian主题时发生错误");
		}
	}

	/**
	 * 🔧 最小侵入性修复：为微信处理高亮问题
	 */
	private fixHighlightForWechat(rootElement: HTMLElement): void {
		console.log('[WeWrite] 🔧 开始为微信修复高亮问题');

		// 1. 多种方式查找高亮元素
		const selectors = [
			'.wewrite-highlight',  // 我们的HighlightRenderer生成的
			'span[style*="var(--highlight-background-color)"]',  // CSS变量
			'span[style*="background-color"]',  // 任何有背景色的span
			'mark'  // 标准mark标签
		];

		let totalFound = 0;

		selectors.forEach((selector, selectorIndex) => {
			const elements = rootElement.querySelectorAll(selector);
			console.log(`[WeWrite] 🔧 选择器 "${selector}" 找到 ${elements.length} 个元素`);

			elements.forEach((element, index) => {
				if (element instanceof HTMLElement) {
					const textContent = element.textContent || '';

					// 🚫 排除标题中的span元素
					const isInHeading = element.closest('h1, h2, h3, h4, h5, h6') !== null;
					if (isInHeading) {
						console.log(`[WeWrite] 🚫 跳过标题中的span: "${textContent}"`);
						return;
					}

					// 🚫 排除标题相关的类名
					const hasHeadingClass = element.classList.contains('wewrite-heading-prefix') ||
											element.classList.contains('wewrite-heading-outbox') ||
											element.classList.contains('wewrite-heading-leaf') ||
											element.classList.contains('wewrite-heading-tail');
					if (hasHeadingClass) {
						console.log(`[WeWrite] 🚫 跳过标题相关的span: "${textContent}"`);
						return;
					}

					console.log(`[WeWrite] 🔧 处理元素 ${selectorIndex}-${index}: "${textContent}"`);
					console.log(`[WeWrite] 🔧 原始样式:`, element.getAttribute('style'));

					// 添加wewrite-highlight类名
					element.classList.add('wewrite-highlight');

					// 设置强制的内联样式（微信兼容）
					const wechatStyle =
						'background-color: rgba(0, 61, 165, 0.08) !important; ' +
						'color: rgb(74, 85, 104) !important; ' +
						'padding: 2px 4px !important; ' +
						'border-radius: 3px !important; ' +
						'display: inline !important; ' +
						'border: none !important; ' +
						'text-decoration: none !important;';

					element.setAttribute('style', wechatStyle);

					console.log(`[WeWrite] 🔧 已修复高亮元素: "${textContent}"`);
					console.log(`[WeWrite] 🔧 新样式:`, element.getAttribute('style'));
					totalFound++;
				}
			});
		});

		console.log(`[WeWrite] 🔧 高亮修复完成，共处理 ${totalFound} 个元素`);
	}

	/**
	 * 替换CSS变量为实际值（微信不支持CSS变量）
	 */
	private replaceCSSVariablesWithActualValues(rootElement: HTMLElement): void {
		// 定义CSS变量映射
		const cssVariableMap = new Map([
			['var(--highlight-background-color)', 'rgba(0, 61, 165, 0.08)'],
			['var(--highlight-background-color, #e3f2fd)', 'rgba(0, 61, 165, 0.08)'],
			['var(--highlight-text-color)', 'rgb(74, 85, 104)'],
			['var(--highlight-text-color, #1565c0)', 'rgb(74, 85, 104)']
		]);

		// 处理所有元素
		const allElements = rootElement.querySelectorAll('*');

		allElements.forEach(element => {
			if (element instanceof HTMLElement) {
				const style = element.getAttribute('style');
				if (style) {
					let newStyle = style;
					let hasReplacement = false;

					cssVariableMap.forEach((actualValue, cssVar) => {
						if (newStyle.includes(cssVar)) {
							newStyle = newStyle.replace(new RegExp(cssVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), actualValue);
							hasReplacement = true;
						}
					});

					if (hasReplacement) {
						element.setAttribute('style', newStyle);
					}
				}
			}
		});
	}

}
