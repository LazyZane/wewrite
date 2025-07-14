/**
 * marked extension for table
 * add container for table
 * 
 * 
 */

import { Tokens, MarkedExtension } from "marked";
import { WeWriteMarkedExtension } from "./extension";
import { ObsidianMarkdownRenderer } from "../markdown-render";


export class Table extends WeWriteMarkedExtension {

    tableIndex = 0;
    async prepare(){
        this.tableIndex = 0;
    }
    markedExtension(): MarkedExtension {
        return {
            extensions: [
                {
                    name: 'table',
                    level: 'block', // Is this a block-level or inline-level tokenizer?
                    renderer : (token:Tokens.Table)=> {
                        try {
                            const renderer = ObsidianMarkdownRenderer.getInstance(this.plugin.app);
                            if (!renderer) {
                                console.warn('[WeWrite] ObsidianMarkdownRenderer实例为null');
                                return '<section class="table-container"><p>Table renderer not available</p></section>';
                            }

                            const root = renderer.queryElement(this.tableIndex, 'table');
                            if (!root) {
                                console.warn(`[WeWrite] 未找到table元素，索引: ${this.tableIndex}`);
                                return '<section class="table-container"><p>Table content not found</p></section>';
                            }

                            this.tableIndex++;
                            return `<section class="table-container">${root.outerHTML}</section>`;
                        } catch (error) {
                            console.error('[WeWrite] Table renderer出错:', error);
                            return '<section class="table-container"><p>Table rendering error</p></section>';
                        }
                    }
                }
            ]
        }
    }
}
