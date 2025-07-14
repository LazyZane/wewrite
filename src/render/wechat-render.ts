/**
 * This is the customized render for WeChat
 *
 * it is based on marked and its extension mechanism
 *
 * this file the framework and entry point for the renderer
 *
 * each functionality will be implemented in different extensions of marked.
 *
 */

import matter from "gray-matter";
import { Marked, Tokens } from "marked";
import { Component, debounce } from "obsidian";
import WeWritePlugin from "src/main";
import { WechatClient } from "../wechat-api/wechat-client";
import { ObsidianMarkdownRenderer } from "./markdown-render";
import { BlockquoteRenderer } from "./marked-extensions/blockquote";
import { CodeRenderer } from "./marked-extensions/code";
import { CodespanRenderer } from "./marked-extensions/codespan";
import { CodeHighlight } from "./marked-extensions/code-highlight";
import { Embed } from "./marked-extensions/embed";
import {
	PreviewRender,
	WeWriteMarkedExtension,
} from "./marked-extensions/extension";
import { Heading } from "./marked-extensions/heading";
import { IconizeRender } from "./marked-extensions/iconize";
import { MathRenderer } from "./marked-extensions/math";
import { RemixIconRenderer } from "./marked-extensions/remix-icon";
import { Table } from "./marked-extensions/table";
import { Footnote } from "./marked-extensions/footnote";
import { Links } from "./marked-extensions/links";
import { Summary } from "./marked-extensions/summary";
import { Image } from "./marked-extensions/image";
// import { ListItem } from './marked-extensions/list-item'

const markedOptiones = {
	gfm: true,
	breaks: true,
};

export class WechatRender {
	plugin: WeWritePlugin;
	client: WechatClient;
	extensions: WeWriteMarkedExtension[] = [];
	private static instance: WechatRender;
	marked: Marked;
	previewRender: PreviewRender;
	delayParse = async (path:string) => {
		return new Promise<string>(async (resolve, reject) => {
			setTimeout(async () => {
				try {
					const md = await this.plugin.app.vault.adapter.read(path);
					let html = await this.parse(md);
					html = await this.postprocess(html);
					resolve(html);
				} catch (error) {
					reject(error);
				}
			}, 100);
		});
	}
	private constructor(plugin: WeWritePlugin, previewRender: PreviewRender) {
		this.plugin = plugin;
		this.previewRender = previewRender;
		this.client = WechatClient.getInstance(plugin);
		this.marked = new Marked();
		this.marked.use(markedOptiones);
		this.useExtensions();
	}
	static getInstance(plugin: WeWritePlugin, previewRender: PreviewRender) {
		if (!WechatRender.instance) {
			WechatRender.instance = new WechatRender(plugin, previewRender);
		}
		return this.instance;
	}
	addExtension(extension: WeWriteMarkedExtension) {
		this.extensions.push(extension);
		this.marked.use(extension.markedExtension());
	}
	useExtensions() {
		this.addExtension(
			new Footnote(this.plugin, this.previewRender, this.marked)
		);
		this.addExtension(
			new IconizeRender(this.plugin, this.previewRender, this.marked)
		);
		this.addExtension(
			new Heading(this.plugin, this.previewRender, this.marked)
		);
		this.addExtension(
			new Embed(this.plugin, this.previewRender, this.marked)
		);
		this.addExtension(
			new CodeRenderer(this.plugin, this.previewRender, this.marked)
		);
		this.addExtension(
			new CodespanRenderer(this.plugin, this.previewRender, this.marked)
		);
		this.addExtension(
			new CodeHighlight(this.plugin, this.previewRender, this.marked)
		);
		this.addExtension(
			new MathRenderer(this.plugin, this.previewRender, this.marked)
		);
		this.addExtension(
			new RemixIconRenderer(this.plugin, this.previewRender, this.marked)
		);
		this.addExtension(
			new BlockquoteRenderer(this.plugin, this.previewRender, this.marked)
		);
		this.addExtension(
			new Table(this.plugin, this.previewRender, this.marked)
		);
		this.addExtension(
			new Links(this.plugin, this.previewRender, this.marked)
		);
		this.addExtension(
			new Summary(this.plugin, this.previewRender, this.marked)
		);
		this.addExtension(
			new Image(this.plugin, this.previewRender, this.marked)
		);
		// this.addExtension(new ListItem(this.plugin, this.previewRender, this.marked))
	}
	async parse(md: string) {
		try {
			const { data, content } = matter(md);
			console.log('[WeWrite] 开始解析markdown，内容长度:', content.length);

			for (const extension of this.extensions) {
				try {
					await extension.prepare();
				} catch (error) {
					console.error('[WeWrite] 扩展prepare失败:', extension.constructor.name, error);
				}
			}

			console.log('[WeWrite] 所有扩展prepare完成，开始marked解析');
			const result = await this.marked.parse(content);
			console.log('[WeWrite] marked解析完成，结果长度:', result.length);
			return result;
		} catch (error) {
			console.error('[WeWrite] parse方法出错:', error);
			throw error;
		}
	}
	async postprocess(html: string) {
		let result = html;
		for (let ext of this.extensions) {
			result = await ext.postprocess(result);
		}
		return result;
	}

	public async parseNote(
		path: string,
		container: HTMLElement,
		view: Component
	) {
		//render the markdown content,
		container.empty();
		container.show();

		//check if add the 2classes, can  load other plugins, else we need to add load compponents.
		const  renderContainer = container.createDiv({cls:'markdown-preview-view'})
		const sizer = renderContainer.createDiv({cls:'markdown-preview-sizer'})
		const {app} = this.plugin

		// const renderer = new CustomMarkdownView(app, sizer, path, view);
		// // this.plugin.registerMarkdownRendererChild(renderer);
		// await renderer.onload();
		const renderer = ObsidianMarkdownRenderer.getInstance(this.plugin.app);
		if (!renderer) {
			console.error('[WeWrite] ObsidianMarkdownRenderer实例为null');
			container.empty();
			container.hide();
			return '<p>Renderer not available</p>';
		}

		const processedMarkdown = await renderer.render(
			path,
			sizer,
			view,
			this.plugin
		);

		// 使用处理后的markdown内容（包含头尾内容）进行渲染
		let rendered: string;
		if (processedMarkdown) {
			// 如果有处理后的markdown，直接解析它
			let html = await this.parse(processedMarkdown);
			html = await this.postprocess(html);
			rendered = html;
		} else {
			// 如果没有处理后的markdown，使用原来的方法
			rendered = await this.delayParse(path);
		}

		//clean up the rendered markdown content
		container.empty();
		container.hide();
		return rendered;
	}
}
