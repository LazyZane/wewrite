/**
 * marked extension for summary folder headings
 * 
 * 
 * 
 */

import { MarkedExtension } from "marked";
import { sanitizeHTMLToDom } from "obsidian";
import { WeWriteMarkedExtension } from "./extension";

function isHeading(element:Element) {
    // 检查元素是否为标题标签
    return /^h[1-6]$/i.test(element.tagName);
}

function getHeadingLevel(element:Element) {
    if (isHeading(element)) {
        // 提取标题级别
        return parseInt(element.tagName.charAt(1), 10);
    }
    return null; // 如果不是标题，返回 null
}

function isSubContent(currnetHeading: Element, currentNode:Element){
	const nodeLevel = getHeadingLevel(currentNode)
	const headingLevel = getHeadingLevel(currnetHeading)
	return nodeLevel === null || nodeLevel > headingLevel!
}
export class Summary extends WeWriteMarkedExtension {
    processHeading(dom: HTMLDivElement, heading: string) {
		const validHeadings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        const headingType = heading.trim().toLowerCase();
        if (!validHeadings.includes(headingType)) {
            return dom;
        }
        const hEls = dom.querySelectorAll(heading.trim())
        for (let i = 0; i < hEls.length; i++) {
            const currentHeading = hEls[i]
            const nextHeading = hEls[i+1]
            if (currentHeading) {
                const d = createEl('details')
                d.createEl('summary', { text: currentHeading.textContent as string })
                let current = currentHeading.nextSibling
                
                while (current && isSubContent(currentHeading, current as Element) ) {
                    const nextSibling = current.nextSibling
                    d.appendChild(current)
                    current = nextSibling
                }
                currentHeading.replaceWith(d)
            }

        }
        return dom
    }
    async postprocess(html: string) {
        const headingFolder = this.previewRender.articleProperties.get('folded-headings')

        if (headingFolder === undefined || !headingFolder) {
            return html
        }
        const dom = sanitizeHTMLToDom(html)
        const tempDiv = createEl('div');
        tempDiv.appendChild(dom);
        const headings = headingFolder.split(',')
        for (const heading of headings) {
            this.processHeading(tempDiv, heading)
        }
        
        return tempDiv.innerHTML;
    }

    markedExtension(): MarkedExtension {
        return {
            extensions: []
        }
    }
}
