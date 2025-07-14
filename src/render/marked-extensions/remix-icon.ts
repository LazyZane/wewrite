
/*
* marked extension for remixIcon svg icons:

*/
import { MarkedExtension, Tokens } from "marked";
import { ObsidianMarkdownRenderer } from "../markdown-render";
import { WeWriteMarkedExtension } from "./extension";

const remixIconRegex = /`(ris|fas):([a-z0-9-]+)`/i;
const remixIconRegexTokenizer = /^`(ris|fas):([a-z0-9-]+)`/i;
export class RemixIconRenderer extends WeWriteMarkedExtension {
	remixIndex: number = 0;

	async prepare() {
		this.remixIndex = 0;
	}


	render(code: string, lang: string | undefined): string {
		const renderer = ObsidianMarkdownRenderer.getInstance(this.plugin.app);
		if (!renderer) {
			return '<span>remix icon renderer not available</span>';
		}
		const root = renderer.queryElement(this.remixIndex, '.obsidian-icon.react-icon');
		if (!root) {
			return '<span>remix icon not found </span>';
		}
		this.remixIndex++
		return root.outerHTML;
	}



	markedExtension():MarkedExtension {
		return {
			extensions: [{
				name: 'remixIcon',
				level: 'inline',
				start: (str: string) => {
					const match = str.match(remixIconRegex);
					if (match){
						return match.index
					}
				},
				tokenizer: (src: string) => {
					const match = src.match(remixIconRegexTokenizer);
					if (match) {
						return {
							type: 'remixIcon',
							raw: match[0],
							text: match[0].trim(),
							lang: match[1],
						};
					}
				},
				renderer: (token: Tokens.Generic) => {
					return this.render(token.text, token.lang);
				},
			}]
		}
	}
}

