/**
 * wewrite plugin for Obsidian
 * author: Learner Chen.
 * latest update: 2025-01-24
 */
import {
	debounce,
	Editor,
	EventRef,
	MarkdownView,
	MenuItem,
	Notice,
	Plugin,
	TFile,
	WorkspaceLeaf,
} from "obsidian";
import { getPublicIpAddress } from "src/utils/ip-address";
import { AssetsManager } from "./assets/assets-manager";
import { ResourceManager } from "./assets/resource-manager";
import { $t } from "./lang/i18n";
import { ConfirmModal } from "./modals/confirm-modal";
import { ImageGenerateModal } from "./modals/image-generate-modal";
import { PromptModal } from "./modals/prompt-modal";
import { SynonymsModal } from "./modals/synonyms-modal";
import { WeWriteSettingTab } from "./settings/setting-tab";
import {
	getWeWriteSetting,
	saveWeWriteSetting,
	WeWriteSetting,
	initWeWriteDB
} from "./settings/wewrite-setting";
import { initAssetsDB } from "./assets/assets-manager";
import { initDraftDB } from "./assets/draft-manager";
import { AiClient } from "./utils/ai-client";
import { MessageService } from "./utils/message-service";
import {
	proofreadPlugin,
	proofreadStateField,
	proofreadText,
} from "./utils/proofread";
import { MaterialView, VIEW_TYPE_MP_MATERIAL } from "./views/material-view";
import { PreviewPanel, VIEW_TYPE_WEWRITE_PREVIEW } from "./views/previewer";
import { WechatClient } from "./wechat-api/wechat-client";
import { Spinner } from "./views/spinner";

const DEFAULT_SETTINGS: WeWriteSetting = {
	mpAccounts: [],
	ipAddress: "",
	css_styles_folder: "wewrite-css-styles",
	codeLineNumber: true,
	accountDataPath: "wewrite-accounts",
	useCenterToken: false,
	chatAccounts: [],
	drawAccounts: [],
	realTimeRender: true,
	chatSetting: {
		temperature: 0.7,
		max_tokens: 2048,
		top_p: 1,
		frequency_penalty: 0,
		presence_penalty: 0,
	},
	// 开头结尾模板默认配置
	headerTemplate: {
		enabled: false,
		template: `![]({{headerImage}})

**{{brandName}}** | {{tagline}}

---
`,
		variables: {
			brandName: '',
			tagline: '',
			headerImage: ''
		}
	},
	footerTemplate: {
		enabled: false,
		template: `---

![]({{footerImage}})

**{{callToAction}}**

{{contactInfo}}

*{{currentDate}}*`,
		variables: {
			footerImage: '',
			callToAction: '感谢阅读！',
			contactInfo: '- 🔔 关注我获取更多精彩内容\n- 💬 欢迎留言交流讨论'
		}
	}
};

export default class WeWritePlugin extends Plugin {
	settings: WeWriteSetting;
	wechatClient: WechatClient;
	assetsManager: AssetsManager;
	aiClient: AiClient | null = null;
	private editorChangeListener: EventRef | null = null;
	private imageGenerateModal: ImageGenerateModal | undefined;
	matierialView: MaterialView;
	messageService: MessageService;
	resourceManager = ResourceManager.getInstance(this);
	active: boolean = false;
	spinner: Spinner;

	async saveThemeFolder() {
		const config = {
			custom_theme_folder: this.settings.css_styles_folder,
		};
		await this.saveData(config);
		this.messageService.sendMessage("custom-theme-folder-changed", null);
	}
	async loadThemeFolder() {
		const config = await this.loadData();
		if (config && config.custom_theme_folder) {
			this.settings.css_styles_folder = config.custom_theme_folder;
		}
	}
	// private spinnerEl: HTMLElement;
	// spinnerText: HTMLDivElement;
	trimSettings() {
		this.settings.mpAccounts.forEach((account) => {
			account.accountName = account.accountName.trim();
			account.appId = account.appId.trim();
			account.appSecret = account.appSecret.trim();
		});
		this.settings.chatAccounts.forEach((account) => {
			account.accountName = account.accountName.trim();
			account.baseUrl = account.baseUrl.trim();
			account.apiKey = account.apiKey.trim();
			account.model = account.model.trim();
		});
		this.settings.drawAccounts.forEach((account) => {
			account.accountName = account.accountName.trim();
			account.baseUrl = account.baseUrl.trim();
			account.taskUrl = account.taskUrl.trim();
			account.apiKey = account.apiKey.trim();
			account.model = account.model.trim();
		})
		this.settings.ipAddress = this.settings.ipAddress?.trim();
		this.settings.selectedMPAccount = this.settings.selectedMPAccount?.trim();
		this.settings.selectedChatAccount = this.settings.selectedChatAccount?.trim();
		this.settings.selectedDrawAccount = this.settings.selectedDrawAccount?.trim();
		this.settings.accountDataPath = this.settings.accountDataPath?.trim();
		this.settings.chatSetting.chatSelected = this.settings.chatSetting.chatSelected?.trim();
		this.settings.chatSetting.modelSelected = this.settings.chatSetting.modelSelected?.trim();
		this.settings.css_styles_folder = this.settings.css_styles_folder?.trim();
	}
	saveSettings: Function = debounce(async () => {
		delete this.settings._id;
		delete this.settings._rev;
		this.trimSettings();
		await saveWeWriteSetting(this.settings);
		await this.saveThemeFolder();
	}, 3000);
	saveThemeFolderDebounce: Function = debounce(async () => {
		await this.saveThemeFolder();
	}, 3000);

	// proofService: ProofService;

	getCurrentEditor(): Editor | null {
		const activeLeaf = this.app.workspace.activeLeaf;
		if (!activeLeaf) {
			return null;
		}

		const view = activeLeaf.view;
		if (view?.getViewType() === "markdown") {
			return (view as any).editor;
		}

		return null;
	}
	async addEditorMenu() {
		this.messageService.registerListener(
			"image-generated",
			(url: string) => {
				if (!url) {
					return;
				}
				const editor = this.getCurrentEditor();
				if (!editor) {
					return;
				}
				if (url.startsWith("http")) {
					editor.replaceSelection(`![](${url})`);
				} else {
					editor.replaceSelection(`![[${url}]]`);
				}
			}
		);
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				// @ts-ignore: Obsidian ts defined incomplete.
				let file = editor.editorComponent.file;
				file =
					file instanceof TFile
						? file
						: this.app.workspace.getActiveFile();

				if (!file) {
					return;
				}

				menu.addItem((item) => {
					item.setTitle($t("main.wewrite-ai")).setIcon("sparkles");

					const subMenu = item.setSubmenu();

					if (editor.somethingSelected()) {
						subMenu.addItem((subItem: MenuItem) => {
							subItem
								.setTitle($t("main.polish"))
								.setIcon("sun")
								.onClick(async () => {
									const content = editor.getSelection();

									const polished = await this.polishContent(
										content
									);

									if (polished) {
										editor.replaceSelection(
											polished,
											content
										);
									}
								});
						});

						//  TODO: until stable.
						// subMenu.addItem((subItem: MenuItem) => {
						// 	subItem
						// 		.setTitle($t("main.proof"))
						// 		.setIcon("user-pen")
						// 		.onClick(async () => {
						// 			const content = editor.getSelection();
						// 			const cursorPos = editor.getCursor();
						// 			const cursorOffset =
						// 				editor.posToOffset(cursorPos);

						// 			const proofed = await this.proofContent(
						// 				content
						// 			);

						// 			if (proofed) {
						// 				const suggestions = proofed.map(
						// 					(proofItem) => {
						// 						return {
						// 							...proofItem,
						// 							start:
						// 								proofItem.start +
						// 								cursorOffset,
						// 							end:
						// 								proofItem.end +
						// 								cursorOffset,
						// 						};
						// 					}
						// 				);
						// 				proofreadText(
						// 					editor,
						// 					this.app.workspace.getActiveViewOfType(
						// 						MarkdownView
						// 					)!,
						// 					suggestions
						// 				);
						// 			}
						// 		});
						// });
						subMenu.addItem((subItem: MenuItem) => {
							subItem
								.setTitle($t("main.synonyms"))
								.setIcon("book-a")
								.onClick(async () => {
									const content = editor.getSelection();
									const synonym = await this.getSynonyms(
										content
									);
									this.hideSpinner();

									if (synonym) {
										editor.replaceSelection(
											synonym,
											content
										);
									}
								});
						});
						subMenu.addItem((subItem: MenuItem) => {
							subItem
								.setTitle($t("main.to-english"))
								.setIcon("languages")
								.onClick(async () => {
									const content = editor.getSelection();
									const translated =
										await this.translateToEnglish(content);

									if (translated) {
										editor.replaceSelection(
											translated,
											content
										);
									}
								});
						});
						subMenu.addItem((subItem: MenuItem) => {
							subItem
								.setTitle($t("main.to-chinese"))
								.setIcon("languages")
								.onClick(async () => {
									const content = editor.getSelection();
									const translated =
										await this.translateToChinese(content);

									if (translated) {
										editor.replaceSelection(
											translated,
											content
										);
									}
								});
						});
						subMenu.addItem((subItem: MenuItem) => {
							subItem
								.setTitle($t("main.generate-mermaid"))
								.setIcon("git-compare-arrows")
								.onClick(async () => {
									const content = editor.getSelection();
									const mermaid = await this.generateMermaid(
										content
									);

									if (mermaid) {
										editor.replaceSelection(
											mermaid,
											content
										);
									}
								});
						});
						subMenu.addItem((subItem: MenuItem) => {
							subItem
								.setTitle($t("main.generate-latex"))
								.setIcon("square-radical")
								.onClick(async () => {
									const content = editor.getSelection();
									let latex = await this.generateLaTex(
										content
									);

									if (latex) {
										latex = latex
											.replace(/\\begin{document}/g, "")
											.replace(/\\end{document}/g, "");
										latex = latex.replace(/\\\\/g, "\\");
										editor.replaceSelection(latex, content);
									}
								});
						});
						subMenu.addItem((subItem: MenuItem) => {
							subItem
								.setTitle($t("main.text-to-image"))
								.setIcon("image-plus")
								.onClick(async () => {
									return this.generateImage(editor);
								});
						});
					} else {
						subMenu.addItem((subItem) => {
							subItem
								.setTitle($t("main.polish"))
								.setIcon("user-pen")
								.onClick(async () => {
									const content = await this.app.vault.read(
										file
									);
									const polished = await this.polishContent(
										content
									);
									if (polished) {
										await this.app.vault.modify(
											file,
											polished
										);
									}
								});
						});
						// subMenu.addItem((subItem) => {
						// 	subItem
						// 		.setTitle($t("main.proof"))
						// 		.setIcon("user-round-pen")
						// 		.onClick(async () => {
						// 			// const content = await this.app.vault.read(
						// 			// 	file
						// 			// );
						// 			const content = editor.getValue();
						// 			const proofed = await this.proofContent(
						// 				content
						// 			);

						// 			if (proofed) {
						// 				proofreadText(
						// 					editor,
						// 					this.app.workspace.getActiveViewOfType(
						// 						MarkdownView
						// 					)!,
						// 					proofed
						// 				);
						// 				// this.proofService =
						// 				// 	showProofSuggestions(
						// 				// 		editor,
						// 				// 		proofed
						// 				// 	);
						// 			}
						// 		});
						// });
					}
				});
			})
		);
	}
	showLeftView() {
		this.activateMaterialView();
	}
	pullAllWeChatMPMaterial() {
		if (this.settings.selectedMPAccount === undefined) {
			new Notice($t("main.no-wechat-mp-account-selected"));
			return;
		}
		this.assetsManager.pullAllMaterial(this.settings.selectedMPAccount);
	}
	assetsUpdated() {
		this.messageService.sendMessage("material-updated", null);
	}
	onWeChantMPAccountChange(value: string) {
		if (value === undefined || !value) {
			return;
		}
		this.settings.selectedMPAccount = value;
		this.assetsManager.loadMaterial(value);
	}

	createSpinner() {

		this.spinner = new Spinner(this.addStatusBarItem());
	}
	showSpinner(text: string = "") {
		this.spinner.showSpinner(text);

	}
	isSpinning() {
		return this.spinner.isSpinning();
	}

	hideSpinner() {
		this.spinner.hideSpinner();
	}

	async loadSettings() {
		this.settings = await Object.assign(
			{},
			DEFAULT_SETTINGS,
			await getWeWriteSetting()
		);
		await this.loadThemeFolder();
	}
	async updateIpAddress(): Promise<string> {
		return new Promise((resolve, reject) => {
			getPublicIpAddress().then(async (ip) => {
				if (ip !== undefined && ip) {
					this.settings.ipAddress = ip;
					await this.saveSettings();
					resolve(ip);
				}
			}).catch((error) => {
				console.error("Error fetching public IP address:", error);
				reject("Failed to fetch public IP address: " + error);
			})
		});
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null | undefined = workspace
			.getLeavesOfType(VIEW_TYPE_WEWRITE_PREVIEW)
			.find((leaf) => leaf.view instanceof PreviewPanel);

		if (leaf === undefined || leaf === null) {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({
				type: VIEW_TYPE_WEWRITE_PREVIEW,
				active: true,
			});
		}
		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}
	async activateMaterialView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_MP_MATERIAL);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getLeftLeaf(false);
			await leaf?.setViewState({
				type: VIEW_TYPE_MP_MATERIAL,
				active: true,
			});
		}

		if (leaf) workspace.revealLeaf(leaf);
	}
	async getAccessToken(accountName: string) {
		const account = this.getMPAccountByName(accountName);
		if (account === undefined) {
			new Notice($t("main.no-wechat-mp-account-selected"));
			return false;
		}
		return account.access_token;
	}
	async TestAccessToken(accountName: string) {
		if (this.settings.useCenterToken) {
			return this.wechatClient.requestToken();
		} else {
			const account = this.getMPAccountByName(accountName);
			if (account === undefined) {
				new Notice($t("main.no-wechat-mp-account-selected"));
				return false;
			}
			const token = await this.wechatClient.getAccessToken(
				account.appId,
				account.appSecret
			);
			if (token) {
				this.setAccessToken(
					accountName,
					token.access_token,
					token.expires_in
				);
				return token.access_token;
			}
		}
		return false;
	}
	async refreshAccessToken(accountName: string | undefined) {
		if (this.settings.useCenterToken) {
			return this.wechatClient.requestToken();
		}
		if (accountName === undefined) {
			return false;
		}
		const account = this.getMPAccountByName(accountName);
		if (account === undefined) {
			new Notice($t("main.no-wechat-mp-account-selected"));
			return false;
		}
		const { appId, appSecret } = account;
		if (
			appId === undefined ||
			appSecret === undefined ||
			!appId ||
			!appSecret
		) {
			new Notice($t("main.please-check-you-appid-and-appsecret"));
			return false;
		}
		const {
			access_token: accessToken,
			expires_in: expiresIn,
			lastRefreshTime,
		} = account;
		if (accessToken === undefined || accessToken === "") {
			const token = await this.wechatClient.getAccessToken(
				appId,
				appSecret
			);
			if (token) {
				this.setAccessToken(
					accountName,
					token.access_token,
					token.expires_in
				);
				return token.access_token;
			}
		} else if (
			lastRefreshTime! + expiresIn! * 1000 <
			new Date().getTime()
		) {
			const token = await this.wechatClient.getAccessToken(
				appId,
				appSecret
			);
			if (token) {
				this.setAccessToken(
					accountName,
					token.access_token,
					token.expires_in
				);
				return token.access_token;
			}
		} else {
			return accessToken;
		}
		return false;
	}
	getMPAccountByName(accountName: string | undefined) {
		return this.settings.mpAccounts.find(
			(account) => account.accountName === accountName
		);
	}
	public getChatAIAccount(accountName: string | undefined = undefined) {
		if (accountName === undefined) {
			accountName = this.settings.selectedChatAccount;
		}
		return this.settings.chatAccounts.find(
			(account) => account.accountName === accountName
		);
	}
	public getDrawAIAccount(accountName: string | undefined = undefined) {
		if (accountName === undefined) {
			accountName = this.settings.selectedDrawAccount;
		}
		return this.settings.drawAccounts.find(
			(account) =>
				account.accountName === this.settings.selectedDrawAccount
		);
	}
	getSelectedMPAccount() {
		return this.getMPAccountByName(this.settings.selectedMPAccount);
	}
	setAccessToken(
		accountName: string,
		accessToken: string,
		expires_in: number
	) {
		const account = this.getMPAccountByName(accountName);
		if (account === undefined) {
			return;
		}
		account.access_token = accessToken;
		account.lastRefreshTime = new Date().getTime();
		account.expires_in = expires_in;
		this.saveSettings();
	}
	findImageMediaId(url: string) {
		return this.assetsManager.findMediaIdOfUrl("image", url);
	}

	async generateSummary(content: string): Promise<string | null> {
		if (!this.aiClient) {
			new Notice($t("main.chat-llm-has-not-been-configured"));
			return null;
		}
		try {
			this.showSpinner("summarizing...");
			const result = await this.aiClient.generateSummary(content);
			this.hideSpinner();
			return result;
		} catch (error) {
			console.error("Error showing spinner:", error);
		} finally {
			this.hideSpinner();
		}
		return null;
	}
	async translateToEnglish(content: string): Promise<string | null> {
		if (!this.aiClient) {
			new Notice($t("main.chat-llm-has-not-been-configured"));
			return null;
		}
		try {
			this.showSpinner($t("main.translating-to-english"));
			const result = await this.aiClient.translateText(
				content,
				"Chinese",
				"English"
			);
			this.hideSpinner();
			return result;
		} catch (error) {
			console.error("Error showing spinner:", error);
		} finally {
			this.hideSpinner();
		}
		return null;
	}
	async translateToChinese(content: string): Promise<string | null> {
		if (!this.aiClient) {
			new Notice($t("main.chat-llm-has-not-been-configured"));
			return null;
		}
		try {
			this.showSpinner($t("main.translating-to-chinese"));
			const result = await this.aiClient.translateText(content);
			this.hideSpinner();
			return result;
		} catch (error) {
			console.error("Error showing spinner:", error);
		} finally {
			this.hideSpinner();
		}
		return null;
	}
	async getSynonyms(content: string): Promise<string | null> {
		if (!this.aiClient) {
			new Notice($t("main.chat-llm-has-not-been-configured"));
			return null;
		}
		try {
			this.showSpinner($t("main.get-synonyms"));
			const result = await this.aiClient.synonym(content);
			this.hideSpinner();
			if (result) {
				const synonyms = result.map((s) => s.replace(/^\d+\.\s*/, ""));
				const selectedWord = await new Promise<string | null>(
					(resolve) => {
						new SynonymsModal(this.app, synonyms, resolve).open();
					}
				);
				return selectedWord ? selectedWord : null;
			}
			return null;
		} catch (error) {
			console.error("Error showing spinner:", error);
		} finally {
			this.hideSpinner();
		}
		return null;
	}
	async generateMermaid(content: string): Promise<string | null> {
		if (!this.aiClient) {
			new Notice($t("main.chat-llm-has-not-been-configured"));
			return null;
		}
		try {
			this.showSpinner($t("main.generating-mermaid"));
			const result = await this.aiClient.generateMermaid(content);
			if (result) {
				const mermaidMatch = result.match(
					/```mermaid\n([\s\S]*?)\n```/
				);
				if (mermaidMatch && mermaidMatch[1]) {
					return `\n\`\`\`mermaid\n${mermaidMatch[1].trim()}\n\`\`\`\n`;
				}
				return result;
			}
			return null;
		} catch (error) {
			console.error("Error generating mermaid:", error);
		} finally {
			this.hideSpinner();
		}
		return null;
	}
	async generateLaTex(content: string): Promise<string | null> {
		if (!this.aiClient) {
			new Notice($t("main.chat-llm-has-not-been-configured"));
			return null;
		}
		try {
			this.showSpinner($t("main.generating-latex"));
			const result = await this.aiClient.generateLaTeX(content);
			if (result) {
				const latexMatch = result.match(/\$\$([\s\S]*?)\$\$/);
				if (latexMatch && latexMatch[0]) {
					return latexMatch[0].trim();
				}
				const codeBlockMatch = result.match(
					/```latex\n([\s\S]*?)\n```/
				);
				if (codeBlockMatch && codeBlockMatch[1]) {
					const innerLatexMatch =
						codeBlockMatch[1].match(/\$\$([\s\S]*?)\$\$/);
					if (innerLatexMatch && innerLatexMatch[0]) {
						return innerLatexMatch[0].trim();
					}
					return `$$${codeBlockMatch[1].trim()}$$`;
				}
				return result;
			}
			return null;
		} catch (error) {
			console.error("Error generating LaTeX:", error);
		} finally {
			this.hideSpinner();
		}
		return null;
	}

	async proofContent(content: string): Promise<any[] | null> {
		if (!this.aiClient) {
			new Notice($t("main.chat-llm-has-not-been-configured"));
			return null;
		}
		try {
			this.showSpinner($t("main.proofing"));
			const result = await this.aiClient.proofContent(content);
			if (result) {
				return result.corrections;
			}
		} catch (error) {
			console.error("Error showing spinner:", error);
		} finally {
			this.hideSpinner();
		}
		return null;
	}

	async polishContent(content: string): Promise<string | null> {
		if (!this.aiClient) {
			new Notice($t("main.chat-llm-has-not-been-configured"));
			return null;
		}
		this.showSpinner($t("main.polishing"));
		const result = await this.aiClient.polishContent(content);
		this.hideSpinner();
		if (result) {
			return result.polished;
		}
		return null;
	}
	async generateImage(editor: Editor) {
		if (!this.aiClient) {
			new Notice($t("main.chat-llm-has-not-been-configured"));
			return null;
		}
		if (this.imageGenerateModal === undefined) {
			this.imageGenerateModal = new ImageGenerateModal(
				this,
				async (url: string) => {
					//save it to local folder.
					if (url === undefined || url === null || url === "") {
						new Notice($t("main.image-generation-failed"));
					}
					const fullPath = await ResourceManager.getInstance(
						this
					).saveImageFromUrl(url);

					this.messageService.sendMessage(
						"image-generated",
						fullPath ? fullPath : url
					);
				}
			);
		}
		this.imageGenerateModal.prompt = editor.getSelection();
		this.imageGenerateModal.size = "1024*768";
		this.imageGenerateModal.open();
	}

	async prompt(
		message: string,
		defaultValue?: string
	): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new PromptModal(
				this.app,
				message,
				defaultValue,
				resolve
			);
			modal.open();
		});
	}

	async confirm(message: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmModal(this.app, message, resolve);
			modal.open();
		});
	}
	initDB() {
		initWeWriteDB();
		initAssetsDB();
		initDraftDB();
	}
	async onload() {
		try {
			console.log('[WeWrite] Starting plugin load...');

			// 检查移动端环境
			const isMobile = (this.app as any).isMobile || false;
			console.log(`[WeWrite] Environment: ${isMobile ? 'Mobile' : 'Desktop'}`);

			// 移动端特殊处理
			if (isMobile) {
				console.log('[WeWrite] Applying mobile-specific configurations...');
				// 添加移动端特定的错误处理
				window.addEventListener('error', (event) => {
					console.error('[WeWrite Mobile] Global error:', event.error);
				});

				window.addEventListener('unhandledrejection', (event) => {
					console.error('[WeWrite Mobile] Unhandled promise rejection:', event.reason);
				});
			}

			this.initDB();
			console.log('[WeWrite] Database initialized');

			this.messageService = new MessageService();
			console.log('[WeWrite] Message service initialized');

			await this.loadSettings();
			console.log('[WeWrite] Settings loaded');

			// 移动端可能需要延迟初始化某些服务
			if (isMobile) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}

			this.wechatClient = WechatClient.getInstance(this);
			console.log('[WeWrite] WeChat client initialized');

			this.assetsManager = await AssetsManager.getInstance(this.app, this);
			console.log('[WeWrite] Assets manager initialized');

			this.aiClient = AiClient.getInstance(this);
			console.log('[WeWrite] AI client initialized');

			this.registerViews();
			console.log('[WeWrite] Views registered');

		this.addCommand({
			id: "open-previewer",
			name: $t("main.open-previewer"),
			callback: () => this.activateView(),
		});
		this.addCommand({
			id: "open-material-view",
			name: $t("main.open-material-view"),
			callback: () => this.activateMaterialView(),
		});

		this.addRibbonIcon("pen-tool", "WeWrite", () => {
			this.activateView();
		});

		this.addSettingTab(new WeWriteSettingTab(this.app, this));

		this.addEditorMenu();
		this.createSpinner();

		// -- proofread
		// this.registerEditorExtension([proofreadStateField, proofreadPlugin]);

		// this.addCommand({
		// 	id: "proofread-text",
		// 	name: "校对文本",
		// 	editorCallback: async (editor: Editor, view: MarkdownView) => {
		// 		await proofreadText(editor, view);
		// 	},
		// });
		this.messageService.registerListener('show-spinner', (msg: string) => {
			this.showSpinner(msg);
		})
		this.messageService.registerListener('hide-spinner', () => {
			this.hideSpinner();
		})

		console.log('[WeWrite] Plugin loaded successfully');

		} catch (error) {
			console.error('[WeWrite] Plugin load failed:', error);
			console.error('[WeWrite] Error stack:', error.stack);

			// 在移动端显示更友好的错误信息
			const isMobile = (this.app as any).isMobile || false;
			if (isMobile) {
				new Notice(`WeWrite插件加载失败: ${error.message}`, 10000);
			} else {
				new Notice(`WeWrite plugin failed to load: ${error.message}`, 10000);
			}

			// 重新抛出错误以便Obsidian知道插件加载失败
			throw error;
		}
	}
	registerViewOnce(viewType: string) {
		if (this.app.workspace.getLeavesOfType(viewType).length === 0) {
			if (viewType === VIEW_TYPE_WEWRITE_PREVIEW) {
				
				this.registerView(viewType, (leaf) => new PreviewPanel(leaf, this))
			}else if (viewType === VIEW_TYPE_MP_MATERIAL) {
				this.registerView(viewType, (leaf) => new MaterialView(leaf, this))
			}
		}
	}
	registerViews() {
		this.registerViewOnce(VIEW_TYPE_WEWRITE_PREVIEW);
		this.registerViewOnce(VIEW_TYPE_MP_MATERIAL);
	}

	onunload() {
		if (this.editorChangeListener) {
			this.app.workspace.offref(this.editorChangeListener);
		}
		// this.spinnerEl.remove();
		this.spinner.unload();
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof PreviewPanel) {
				leaf.detach();
			}
			if (leaf.view instanceof MaterialView) {
				leaf.detach();
			}
		});
		this.app.workspace.getLeavesOfType(VIEW_TYPE_WEWRITE_PREVIEW).forEach((leaf) => leaf.detach());
		this.app.workspace.getLeavesOfType(VIEW_TYPE_MP_MATERIAL).forEach((leaf) => leaf.detach());
	}




}
