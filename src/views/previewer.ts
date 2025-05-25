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
} from "src/render/post-render";
import { WechatRender } from "src/render/wechat-render";
import { ResourceManager } from "../assets/resource-manager";
import { WechatClient } from "../wechat-api/wechat-client";
import { MPArticleHeader } from "./mp-article-header";
import { ThemeManager } from "../theme/theme-manager";
import { ThemeSelector } from "../theme/theme-selector";
import { WebViewModal } from "./webview";
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
		this.articleTitle = new Setting(mainDiv)
			.setName($t("views.previewer.article-title"))
			.setHeading()
			.addDropdown((dropdown: DropdownComponent) => {
				this.themeSelector.dropdown(dropdown);
			})

			.addExtraButton((button) => {
				button
					.setIcon("refresh-cw")
					.setTooltip($t("views.previewer.render-article"))
					.onClick(async () => {
						this.renderDraft();
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("send-horizontal")
					.setTooltip($t("views.previewer.send-article-to-draft-box"))
					.onClick(async () => {
						if (await this.checkCoverImage()) {
							this.sendArticleToDraftBox();
						} else {
							new Notice(
								$t("views.previewer.please-set-cover-image")
							);
						}
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("clipboard-copy")
					.setTooltip($t("views.previewer.copy-article-to-clipboard"))
					.onClick(async () => {
						const data = this.getArticleContent();
						await navigator.clipboard.write([
							new ClipboardItem({
								"text/html": new Blob([data], {
									type: "text/html",
								}),
							}),
						]);
						new Notice(
							$t("views.previewer.article-copied-to-clipboard")
						);
					});
			});

		this.draftHeader = new MPArticleHeader(this.plugin, mainDiv);

		this.renderDiv = mainDiv.createDiv({ cls: "render-container" });
		this.renderDiv.id = "render-div";
		this.renderPreviewer = mainDiv.createDiv({
			cls: ".wewrite-render-preview",
		})
		this.renderPreviewer.hide()
		let shadowDom = this.renderDiv.shawdowRoot;
		if (shadowDom === undefined || shadowDom === null) {
			shadowDom = this.renderDiv.attachShadow({ mode: 'open' });
			shadowDom.adoptedStyleSheets = [
				ThemeManager.getInstance(this.plugin).getShadowStleSheet()
			];
		}

		this.containerDiv = shadowDom.createDiv({ cls: "wewrite-article" });
		this.articleDiv = this.containerDiv.createDiv({ cls: "article-div" });
	}
	async checkCoverImage() {
		return this.draftHeader.checkCoverImage();
	}
	async sendArticleToDraftBox() {
		await uploadSVGs(this.articleDiv, this.plugin.wechatClient);
		await uploadCanvas(this.articleDiv, this.plugin.wechatClient);
		await uploadURLImage(this.articleDiv, this.plugin.wechatClient);
		await uploadURLVideo(this.articleDiv, this.plugin.wechatClient);

		const media_id = await this.wechatClient.sendArticleToDraftBox(
			this.draftHeader.getActiveLocalDraft()!,
			this.getArticleContent()
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
	}
	public getArticleContent() {
		return this.articleDiv.innerHTML;
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
}
