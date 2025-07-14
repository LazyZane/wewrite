/** 
 * marked extension for iconize 
 */
import { MarkedExtension, Tokens } from "marked";
import { Plugin, sanitizeHTMLToDom } from 'obsidian';
import { WeWriteMarkedExtension } from "./extension";

const iconsRegex = /:(.*?):/;
const iconsRegexTokenizer = /^:(.*?):/;
export class IconizeRender extends WeWriteMarkedExtension {
    iconizeIndex: number = 0;
    icon: Plugin;

    async prepare() {
        this.iconizeIndex = 0;
        this.icon = this.plugin.app.plugins.plugins["obsidian-icon-folder"] as Plugin
    }

    getIconByname(iconName: string) {
        try {
            if (!this.icon) {
                console.warn('[WeWrite] obsidian-icon-folder插件未安装或未启用');
                return null;
            }
            //@ts-ignore
            if (!this.icon.api) {
                console.warn('[WeWrite] obsidian-icon-folder插件API不可用');
                return null;
            }
            //@ts-ignore
            return this.icon.api.getIconByName(iconName);
        } catch (error) {
            console.error('[WeWrite] getIconByname出错:', error);
            return null;
        }
    }
    render(iconName: string) {
        const iconObject = this.getIconByname(iconName)
        if (iconObject) {
            const rootSpan = createSpan({
                cls: 'cm-iconize-icon',
                attr: {
                    'aria-label': iconName,
                    'data-icon': iconName,
                    'aria-hidden': 'true',
                },
            });
            rootSpan.style.display = 'inline-flex';
            rootSpan.style.transform = 'translateY(13%)';
            // rootSpan.innerHTML = iconObject.svgElement; 

			rootSpan.appendChild(sanitizeHTMLToDom( iconObject.svgElement))
            return rootSpan.outerHTML;
        }
        return `<span>${iconName}$t('render.render-failed')</span>`
    }

    markedExtension(): MarkedExtension {
        return {
            extensions: [{
                name: 'iconize',
                level: 'inline',
                start: (src: string) => {
                    const match = src.match(iconsRegex);
                    if (match) {
                        return match.index;
                    }
                },
                tokenizer: (src: string) => {
                    const match = src.match(iconsRegexTokenizer);
                    if (match) {
                        return {
                            type: 'iconize',
                            raw: match[0],
                            text: match[1],
                        };
                    }
                },
                renderer: (token: Tokens.Generic) => {
                    return this.render(token.text);
                }
            }]
        }
    }
}

