import { requestUrl } from "obsidian";

export function areObjectsEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;

    if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
        return false;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
        if (!keys2.includes(key) || !areObjectsEqual(obj1[key], obj2[key])) {
            return false;
        }
    }

    return true;
}

export function fetchImageBlob(url: string): Promise<Blob> {
    return new Promise(async (resolve, reject) => {
        if (!url) {
            console.error(`[WeWrite] Invalid URL: ${url}`);
            reject(new Error(`Invalid URL: ${url}`));
            return;
        }

        if (url.startsWith('http://') || url.startsWith('https://')) {
            try {
                const response = await requestUrl(url);

                if (!response.arrayBuffer) {
                    console.error(`[WeWrite] Failed to fetch image from ${url}: No arrayBuffer in response`);
                    reject(new Error(`Failed to fetch image from ${url}: No arrayBuffer in response`));
                    return;
                }

                // 尝试从响应头获取Content-Type
                let contentType = 'image/jpeg'; // 默认类型
                if (response.headers && response.headers['content-type']) {
                    contentType = response.headers['content-type'];
                } else {
                    // 尝试从URL扩展名推断类型
                    const urlLower = url.toLowerCase();
                    if (urlLower.includes('.png')) {
                        contentType = 'image/png';
                    } else if (urlLower.includes('.gif')) {
                        contentType = 'image/gif';
                    } else if (urlLower.includes('.webp')) {
                        contentType = 'image/webp';
                    } else if (urlLower.includes('.bmp')) {
                        contentType = 'image/bmp';
                    }
                }

                const blob = new Blob([response.arrayBuffer], { type: contentType });
                resolve(blob);
            } catch (error) {
                console.error(`[WeWrite] Error fetching image from ${url}:`, error);
                reject(error);
            }
        } else {
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                resolve(blob);
            } catch (error) {
                console.error(`[WeWrite] Error fetching non-HTTP image from ${url}:`, error);
                reject(error);
            }
        }
    });
}

export function replaceDivWithSection(root: HTMLElement){
    let html = root.outerHTML.replaceAll(/<div /g, '<section ').replaceAll(/<\/div>/g, '</section>');
    return html;

}

export function removeThinkTags(content: string): string {
	// 使用正则表达式匹配 <think> 和 </think> 标签及其内容，并替换为空字符串
	const regex = /<think>[\s\S]*<\/think>/g;
	return content.replace(regex, "");
}
