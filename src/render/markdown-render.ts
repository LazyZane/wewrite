/**
 * MarkdownRender of obsidian. 
 * credits to author of export as image plugin
*/

import { App, Component, MarkdownRenderChild, MarkdownRenderer, MarkdownView } from "obsidian";
import domtoimage from './dom-to-image-more';
import matter from "gray-matter";
async function delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}
export class ObsidianMarkdownRenderer {
    private static instance: ObsidianMarkdownRenderer;
    private path: string
    previewEl: HTMLElement
    private rendering: boolean = false
    private container: HTMLElement
    private view: Component
    mdv: MarkdownRenderChild;
    markdownBody: HTMLDivElement;
    private constructor(private app: App) {
        this.app = app;
    }

    public static getInstance(app: App,) {
        if (!ObsidianMarkdownRenderer.instance) {
            ObsidianMarkdownRenderer.instance = new ObsidianMarkdownRenderer(app);
        }
        return ObsidianMarkdownRenderer.instance;
    }
    public async render(path: string, container: HTMLElement, view: Component, plugin?: any): Promise<string | undefined> {
        if (path === undefined || !path || !path.toLowerCase().endsWith('.md')) {
            return;
        }

        this.container = container
        this.container.addClass('wewrite-markdown-render-container')
        this.view = view
        this.path = path

        // if (this.previewEl !== undefined && this.previewEl) {
        //     this.previewEl.parentNode?.removeChild(this.previewEl)
        // }
		this.container.empty();
		this.container.show();
        this.rendering = true
        // await this.loadComponents(view)
        this.previewEl = createDiv()
        this.markdownBody = this.previewEl.createDiv()
        this.mdv = new MarkdownRenderChild(this.markdownBody)
        this.path = path

        // 读取原始markdown内容
        let markdown = await this.app.vault.adapter.read(path)

        // 如果传入了plugin，则添加开头结尾内容
        if (plugin) {
            markdown = this.addHeaderFooterToMarkdown(markdown, plugin);
        }

        await MarkdownRenderer.render(this.app, markdown, this.markdownBody, path, this.mdv
			// this.app.workspace.getActiveViewOfType(MarkdownView)!
            // || this.app.workspace.activeLeaf?.view
            // || this.mdv //new MarkdownRenderChild(this.el)
        )

        this.container.appendChild(this.previewEl)
        try {
			await Promise.all([
				this.waitForSelector(this.previewEl, ".callout-title svg", 500),
				this.waitForSelector(this.previewEl, ".mermaid", 1000),
				this.waitForSelector(this.previewEl, "svg", 1000),
			]);
		} catch (err) {
			console.warn("部分插件渲染超时（非致命）", err);
		}
        this.rendering = false
		// this.container.hide()

        // 返回处理后的markdown内容，供WechatRender使用
        return plugin ? markdown : undefined;
    }

    /**
     * 为Markdown内容添加开头结尾
     * @param markdown 原始Markdown内容
     * @param plugin WeWrite插件实例
     * @returns 添加开头结尾后的Markdown内容
     */
    private addHeaderFooterToMarkdown(markdown: string, plugin: any): string {
        const settings = plugin.settings;

        // 先解析frontmatter，只使用content部分（去掉笔记属性）
        const { data, content } = matter(markdown);
        let result = content;

        // 添加开头内容
        if (settings.headerTemplate?.enabled && settings.headerTemplate.template) {
            const mergedVariables = this.mergeVariables(settings.headerTemplate.variables);
            const headerMarkdown = this.processTemplate(settings.headerTemplate.template, mergedVariables);

            if (headerMarkdown.trim()) {
                result = headerMarkdown + '\n\n' + result;
            }
        }

        // 添加结尾内容
        if (settings.footerTemplate?.enabled && settings.footerTemplate.template) {
            const mergedVariables = this.mergeVariables(settings.footerTemplate.variables);
            const footerMarkdown = this.processTemplate(settings.footerTemplate.template, mergedVariables);

            if (footerMarkdown.trim()) {
                result = result + '\n\n' + footerMarkdown;
            }
        }

        return result;
    }

    /**
     * 合并变量（从设置工具类复制）
     */
    private mergeVariables(customVariables: Record<string, string> = {}): Record<string, string> {
        const now = new Date();
        const defaultVariables = {
            currentDate: now.toLocaleDateString('zh-CN'),
            currentTime: now.toLocaleTimeString('zh-CN'),
            currentYear: now.getFullYear().toString(),
            currentMonth: (now.getMonth() + 1).toString().padStart(2, '0'),
            currentDay: now.getDate().toString().padStart(2, '0'),
        };

        return { ...defaultVariables, ...customVariables };
    }

    /**
     * 处理模板（从设置工具类复制）
     */
    private processTemplate(template: string, variables: Record<string, string>): string {
        let result = template;

        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }

        return result;
    }
    public queryElement(index: number, query: string) {
        if (this.previewEl === undefined || !this.previewEl) {
            return null
        }
        if (this.rendering) {
			return null
		}
		if (this.previewEl === undefined || !this.previewEl) {
            return null
        }
        const nodes = this.previewEl.querySelectorAll<HTMLElement>(query)
        if (nodes.length < index) {
            return null
        }
        return nodes[index]
    }
   
    public async domToImage(element: HTMLElement, p:any={}): Promise<string> {
        return await domtoimage.toPng(element, p)
    }
	waitForSelector(
		container: HTMLElement,
		selector: string,
		timeout = 1000
	): Promise<void> {
		return new Promise((resolve, reject) => {
			if (container.querySelector(selector)) return resolve();

			const observer = new MutationObserver(() => {
				if (container.querySelector(selector)) {
					observer.disconnect();
					resolve();
				}
			});

			observer.observe(container, { childList: true, subtree: true });

			setTimeout(() => {
				observer.disconnect();
				// reject(new Error(`Timeout waiting for selector: ${selector}`));
				resolve();
			}, timeout);
		});
	}

}
