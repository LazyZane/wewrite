/** process custom theme content */
import matter from "gray-matter";
import { CachedMetadata, Notice, TFile, TFolder, requestUrl } from "obsidian";
import postcss from "postcss";
// import { combinedCss } from "src/assets/css/template-css";
import { $t } from "src/lang/i18n";
import WeWritePlugin from "src/main";
import { CSSMerger } from "./CssMerger";

export type WeChatTheme = {
	name: string;
	path: string;
	content?: string;

}
export class ThemeManager {
	async downloadThemes() {
		const baseUrlAlter = "https://gitee.com/northern_bank/wewrite/raw/master/themes/";
		const baseUrl = "https://raw.githubusercontent.com/learnerchen-forever/wewrite/refs/heads/master/themes/";
		const saveDir = this.plugin.settings.css_styles_folder || "/wewrite-custom-css";

		// Create save directory if it doesn't exist
		if (!this.plugin.app.vault.getAbstractFileByPath(saveDir)) {
			await this.plugin.app.vault.createFolder(saveDir);

		} else {
		}

		// Check if github is reachable, if not, use gitee
		let url = baseUrl;
		requestUrl(`${baseUrl}themes.json`).then((response) => {
			if (response.status === 200) {
				// The URL is valid, use it
				url = baseUrl;
				console.log(`Using GitHub URL: ${url}`);
			} else {
				// The URL is not valid, use the alternative URL
				console.log(`status error, Using Gitee URL: ${baseUrlAlter}`);
				url = baseUrlAlter;
			}
		}).catch((error) => {
			// The URL is not valid, use the alternative URL
			console.log(`exception, Using Gitee URL: ${baseUrlAlter}`);
			url = baseUrlAlter;
		});


		try {
			// Download themes.json
			const themesResponse = await requestUrl(`${url}themes.json`);
			if (themesResponse.status !== 200) {
				throw new Error($t('views.theme-manager.failed-to-fetch-themes-json-themesrespon', [themesResponse.text]));
			}

			const themesData = themesResponse.json;
			const themes = themesData.themes;

			// Download each theme file
			for (const theme of themes) {
				try {


					const fileResponse = await requestUrl(`${url}${theme.file}`);
					if (fileResponse.status !== 200) {
						console.warn(`Failed to download ${theme.file}: ${fileResponse.text}`);
						continue;
					}

					const fileContent = fileResponse.text;
					// Generate unique file name
					let filePath = `${saveDir}/${theme.file}`;
					let counter = 1;

					while (this.plugin.app.vault.getAbstractFileByPath(filePath)) {
						const extIndex = theme.file.lastIndexOf('.');
						const baseName = extIndex > 0 ? theme.file.slice(0, extIndex) : theme.file;
						const ext = extIndex > 0 ? theme.file.slice(extIndex) : '';
						filePath = `${saveDir}/${baseName}(${counter})${ext}`;
						counter++;
					}

					await this.plugin.app.vault.create(filePath, fileContent);
				} catch (error) {
					console.error(error);
					new Notice($t('views.theme-manager.error-downloading-theme') + error.message);
					continue;
				}
			}
			new Notice($t('views.theme-manager.total-themes-length-themes-downloaded', [themes.length]))
		} catch (error) {
			console.error("Error downloading themes:", error);
			new Notice($t('views.theme-manager.error-downloading-themes'));
		}
	}
	private plugin: WeWritePlugin;
	defaultCssRoot: postcss.Root;
	themes: WeChatTheme[] = [];
	// static template_css: string = combinedCss;

	private constructor(plugin: WeWritePlugin) {
		this.plugin = plugin;

	}
	static getInstance(plugin: WeWritePlugin): ThemeManager {
		return new ThemeManager(plugin);

	}

	async loadThemes() {
		this.themes = [];
		const folder_path = this.plugin.settings.css_styles_folder;
		const folder = this.plugin.app.vault.getAbstractFileByPath(folder_path);
		if (folder instanceof TFolder) {
			this.themes = await this.getAllThemesInFolder(folder);
		}
		return this.themes;
	}
	public cleanCSS(css: string): string {

		css = css.replace(/```[cC][Ss]{2}\s*|\s*```/g, '').trim()
		const reg_multiple_line_comments = /\/\*[\s\S]*?\*\//g;
		const reg_single_line_comments = /\/\/.*/g;
		const reg_whitespace = /\s+/g;
		const reg_invisible_chars = /[\u200B\u00AD\uFEFF\u00A0]/g;

		let cleanedCSS = css
			.replace(reg_multiple_line_comments, '')
			.replace(reg_single_line_comments, '')
			.replace(reg_whitespace, ' ')
			.replace(reg_invisible_chars, '');

		return cleanedCSS.trim();
	}
	private async extractCSSblocks(path: string) {
		const result: string[] = []
		const file = this.plugin.app.vault.getFileByPath(path);
		if (!file) {
			return ''
		}
		const cache: CachedMetadata | null = this.plugin.app.metadataCache.getFileCache(file);
		if (!cache?.sections) return ''
		const content = await this.plugin.app.vault.read(file);

		for (const section of cache.sections) {
			if (section.type === "code" ) {
				const rawBlock = content.substring(
					section.position.start.offset,
					section.position.end.offset
				);
				if  (!/^```css/i.test(rawBlock)) continue;
				// const cleaned = rawBlock.replace(/^```css\s*/, "").replace(/```$/, "").trim();
				const first = rawBlock.indexOf('\n');
				const last = rawBlock.lastIndexOf('\n');
				const cleaned = rawBlock.substring(first + 1, last).trim();
				result.push(cleaned);
			}
		}
		// console.log('result=>', result);
		
		return result.join('\n')

	}
	public async getThemeContent(path: string) {
		const file = this.plugin.app.vault.getFileByPath(path);
		if (!file) {
			// return ThemeManager.template_css; //DEFAULT_STYLE;
			return ''
		}
		const fileContent = await this.plugin.app.vault.cachedRead(file);

		const reg_css_block = /```[cC][Ss]{2}\s*([\s\S]+?)\s*```/gs;
		// const reg_css_block = /```css\s*([\s\S]*?)```/g

		const cssBlocks: string[] = [];
		let match
		while ((match = reg_css_block.exec(fileContent)) !== null) {
			cssBlocks.push(this.cleanCSS(match[1].trim()));
		}
		console.log('cssBlocks=>', cssBlocks);

		return cssBlocks.join('\n');

	}
	public async getCSS() {
		let custom_css = '' //this.defaultCssRoot.toString() //''
		if (this.plugin.settings.custom_theme === undefined || !this.plugin.settings.custom_theme) {

		} else {
			// custom_css = await this.getThemeContent(this.plugin.settings.custom_theme)
			custom_css = await this.extractCSSblocks(this.plugin.settings.custom_theme)
		}

		return custom_css

	}
	public getShadowStleSheet() {
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(`
  /* 滚动条样式 we use shadow dom, make the preview looks better.*/
.table-container::-webkit-scrollbar {
	width: 8px;
	height: 8px;
	background-color: var(--scrollbar-bg);
}

.table-container::-webkit-scrollbar-thumb {
	background-color: var(--scrollbar-thumb-bg);
    -webkit-border-radius: var(--radius-l);
    background-clip: padding-box;
    border: 2px solid transparent;
    border-width: 3px 3px 3px 2px;
    min-height: 45px;
}
.table-container::-webkit-scrollbar-thumb:hover {
	background-color: var(--scrollbar-thumb-hover-bg);
}

.wewrite-article::-webkit-scrollbar-corner{
	background: transparent;
}

.wewrite-article pre::-webkit-scrollbar {
	width: 8px;
	height: 8px;
	background-color: var(--scrollbar-bg);
}

.wewrite-article pre::-webkit-scrollbar-thumb {
	background-color: var(--scrollbar-thumb-bg);
    -webkit-border-radius: var(--radius-l);
    background-clip: padding-box;
    border: 2px solid transparent;
    border-width: 3px 3px 3px 2px;
    min-height: 45px;
}

.wewrite-article pre::-webkit-scrollbar-thumb:hover {
	background-color: var(--scrollbar-thumb-hover-bg);
}

.wewrite-article::-webkit-scrollbar-corner{
	background: transparent;
}
`);

		return sheet

	}

	public getShadowStyleText(): string {
		return `
  /* 滚动条样式 we use shadow dom, make the preview looks better.*/
.table-container::-webkit-scrollbar {
	width: 8px;
	height: 8px;
	background-color: var(--scrollbar-bg);
}

.table-container::-webkit-scrollbar-thumb {
	background-color: var(--scrollbar-thumb-bg);
    -webkit-border-radius: var(--radius-l);
    background-clip: padding-box;
    border: 2px solid transparent;
    border-width: 3px 3px 3px 2px;
    min-height: 45px;
}
.table-container::-webkit-scrollbar-thumb:hover {
	background-color: var(--scrollbar-thumb-hover-bg);
}

.wewrite-article::-webkit-scrollbar-corner{
	background: transparent;
}

.wewrite-article pre::-webkit-scrollbar {
	width: 8px;
	height: 8px;
	background-color: var(--scrollbar-bg);
}

.wewrite-article pre::-webkit-scrollbar-thumb {
	background-color: var(--scrollbar-thumb-bg);
    -webkit-border-radius: var(--radius-l);
    background-clip: padding-box;
    border: 2px solid transparent;
    border-width: 3px 3px 3px 2px;
    min-height: 45px;
}

.wewrite-article pre::-webkit-scrollbar-thumb:hover {
	background-color: var(--scrollbar-thumb-hover-bg);
}

.wewrite-article::-webkit-scrollbar-corner{
	background: transparent;
}
`;
	}
	private async getAllThemesInFolder(folder: TFolder): Promise<WeChatTheme[]> {
		const themes: WeChatTheme[] = [];

		const getAllFiles = async (folder: TFolder) => {
			const promises = folder.children.map(async (child) => {
				if (child instanceof TFile && child.extension === "md") {
					const theme = await this.getThemeProperties(child);
					if (theme) {
						themes.push(theme);
					}
				} else if (child instanceof TFolder) {
					await getAllFiles(child);
				}
			});

			await Promise.all(promises);
		};

		await getAllFiles(folder);

		return themes;
	}

	private async getThemeProperties(file: TFile): Promise<WeChatTheme | undefined> {
		const fileContent = await this.plugin.app.vault.cachedRead(file);
		const { data } = matter(fileContent); // 解析前置元数据
		if (data.theme_name === undefined || !data.theme_name.trim()) {
			// it is not a valid theme.
			return;
		}

		return {
			name: data.theme_name,
			path: file.path,
		};
	}

	public async applyTheme(htmlRoot: HTMLElement) {
		const customCss = await this.getCSS()
		const cssMerger = new CSSMerger()
		await cssMerger.init(customCss)
		const node = cssMerger.applyStyleToElement(htmlRoot)
		cssMerger.removeClassName(node)
		return node

	}

	// 保存当前Obsidian主题为WeWrite主题文件
	public async saveCurrentObsidianTheme(): Promise<string | null> {
		try {
			// 获取当前Obsidian主题名称
			const currentThemeName = this.getCurrentObsidianThemeName();

			// 生成主题文件名
			const fileName = `obsidian-${currentThemeName.toLowerCase().replace(/\s+/g, '-')}.md`;
			const filePath = `${this.plugin.settings.css_styles_folder}/${fileName}`;

			// 提取当前主题的颜色
			const extractedColors = await this.extractObsidianColors();

			// 生成主题文件内容
			const themeContent = this.generateThemeFileContent(currentThemeName, extractedColors);

			// 保存文件
			await this.plugin.app.vault.adapter.write(filePath, themeContent);

			console.log(`[WeWrite] 已生成Obsidian主题文件: ${filePath}`);
			return fileName;
		} catch (error) {
			console.error('[WeWrite] 保存Obsidian主题失败:', error);
			return null;
		}
	}

	// 获取当前Obsidian主题名称
	private getCurrentObsidianThemeName(): string {
		// 尝试从body的class中获取主题信息
		const bodyClasses = document.body.className;
		console.log('[WeWrite] Body classes:', bodyClasses);

		// 检查是否为深色主题
		const isDark = bodyClasses.includes('theme-dark');

		// 尝试获取具体主题名称（这里先用简单的检测）
		if (bodyClasses.includes('underwater')) {
			return 'Underwater';
		}

		// 默认返回基于明暗的主题名称
		return isDark ? 'Dark' : 'Light';
	}

	// 提取Obsidian主题颜色 - 使用完整CSS变量提取法
	private async extractObsidianColors(): Promise<Record<string, string>> {
		console.log('[WeWrite] 开始提取Obsidian主题颜色...');

		const extractedColors: Record<string, string> = {};

		// 方法1: 直接提取CSS变量
		const cssVariables = this.extractCSSVariables();
		Object.assign(extractedColors, cssVariables);

		// 方法2: 元素检测法作为补充
		const elementColors = await this.extractColorsFromElements();
		Object.assign(extractedColors, elementColors);

		console.log('[WeWrite] 提取到的颜色变量:', extractedColors);
		return extractedColors;
	}

	// 提取所有相关的CSS变量
	private extractCSSVariables(): Record<string, string> {
		const computedStyle = getComputedStyle(document.documentElement);
		const extractedValues: Record<string, string> = {};

		// 基础颜色变量
		const baseColorVars = [
			'--background-primary',
			'--background-secondary',
			'--background-primary-alt',
			'--background-secondary-alt',
			'--text-normal',
			'--text-muted',
			'--text-faint',
			'--text-accent',
			'--text-accent-hover',
			'--interactive-accent',
			'--interactive-accent-hover',
			'--border-color',
			'--divider-color'
		];

		// 代码块相关变量
		const codeVars = [
			'--code-background',
			'--code-normal',
			'--code-size',
			'--code-comment',
			'--code-function',
			'--code-important',
			'--code-keyword',
			'--code-property',
			'--code-punctuation',
			'--code-string',
			'--code-tag',
			'--code-value'
		];

		// 基础颜色调色板
		const colorPaletteVars = [
			'--color-red',
			'--color-orange',
			'--color-yellow',
			'--color-green',
			'--color-cyan',
			'--color-blue',
			'--color-purple',
			'--color-pink'
		];

		// 链接和标签相关
		const linkTagVars = [
			'--link-color',
			'--link-color-hover',
			'--link-external-color',
			'--tag-color',
			'--tag-background'
		];

		// 高亮文本相关变量
		const highlightVars = [
			'--text-highlight-bg',
			'--text-highlight',
			'--text-highlight-color',
			'--highlight-background',
			'--highlight-color',
			'--mark-background',
			'--mark-color'
		];

		// 标题层级相关变量
		const headingVars = [
			'--h1-color',
			'--h2-color',
			'--h3-color',
			'--h4-color',
			'--h5-color',
			'--h6-color',
			'--h1-size',
			'--h2-size',
			'--h3-size',
			'--h4-size',
			'--h5-size',
			'--h6-size',
			'--h1-weight',
			'--h2-weight',
			'--h3-weight',
			'--h4-weight',
			'--h5-weight',
			'--h6-weight'
		];

		// 合并所有变量
		const allVars = [...baseColorVars, ...codeVars, ...colorPaletteVars, ...linkTagVars, ...highlightVars, ...headingVars];

		// 提取变量值
		allVars.forEach(varName => {
			const value = computedStyle.getPropertyValue(varName).trim();
			if (value && value !== 'initial' && value !== 'inherit' && value !== '') {
				extractedValues[varName.replace('--', '')] = value;
			}
		});

		console.log('[WeWrite] CSS变量提取结果:', extractedValues);
		return extractedValues;
	}

	// 元素检测法作为补充
	private async extractColorsFromElements(): Promise<Record<string, string>> {
		const testElements = this.createTestElements();

		try {
			const extractedColors: Record<string, string> = {};

			// 提取工作区颜色
			const workspaceStyle = getComputedStyle(testElements.workspace);
			if (!extractedColors['background-primary']) {
				extractedColors['background-primary'] = workspaceStyle.backgroundColor;
			}
			if (!extractedColors['text-normal']) {
				extractedColors['text-normal'] = workspaceStyle.color;
			}

			// 提取链接颜色
			const linkStyle = getComputedStyle(testElements.link);
			if (!extractedColors['link-color']) {
				extractedColors['link-color'] = linkStyle.color;
			}

			// 提取代码块颜色
			const codeStyle = getComputedStyle(testElements.code);
			if (!extractedColors['code-background']) {
				extractedColors['code-background'] = codeStyle.backgroundColor;
			}
			if (!extractedColors['code-normal']) {
				extractedColors['code-normal'] = codeStyle.color;
			}

			// 提取加粗文本颜色
			const strongStyle = getComputedStyle(testElements.strong);
			if (!extractedColors['strong-color']) {
				extractedColors['strong-color'] = strongStyle.color;
				console.log('[WeWrite] 提取到加粗文本颜色:', strongStyle.color);
			}

			// 提取高亮文本颜色 - 多种方式尝试
			const markStyle = getComputedStyle(testElements.mark);
			const previewMarkStyle = getComputedStyle(testElements.previewMark);
			const standardMarkStyle = getComputedStyle(testElements.standardMark);
			const spanHighlightStyle = getComputedStyle(testElements.spanHighlight);

			// 优先使用Obsidian的cm-highlight样式
			let highlightBg = markStyle.backgroundColor;
			let highlightColor = markStyle.color;

			console.log('[WeWrite] 高亮样式提取:');
			console.log('  cm-highlight:', { bg: markStyle.backgroundColor, color: markStyle.color });
			console.log('  preview highlight:', { bg: previewMarkStyle.backgroundColor, color: previewMarkStyle.color });
			console.log('  standard mark:', { bg: standardMarkStyle.backgroundColor, color: standardMarkStyle.color });
			console.log('  span highlight:', { bg: spanHighlightStyle.backgroundColor, color: spanHighlightStyle.color });

			// 如果cm-highlight没有有效颜色，尝试预览模式的高亮
			if (!highlightBg || highlightBg === 'rgba(0, 0, 0, 0)' || highlightBg === 'transparent') {
				highlightBg = previewMarkStyle.backgroundColor;
			}
			if (!highlightColor || highlightColor === 'rgba(0, 0, 0, 0)' || highlightColor === 'transparent') {
				highlightColor = previewMarkStyle.color;
			}

			// 如果预览模式也没有，使用标准mark元素
			if (!highlightBg || highlightBg === 'rgba(0, 0, 0, 0)' || highlightBg === 'transparent') {
				highlightBg = standardMarkStyle.backgroundColor;
			}
			if (!highlightColor || highlightColor === 'rgba(0, 0, 0, 0)' || highlightColor === 'transparent') {
				highlightColor = standardMarkStyle.color;
			}

			// 尝试从CSS变量中获取
			const computedStyle = getComputedStyle(document.documentElement);
			const obsidianHighlightBg = computedStyle.getPropertyValue('--text-highlight-bg').trim();
			const obsidianHighlightColor = computedStyle.getPropertyValue('--text-highlight').trim();
			const obsidianHighlightBg2 = computedStyle.getPropertyValue('--text-highlight-bg-active').trim();
			const obsidianMarkBg = computedStyle.getPropertyValue('--text-mark-bg').trim();

			console.log('[WeWrite] CSS变量提取:');
			console.log('  --text-highlight-bg:', obsidianHighlightBg);
			console.log('  --text-highlight:', obsidianHighlightColor);
			console.log('  --text-highlight-bg-active:', obsidianHighlightBg2);
			console.log('  --text-mark-bg:', obsidianMarkBg);

			if (obsidianHighlightBg && obsidianHighlightBg !== '') {
				highlightBg = obsidianHighlightBg;
			} else if (obsidianHighlightBg2 && obsidianHighlightBg2 !== '') {
				highlightBg = obsidianHighlightBg2;
			} else if (obsidianMarkBg && obsidianMarkBg !== '') {
				highlightBg = obsidianMarkBg;
			}

			if (obsidianHighlightColor && obsidianHighlightColor !== '') {
				highlightColor = obsidianHighlightColor;
			}

			if (!extractedColors['highlight-background-color']) {
				extractedColors['highlight-background-color'] = highlightBg;
				console.log('[WeWrite] 提取到高亮背景颜色:', highlightBg);
			}
			if (!extractedColors['highlight-text-color']) {
				extractedColors['highlight-text-color'] = highlightColor;
				console.log('[WeWrite] 提取到高亮文本颜色:', highlightColor);
			}

			// 提取标题样式
			for (let i = 1; i <= 6; i++) {
				const headingElement = testElements[`h${i}`];
				if (headingElement) {
					const headingStyle = getComputedStyle(headingElement);
					const colorKey = `h${i}-color`;
					const sizeKey = `h${i}-size`;
					const weightKey = `h${i}-weight`;

					if (!extractedColors[colorKey]) {
						extractedColors[colorKey] = headingStyle.color;
					}
					if (!extractedColors[sizeKey]) {
						extractedColors[sizeKey] = headingStyle.fontSize;
					}
					if (!extractedColors[weightKey]) {
						extractedColors[weightKey] = headingStyle.fontWeight;
					}
				}
			}

			console.log('[WeWrite] 元素检测补充结果:', extractedColors);
			return extractedColors;
		} finally {
			this.cleanupTestElements(testElements);
		}
	}

	// 创建测试元素
	private createTestElements(): Record<string, HTMLElement> {
		const testContainer = document.createElement('div');
		testContainer.style.position = 'absolute';
		testContainer.style.top = '-9999px';
		testContainer.style.left = '-9999px';
		testContainer.style.visibility = 'hidden';

		// 添加Obsidian的主要容器类名，确保能继承主题样式
		testContainer.className = 'app-container';

		// 创建markdown预览容器
		const markdownContainer = document.createElement('div');
		markdownContainer.className = 'markdown-preview-view markdown-rendered';

		// 创建工作区元素
		const workspaceElement = document.createElement('div');
		workspaceElement.className = 'workspace-leaf-content';

		// 创建链接元素
		const linkElement = document.createElement('a');
		linkElement.className = 'internal-link';
		linkElement.textContent = 'test link';

		// 创建代码元素
		const codeElement = document.createElement('code');
		codeElement.textContent = 'test code';

		// 创建加粗文本元素
		const strongElement = document.createElement('strong');
		strongElement.textContent = 'test bold text';

		// 创建高亮文本元素 - 使用多种Obsidian的高亮类名
		const markElement = document.createElement('mark');
		markElement.className = 'cm-highlight'; // Obsidian编辑器的高亮类名
		markElement.textContent = 'test highlight text';

		// 创建Obsidian预览模式的高亮元素
		const previewMarkElement = document.createElement('mark');
		previewMarkElement.className = 'highlight'; // Obsidian预览模式的高亮类名
		previewMarkElement.textContent = 'preview highlight text';

		// 也创建一个标准的mark元素作为备选
		const standardMarkElement = document.createElement('mark');
		standardMarkElement.textContent = 'standard highlight text';

		// 创建span高亮元素（WeWrite使用的格式）
		const spanHighlightElement = document.createElement('span');
		spanHighlightElement.className = 'wewrite-highlight';
		spanHighlightElement.textContent = 'wewrite highlight text';

		// 创建标题元素 - 放在markdown容器中
		const headingElements: Record<string, HTMLElement> = {};
		for (let i = 1; i <= 6; i++) {
			const heading = document.createElement(`h${i}`);
			heading.textContent = `Heading ${i}`;
			headingElements[`h${i}`] = heading;
			markdownContainer.appendChild(heading);
		}

		// 组装DOM结构
		markdownContainer.appendChild(workspaceElement);
		markdownContainer.appendChild(linkElement);
		markdownContainer.appendChild(codeElement);
		markdownContainer.appendChild(strongElement);
		markdownContainer.appendChild(markElement);
		markdownContainer.appendChild(previewMarkElement);
		markdownContainer.appendChild(standardMarkElement);
		markdownContainer.appendChild(spanHighlightElement);
		testContainer.appendChild(markdownContainer);
		document.body.appendChild(testContainer);

		return {
			container: testContainer,
			workspace: workspaceElement,
			link: linkElement,
			code: codeElement,
			strong: strongElement,
			mark: markElement,
			previewMark: previewMarkElement,
			standardMark: standardMarkElement,
			spanHighlight: spanHighlightElement,
			...headingElements
		};
	}

	// 清理测试元素
	private cleanupTestElements(elements: Record<string, HTMLElement>) {
		if (elements.container && elements.container.parentNode) {
			elements.container.parentNode.removeChild(elements.container);
		}
	}

	// 生成主题文件内容
	private generateThemeFileContent(themeName: string, colors: Record<string, string>): string {
		const timestamp = new Date().toISOString();
		const displayTime = new Date().toLocaleString('zh-CN');

		// 使用提取的颜色，如果没有则使用智能默认值
		const isDark = this.isDarkTheme(colors);
		const smartDefaults = this.getSmartDefaults(isDark);

		// 构建完整的CSS变量映射
		const cssVars = this.buildCSSVariables(colors, smartDefaults);

		return `---
author: WeWrite自动生成
theme_name: ${themeName} (Obsidian主题)
description: 基于Obsidian主题"${themeName}"自动生成的WeWrite主题
generated_at: ${timestamp}
source: Obsidian主题
---

# ${themeName} (Obsidian主题)

这是基于Obsidian主题"${themeName}"自动生成的WeWrite主题文件。

## 主题特点

- 背景色：${colors['background-primary'] || smartDefaults.background}
- 文字色：${colors['text-normal'] || smartDefaults.text}
- 链接色：${colors['link-color'] || smartDefaults.link}
- 代码块背景：${colors['code-background'] || smartDefaults.codeBackground}
- 代码语法高亮：支持多种颜色

## CSS样式定义

\`\`\`css
:root {
  /* 基础颜色变量 */
  --wewrite-bg: ${cssVars.background};
  --wewrite-text: ${cssVars.text};
  --wewrite-border: ${cssVars.border};

  /* 文章基础样式 */
  --article-font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  --article-text-font-size: 15px;
  --article-line-height: 1.8;
  --article-text-align: left;

  /* 标题颜色 */
  --heading-color: ${cssVars.heading};

  /* 各级标题样式 */
  --h1-color: ${cssVars.h1Color};
  --h1-size: ${cssVars.h1Size};
  --h1-weight: ${cssVars.h1Weight};

  --h2-color: ${cssVars.h2Color};
  --h2-size: ${cssVars.h2Size};
  --h2-weight: ${cssVars.h2Weight};

  --h3-color: ${cssVars.h3Color};
  --h3-size: ${cssVars.h3Size};
  --h3-weight: ${cssVars.h3Weight};

  --h4-color: ${cssVars.h4Color};
  --h4-size: ${cssVars.h4Size};
  --h4-weight: ${cssVars.h4Weight};

  --h5-color: ${cssVars.h5Color};
  --h5-size: ${cssVars.h5Size};
  --h5-weight: ${cssVars.h5Weight};

  --h6-color: ${cssVars.h6Color};
  --h6-size: ${cssVars.h6Size};
  --h6-weight: ${cssVars.h6Weight};

  /* 强调文本颜色 */
  --strong-color: ${cssVars.strong};

  /* 高亮文本颜色 */
  --highlight-background-color: ${cssVars.highlightBackground};
  --highlight-text-color: ${cssVars.highlightText};

  /* 链接颜色 */
  --link-color: ${cssVars.link};
  --link-hover-color: ${cssVars.linkHover};

  /* 代码块基础样式 */
  --code-background-color: ${cssVars.codeBackground};
  --code-color: ${cssVars.codeNormal};
  --code-size: ${cssVars.codeSize};

  /* 代码语法高亮颜色 */
  --code-comment-color: ${cssVars.codeComment};
  --code-function-color: ${cssVars.codeFunction};
  --code-keyword-color: ${cssVars.codeKeyword};
  --code-string-color: ${cssVars.codeString};
  --code-property-color: ${cssVars.codeProperty};
  --code-tag-color: ${cssVars.codeTag};
  --code-value-color: ${cssVars.codeValue};
  --code-important-color: ${cssVars.codeImportant};
  --code-punctuation-color: ${cssVars.codePunctuation};

  /* 引用块样式 */
  --blockquote-border-color: ${cssVars.blockquoteBorder};
  --blockquote-background-color: ${cssVars.blockquoteBackground};
  --blockquote-color: ${cssVars.blockquoteText};

  /* 表格样式 */
  --table-border-color: ${cssVars.tableBorder};
  --table-header-background-color: ${cssVars.tableHeaderBackground};
  --table-header-color: ${cssVars.tableHeaderText};

  /* 标签样式 */
  --tag-color: ${cssVars.tagColor};
  --tag-background: ${cssVars.tagBackground};
}

/* 代码块语法高亮应用 */
.wewrite-article-content pre code {
  background-color: var(--code-background-color);
  color: var(--code-color);
}

.wewrite-article-content .token.comment {
  color: var(--code-comment-color);
}

.wewrite-article-content .token.function {
  color: var(--code-function-color);
}

.wewrite-article-content .token.keyword {
  color: var(--code-keyword-color);
}

.wewrite-article-content .token.string {
  color: var(--code-string-color);
}

.wewrite-article-content .token.property {
  color: var(--code-property-color);
}

.wewrite-article-content .token.tag {
  color: var(--code-tag-color);
}

.wewrite-article-content .token.number,
.wewrite-article-content .token.boolean {
  color: var(--code-value-color);
}

.wewrite-article-content .token.important {
  color: var(--code-important-color);
}

.wewrite-article-content .token.punctuation {
  color: var(--code-punctuation-color);
}

/* 标题样式应用 */
.wewrite-article-content h1 {
  color: var(--h1-color);
  font-size: var(--h1-size);
  font-weight: var(--h1-weight);
}

.wewrite-article-content h2 {
  color: var(--h2-color);
  font-size: var(--h2-size);
  font-weight: var(--h2-weight);
}

.wewrite-article-content h3 {
  color: var(--h3-color);
  font-size: var(--h3-size);
  font-weight: var(--h3-weight);
}

.wewrite-article-content h4 {
  color: var(--h4-color);
  font-size: var(--h4-size);
  font-weight: var(--h4-weight);
}

.wewrite-article-content h5 {
  color: var(--h5-color);
  font-size: var(--h5-size);
  font-weight: var(--h5-weight);
}

.wewrite-article-content h6 {
  color: var(--h6-color);
  font-size: var(--h6-size);
  font-weight: var(--h6-weight);
}
\`\`\`

## 使用说明

1. 这个主题文件是从Obsidian主题自动生成的
2. 包含了完整的代码语法高亮支持
3. 你可以编辑上面的CSS来自定义样式
4. 修改后保存文件，WeWrite会自动重新加载主题
5. 如果需要重新生成，可以删除此文件后重新生成

---
*由WeWrite自动生成于 ${displayTime}*
`;
	}

	// 构建完整的CSS变量映射
	private buildCSSVariables(colors: Record<string, string>, smartDefaults: any): Record<string, string> {
		return {
			// 基础颜色
			background: colors['background-primary'] || smartDefaults.background,
			text: colors['text-normal'] || smartDefaults.text,
			border: colors['border-color'] || smartDefaults.border,

			// 标题和强调
			heading: colors['text-accent'] || colors['text-normal'] || smartDefaults.text,
			strong: colors['strong-color'] || colors['text-accent'] || colors['interactive-accent'] || smartDefaults.accent,

			// 高亮文本
			highlightBackground: colors['highlight-background-color'] || smartDefaults.highlightBackground,
			highlightText: colors['highlight-text-color'] || smartDefaults.highlightText,

			// 链接
			link: colors['link-color'] || colors['interactive-accent'] || smartDefaults.link,
			linkHover: colors['link-color-hover'] || colors['interactive-accent-hover'] || smartDefaults.linkHover,

			// 代码块基础
			codeBackground: colors['code-background'] || colors['background-secondary'] || smartDefaults.codeBackground,
			codeNormal: colors['code-normal'] || colors['text-normal'] || smartDefaults.text,
			codeSize: colors['code-size'] || '14px',

			// 代码语法高亮
			codeComment: colors['code-comment'] || colors['text-faint'] || smartDefaults.codeComment,
			codeFunction: colors['code-function'] || colors['color-yellow'] || smartDefaults.codeFunction,
			codeKeyword: colors['code-keyword'] || colors['color-pink'] || smartDefaults.codeKeyword,
			codeString: colors['code-string'] || colors['color-green'] || smartDefaults.codeString,
			codeProperty: colors['code-property'] || colors['color-cyan'] || smartDefaults.codeProperty,
			codeTag: colors['code-tag'] || colors['color-red'] || smartDefaults.codeTag,
			codeValue: colors['code-value'] || colors['color-purple'] || smartDefaults.codeValue,
			codeImportant: colors['code-important'] || colors['color-orange'] || smartDefaults.codeImportant,
			codePunctuation: colors['code-punctuation'] || colors['text-muted'] || smartDefaults.codePunctuation,

			// 引用块
			blockquoteBorder: colors['interactive-accent'] || colors['text-accent'] || smartDefaults.accent,
			blockquoteBackground: colors['background-secondary'] || smartDefaults.secondaryBackground,
			blockquoteText: colors['text-muted'] || colors['text-normal'] || smartDefaults.text,

			// 表格
			tableBorder: colors['border-color'] || smartDefaults.border,
			tableHeaderBackground: colors['background-secondary'] || smartDefaults.secondaryBackground,
			tableHeaderText: colors['text-normal'] || smartDefaults.text,

			// 标签
			tagColor: colors['tag-color'] || colors['text-accent'] || smartDefaults.accent,
			tagBackground: colors['tag-background'] || colors['background-secondary'] || smartDefaults.tagBackground,

			// 标题层级样式 - 使用验证后的值
			h1Color: colors['h1-color'] || colors['text-normal'] || smartDefaults.text,
			h1Size: this.validateHeadingSize(colors['h1-size'], smartDefaults.h1Size),
			h1Weight: this.validateHeadingWeight(colors['h1-weight'], smartDefaults.h1Weight),

			h2Color: colors['h2-color'] || colors['text-normal'] || smartDefaults.text,
			h2Size: this.validateHeadingSize(colors['h2-size'], smartDefaults.h2Size),
			h2Weight: this.validateHeadingWeight(colors['h2-weight'], smartDefaults.h2Weight),

			h3Color: colors['h3-color'] || colors['text-normal'] || smartDefaults.text,
			h3Size: this.validateHeadingSize(colors['h3-size'], smartDefaults.h3Size),
			h3Weight: this.validateHeadingWeight(colors['h3-weight'], smartDefaults.h3Weight),

			h4Color: colors['h4-color'] || colors['text-normal'] || smartDefaults.text,
			h4Size: this.validateHeadingSize(colors['h4-size'], smartDefaults.h4Size),
			h4Weight: this.validateHeadingWeight(colors['h4-weight'], smartDefaults.h4Weight),

			h5Color: colors['h5-color'] || colors['text-normal'] || smartDefaults.text,
			h5Size: this.validateHeadingSize(colors['h5-size'], smartDefaults.h5Size),
			h5Weight: this.validateHeadingWeight(colors['h5-weight'], smartDefaults.h5Weight),

			h6Color: colors['h6-color'] || colors['text-normal'] || smartDefaults.text,
			h6Size: this.validateHeadingSize(colors['h6-size'], smartDefaults.h6Size),
			h6Weight: this.validateHeadingWeight(colors['h6-weight'], smartDefaults.h6Weight)
		};
	}

	// 判断是否为深色主题
	private isDarkTheme(colors: Record<string, string>): boolean {
		const bgColor = colors['background-primary'];
		if (!bgColor) return document.body.classList.contains('theme-dark');

		// 简单的亮度检测
		if (bgColor.includes('rgb')) {
			const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
			if (match) {
				const [, r, g, b] = match.map(Number);
				const brightness = (r * 299 + g * 587 + b * 114) / 1000;
				return brightness < 128;
			}
		}

		return document.body.classList.contains('theme-dark');
	}

	// 获取智能默认值
	private getSmartDefaults(isDark: boolean) {
		if (isDark) {
			return {
				background: '#1a1a2e',
				text: '#eee',
				link: '#4fc3f7',
				linkHover: '#29b6f6',
				accent: '#64b5f6',
				border: '#444',
				codeBackground: '#2d2d2d',
				secondaryBackground: '#252545',
				tagBackground: '#3a3a5c',
				// 深色主题的代码语法高亮
				codeComment: '#6a9955',
				codeFunction: '#dcdcaa',
				codeKeyword: '#c586c0',
				codeString: '#ce9178',
				codeProperty: '#9cdcfe',
				codeTag: '#f44747',
				codeValue: '#b5cea8',
				codeImportant: '#ff8c00',
				codePunctuation: '#d4d4d4',

				// 深色主题的标题样式
				h1Size: '2em',
				h1Weight: '700',
				h2Size: '1.5em',
				h2Weight: '600',
				h3Size: '1.25em',
				h3Weight: '600',
				h4Size: '1.1em',
				h4Weight: '500',
				h5Size: '1em',
				h5Weight: '500',
				h6Size: '0.9em',
				h6Weight: '500',

				// 深色主题的高亮颜色 - 现代化蓝色系
				highlightBackground: '#1a237e',
				highlightText: '#90caf9'
			};
		} else {
			return {
				background: '#ffffff',
				text: '#333333',
				link: '#0066cc',
				linkHover: '#0080ff',
				accent: '#2c3e50',
				border: '#ddd',
				codeBackground: '#f5f5f5',
				secondaryBackground: '#f8f9fa',
				tagBackground: '#e8e8e8',
				// 浅色主题的代码语法高亮
				codeComment: '#008000',
				codeFunction: '#795e26',
				codeKeyword: '#0000ff',
				codeString: '#a31515',
				codeProperty: '#001080',
				codeTag: '#800000',
				codeValue: '#09885a',
				codeImportant: '#cd3131',
				codePunctuation: '#393a34',

				// 浅色主题的标题样式
				h1Size: '2em',
				h1Weight: '700',
				h2Size: '1.5em',
				h2Weight: '600',
				h3Size: '1.25em',
				h3Weight: '600',
				h4Size: '1.1em',
				h4Weight: '500',
				h5Size: '1em',
				h5Weight: '500',
				h6Size: '0.9em',
				h6Weight: '500',

				// 浅色主题的高亮颜色 - 现代化蓝色系
				highlightBackground: '#e3f2fd',
				highlightText: '#1565c0'
			};
		}
	}

	// 验证标题大小是否合理
	private validateHeadingSize(extractedSize: string | undefined, defaultSize: string): string {
		if (!extractedSize) return defaultSize;

		// 如果提取到的大小太小（比如16px对于H1来说太小），使用默认值
		const sizeValue = parseFloat(extractedSize);
		if (isNaN(sizeValue) || sizeValue < 18) {
			console.log(`[WeWrite] 标题大小 ${extractedSize} 不合理，使用默认值 ${defaultSize}`);
			return defaultSize;
		}

		return extractedSize;
	}

	// 验证标题粗细是否合理
	private validateHeadingWeight(extractedWeight: string | undefined, defaultWeight: string): string {
		if (!extractedWeight) return defaultWeight;

		// 检查是否是有效的font-weight值
		const validWeights = ['100', '200', '300', '400', '500', '600', '700', '800', '900', 'normal', 'bold', 'lighter', 'bolder'];
		if (!validWeights.includes(extractedWeight)) {
			console.log(`[WeWrite] 标题粗细 ${extractedWeight} 不合理，使用默认值 ${defaultWeight}`);
			return defaultWeight;
		}

		return extractedWeight;
	}
}
