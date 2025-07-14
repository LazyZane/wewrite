/**
 * Marked extension for text highlighting
 * Supports markdown syntax: ==highlighted text==
 */

import { MarkedExtension, Tokens } from "marked";
import { WeWriteMarkedExtension } from "./extension";

// 高亮语法的正则表达式
const highlightRegex = /==(.*?)==/;
const highlightRegexTokenizer = /^==(.*?)==/;

export class HighlightRenderer extends WeWriteMarkedExtension {
    
    async prepare() {
        // 初始化时无需特殊处理
    }

    async postprocess(html: string) {
        return html;
    }

    /**
     * 渲染高亮文本
     * @param text 要高亮的文本内容
     * @returns 渲染后的HTML
     */
    render(text: string): string {
        // 使用span标签来表示高亮文本，避免浏览器对mark标签的默认样式干扰
        // 使用CSS变量，支持主题自定义，同时提供强制的样式重置
        const inlineStyle = 'background-color: var(--highlight-background-color, #e3f2fd) !important; ' +
                           'background: var(--highlight-background-color, #e3f2fd) !important; ' +
                           'background-image: none !important; ' +
                           'color: var(--highlight-text-color, #1565c0) !important; ' +
                           'padding: 0.125em 0.375em !important; ' +
                           'margin: 0 !important; ' +
                           'border-radius: 0.25em !important; ' +
                           'border: none !important; ' +
                           'border-width: 0 !important; ' +
                           'border-style: none !important; ' +
                           'border-color: transparent !important; ' +
                           'outline: none !important; ' +
                           'outline-width: 0 !important; ' +
                           'text-decoration: none !important; ' +
                           'text-decoration-line: none !important; ' +
                           'text-decoration-style: none !important; ' +
                           'text-decoration-color: transparent !important; ' +
                           'box-shadow: 0 1px 2px rgba(21, 101, 192, 0.1) !important; ' +
                           'display: inline !important; ' +
                           'font-weight: inherit !important; ' +
                           'font-style: inherit !important; ' +
                           'font-size: inherit !important; ' +
                           'line-height: inherit !important; ' +
                           'vertical-align: baseline !important; ' +
                           'position: static !important; ' +
                           'z-index: auto !important;';

        return `<span class="wewrite-highlight" style="${inlineStyle}">${text}</span>`;
    }

    markedExtension(): MarkedExtension {
        return {
            extensions: [{
                name: 'wewrite-highlight', // 使用不同的名称避免冲突
                level: 'inline',
                start: (src: string) => {
                    // 查找 == 的位置
                    const match = src.match(highlightRegex);
                    if (match) {
                        console.log('[WeWrite] 🎯 HighlightRenderer start 找到匹配:', match.index);
                        return match.index;
                    }
                },
                tokenizer: (src: string) => {
                    // 匹配 ==text== 语法
                    const match = src.match(highlightRegexTokenizer);
                    if (match) {
                        console.log('[WeWrite] 🎯 HighlightRenderer tokenizer 匹配到:', match[0]);
                        return {
                            type: 'wewrite-highlight', // 与扩展名称保持一致
                            raw: match[0],        // 完整匹配的文本 ==text==
                            text: match[1],       // 提取的文本内容 text
                        };
                    }
                },
                renderer: (token: Tokens.Generic) => {
                    console.log('[WeWrite] 🎯 HighlightRenderer renderer 被调用，文本:', token.text);
                    const result = this.render(token.text);
                    console.log('[WeWrite] 🎯 HighlightRenderer 生成HTML:', result);
                    return result;
                }
            }]
        };
    }
}
