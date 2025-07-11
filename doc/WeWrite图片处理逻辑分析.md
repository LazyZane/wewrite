# WeWrite 图片处理逻辑深度分析

## ⚠️ 重要发现

**实际测试发现**：WeWrite确实会直接将图床链接传递到微信公众号，而不是下载后重新上传！

用户反馈的问题：图床链接格式 `![image.png](http://lsky.xinqi.life:2052/up/2025/07/08/686c6f15515ef.png)` 被直接传递到微信公众号。

## 概述

WeWrite项目中的图片处理是一个复杂的系统，涉及图片识别、分类、上传、替换等多个环节。但实际运行中存在图片上传逻辑未被正确执行的问题。

## 图片类型识别与分类

### 1. 图片来源分类

WeWrite系统能够识别和处理以下几种类型的图片：

#### **A. Obsidian内部图片**
```typescript
// 识别标准：路径不以http开头
if (path.startsWith("http")) {
    return path; // 外部链接
}
// 通过Obsidian API获取本地文件
const file = this.searchFile(path);
const resPath = this.plugin.app.vault.getResourcePath(file);
```

**特征**：
- 相对路径：`images/photo.jpg`
- Obsidian内部链接：`obsidian://vault/path/to/image.png`
- 本地文件路径

#### **B. 微信图床链接**
```typescript
// 识别微信CDN链接
if (img.src.includes('://mmbiz.qpic.cn/')) {
    return; // 跳过上传，直接使用
}
```

**特征**：
- `https://mmbiz.qpic.cn/` 开头
- 已经是微信公众号可用的图片
- 无需重新上传

#### **C. 外部图床链接**
```typescript
// 其他HTTP/HTTPS链接
else if (url.startsWith("http") || url.startsWith("https")) {
    this.cover_image = url;
    // 需要上传到微信
}
```

**特征**：
- `http://` 或 `https://` 开头
- 第三方图床或网站图片
- 需要下载后上传到微信

#### **D. Base64编码图片**
```typescript
// Data URL格式的图片
else if (img.src.startsWith('data:image/')) {
    blob = dataURLtoBlob(img.src);
}
```

**特征**：
- `data:image/` 开头
- 内嵌在HTML中的图片数据
- 通常来自Canvas、SVG转换等

## 图片处理流程

### 1. 图片路径解析 (`embed.ts`)

```typescript
getImagePath(path: string) {
    if (path.startsWith("http")) {
        return path; // 直接返回HTTP链接
    }
    
    // 查找Obsidian文件
    const file = this.searchFile(path);
    if (file instanceof TFile) {
        // 获取Obsidian资源路径
        const resPath = this.plugin.app.vault.getResourcePath(file);
        return resPath;
    }
    return "";
}
```

### 2. 图片上传处理 (`post-render.ts`)

#### **主要上传函数**：

##### **A. uploadURLImage() - 处理所有img标签**
```typescript
export async function uploadURLImage(root: HTMLElement, wechatClient: WechatClient) {
    const images: HTMLImageElement[] = []
    root.querySelectorAll('img').forEach(img => {
        images.push(img)
    })
    
    const uploadPromises = images.map(async (img) => {
        let blob: Blob | undefined
        
        // 1. 跳过微信图床图片
        if (img.src.includes('://mmbiz.qpic.cn/')) {
            return;
        }
        // 2. 处理Base64图片
        else if (img.src.startsWith('data:image/')) {
            blob = dataURLtoBlob(img.src);
        }
        // 3. 处理外部链接图片
        else {
            blob = await fetchImageBlob(img.src)
        }
        
        if (blob) {
            // 上传到微信并替换src
            await wechatClient.uploadMaterial(blob, imageFileName(blob.type))
                .then(res => {
                    if (res) {
                        img.src = res.url // 替换为微信CDN链接
                    }
                })
        }
    })
    
    await Promise.all(uploadPromises)
}
```

##### **B. uploadSVGs() - 处理SVG元素**
```typescript
export async function uploadSVGs(root: HTMLElement, wechatClient: WechatClient) {
    const svgs: SVGSVGElement[] = []
    root.querySelectorAll('svg').forEach(svg => {
        svgs.push(svg)
    })

    const uploadPromises = svgs.map(async (svg) => {
        const svgString = svg.outerHTML;
        // 只处理大型SVG（>10KB）
        if (svgString.length < 10000) {
            return
        }
        
        // 转换SVG为PNG
        await svgToPng(svgString).then(async blob => {
            await wechatClient.uploadMaterial(blob, imageFileName(blob.type))
                .then(res => {
                    if (res) {
                        // 替换SVG为img标签
                        svg.outerHTML = `<img src="${res.url}" />`
                    }
                })
        })
    })
    
    await Promise.all(uploadPromises)
}
```

##### **C. uploadCanvas() - 处理Canvas元素**
```typescript
export async function uploadCanvas(root: HTMLElement, wechatClient: WechatClient) {
    const canvases: HTMLCanvasElement[] = []
    root.querySelectorAll('canvas').forEach(canvas => {
        canvases.push(canvas)
    })
    
    const uploadPromises = canvases.map(async (canvas) => {
        // 将Canvas转换为PNG Blob
        const blob = getCanvasBlob(canvas);
        
        await wechatClient.uploadMaterial(blob, imageFileName(blob.type))
            .then(res => {
                if (res) {
                    // 替换Canvas为img标签
                    canvas.outerHTML = `<img src="${res.url}" />`
                }
            })
    })
    
    await Promise.all(uploadPromises)
}
```

### 3. 微信API上传 (`wechat-client.ts`)

```typescript
async uploadMaterial(data: Blob, filename: string, type?: string) {
    // 1. 检查文件大小限制
    if (type === "video" && data.size > 1024 * 1024 * 10) {
        // 视频<10M
        return false;
    } else if (type === "voice" && data.size > 1024 * 1024 * 2) {
        // 音频<2M  
        return false;
    } else if (data.size > 1024 * 1024 * 10) {
        // 图片<10M
        return false;
    }

    // 2. 获取访问令牌
    const accessToken = await this.plugin.refreshAccessToken(
        this.plugin.settings.selectedMPAccount
    );

    // 3. 构建上传URL
    let url = `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${accessToken}`;
    if (type !== undefined) {
        url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=${type}`;
    }

    // 4. 构建multipart/form-data请求体
    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
    const bodyParts: (string | Uint8Array)[] = [];
    
    // 添加文件数据
    bodyParts.push(`------${boundary}\r\n`);
    bodyParts.push(`Content-Disposition: form-data; name="media"; filename="${filename}"\r\n`);
    bodyParts.push(`Content-Type: application/octet-stream\r\n\r\n`);
    bodyParts.push(await getBlobArrayBuffer(data));
    bodyParts.push(`\r\n------${boundary}--\r\n`);

    // 5. 发送请求
    const response = await requestUrl({
        url: url,
        method: "POST",
        headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: body.buffer as ArrayBuffer,
    });

    // 6. 返回结果
    const resData = await response.json;
    return {
        url: resData.url || "",           // 微信CDN链接
        media_id: resData.media_id || "", // 媒体ID
        errcode: resData.errcode || 0,
        errmsg: resData.errmsg || "",
    };
}
```

## 图片使用追踪系统

### 1. 使用记录管理 (`assets-manager.ts`)

```typescript
// 记录图片使用情况
public setUsed(media_id: string, url: string) {
    let v = this.used.get(media_id)
    if (v === undefined) {
        v = []
        this.used.set(media_id, v)
    }
    if (!v.includes(url)) {
        v.push(url)
    }
}

// 扫描内容中的图片使用
public scanUsedImageInContent(content: string, url: string) {
    const dom = sanitizeHTMLToDom(content)
    const imgs = dom.querySelectorAll('img')
    imgs.forEach(img => {
        const data_src = img.getAttribute('data-src')
        if (data_src !== null) {
            this.setUsed(data_src, url)
        }
    })
}
```

### 2. 图片复用逻辑

系统会追踪哪些图片已经上传过，避免重复上传：
- 通过`media_id`和`url`建立映射关系
- 记录图片在哪些文章中被使用
- 支持图片的复用和管理

## 特殊处理场景

### 1. 封面图片处理 (`mp-article-header.ts`)

```typescript
// 拖拽上传封面图片
const url = e.dataTransfer?.getData("text/uri-list");
if (url) {
    if (url.startsWith("obsidian://")) {
        // Obsidian内部图片
        const urlParser = new UrlUtils(this.plugin.app);
        const appurl = await urlParser.getInternalLinkDisplayUrl(url);
        this.cover_image = appurl;
    } else if (url.startsWith("http") || url.startsWith("https")) {
        // 外部链接图片
        this.cover_image = url;
        const media_id = await this.getCoverImageMediaId(url);
        // 保存media_id用于后续使用
    } else if (url.startsWith("file://")) {
        // 本地文件
        const filePath = url.replace("file://", "");
        // 处理本地文件路径
    }
}
```

### 2. AI生成图片处理

```typescript
// 从URL保存图片到Obsidian
public async saveImageFromUrl(url: string): Promise<string | null> {
    const currentFile = this.plugin.app.workspace.getActiveFile();
    if (!currentFile) return null;

    // 生成文件名
    const noteBasename = currentFile.basename;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_');
    const newFilename = `${noteBasename}_generated_${timestamp}.${ext || 'jpg'}`;
    
    try {
        // 下载图片
        const response = await requestUrl({url});
        const arrayBuffer = response.arrayBuffer;
        
        // 保存到Obsidian
        await this.plugin.app.vault.adapter.writeBinary(fullPath, arrayBuffer);
        
        return fullPath;
    } catch (error) {
        console.error('Error saving image:', error);
        return null;
    }
}
```

## 优化建议

### 1. 图片识别优化

**当前方案**：
```typescript
// 简单的字符串匹配
if (img.src.includes('://mmbiz.qpic.cn/')) {
    return; // 跳过微信图片
}
```

**建议改进**：
```typescript
// 更精确的微信图床识别
function isWeChatImage(src: string): boolean {
    const wechatDomains = [
        'mmbiz.qpic.cn',
        'mmbiz.qlogo.cn', 
        'res.wx.qq.com'
    ];
    
    try {
        const url = new URL(src);
        return wechatDomains.some(domain => url.hostname.includes(domain));
    } catch {
        return false;
    }
}
```

### 2. 图片缓存机制

**建议实现**：
```typescript
class ImageCache {
    private cache = new Map<string, {url: string, media_id: string, timestamp: number}>();
    
    // 根据图片内容hash缓存
    async getCachedImage(imageBlob: Blob): Promise<string | null> {
        const hash = await this.calculateHash(imageBlob);
        const cached = this.cache.get(hash);
        
        if (cached && this.isValid(cached.timestamp)) {
            return cached.url;
        }
        return null;
    }
    
    // 缓存上传结果
    setCachedImage(imageBlob: Blob, result: {url: string, media_id: string}) {
        const hash = this.calculateHash(imageBlob);
        this.cache.set(hash, {
            ...result,
            timestamp: Date.now()
        });
    }
}
```

### 3. 批量上传优化

**建议实现**：
```typescript
// 批量上传，减少API调用
async function batchUploadImages(images: HTMLImageElement[], wechatClient: WechatClient) {
    const BATCH_SIZE = 5; // 每批处理5张图片
    
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
        const batch = images.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(img => uploadSingleImage(img, wechatClient)));
        
        // 添加延迟避免API限制
        if (i + BATCH_SIZE < images.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}
```

## 🚨 实际问题分析

### 问题现象
用户测试发现：图床链接 `![image.png](http://lsky.xinqi.life:2052/up/2025/07/08/686c6f15515ef.png)` 被直接传递到微信公众号，而不是被下载并重新上传。

### 问题原因分析

#### 1. **上传函数确实存在且被调用**
```typescript
// 在 previewer.ts 的 sendArticleToDraftBox() 中
async sendArticleToDraftBox() {
    await uploadSVGs(this.articleDiv, this.plugin.wechatClient);
    await uploadCanvas(this.articleDiv, this.plugin.wechatClient);
    await uploadURLImage(this.articleDiv, this.plugin.wechatClient);  // 这里会被调用
    await uploadURLVideo(this.articleDiv, this.plugin.wechatClient);

    // 然后发送到草稿箱
    const media_id = await this.wechatClient.sendArticleToDraftBox(
        this.draftHeader.getActiveLocalDraft()!,
        this.getArticleContent()  // 获取处理后的HTML内容
    );
}
```

#### 2. **可能的执行失败原因**

**A. fetchImageBlob() 函数可能失败**
```typescript
// 在 utils.ts 中
export function fetchImageBlob(url: string): Promise<Blob> {
    return new Promise(async (resolve, reject) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            try {
                const response = await requestUrl(url);
                if (!response.arrayBuffer) {
                    console.error(`Failed to fetch image from ${url}`);
                    return; // ⚠️ 这里直接return，没有reject
                }
                const blob = new Blob([response.arrayBuffer]);
                resolve(blob);
            } catch (error) {
                console.error(`Error fetching image from ${url}:`, error);
                return; // ⚠️ 这里也是直接return，没有reject
            }
        }
    });
}
```

**问题**：当图片下载失败时，Promise既不resolve也不reject，导致上传流程中断。

**B. 跨域或网络问题**
- 图床服务器可能不允许跨域请求
- 网络超时或连接失败
- 图片URL无法访问

**C. 错误处理不完善**
```typescript
// 在 post-render.ts 中
if (blob === undefined){
    return  // 如果blob获取失败，直接返回，图片src不会被替换
}
```

#### 3. **时序问题**
可能存在异步执行时序问题：
- 图片上传还未完成，就已经调用了 `getArticleContent()`
- HTML内容在图片上传完成前就被发送到微信

### 解决方案

#### 1. **修复 fetchImageBlob 函数**
```typescript
export function fetchImageBlob(url: string): Promise<Blob> {
    return new Promise(async (resolve, reject) => {
        if (!url) {
            reject(new Error(`Invalid URL: ${url}`));
            return;
        }

        if (url.startsWith('http://') || url.startsWith('https://')) {
            try {
                const response = await requestUrl(url);
                if (!response.arrayBuffer) {
                    reject(new Error(`Failed to fetch image from ${url}`));
                    return;
                }
                const blob = new Blob([response.arrayBuffer]);
                resolve(blob);
            } catch (error) {
                reject(error);
            }
        } else {
            try {
                const blob = await fetch(url).then(response => response.blob());
                resolve(blob);
            } catch (error) {
                reject(error);
            }
        }
    });
}
```

#### 2. **增强错误处理和日志**
```typescript
export async function uploadURLImage(root: HTMLElement, wechatClient: WechatClient): Promise<void> {
    const images: HTMLImageElement[] = []
    root.querySelectorAll('img').forEach(img => {
        images.push(img)
    })

    console.log(`Found ${images.length} images to process`);

    const uploadPromises = images.map(async (img, index) => {
        console.log(`Processing image ${index + 1}: ${img.src}`);

        let blob: Blob | undefined
        if (img.src.includes('://mmbiz.qpic.cn/')) {
            console.log(`Skipping WeChat CDN image: ${img.src}`);
            return;
        }
        else if (img.src.startsWith('data:image/')) {
            blob = dataURLtoBlob(img.src);
            console.log(`Converted data URL to blob`);
        } else {
            try {
                blob = await fetchImageBlob(img.src);
                console.log(`Successfully fetched image blob from: ${img.src}`);
            } catch (error) {
                console.error(`Failed to fetch image from ${img.src}:`, error);
                return; // 保持原链接
            }
        }

        if (blob) {
            try {
                const res = await wechatClient.uploadMaterial(blob, imageFileName(blob.type));
                if (res && res.url) {
                    console.log(`Successfully uploaded image, new URL: ${res.url}`);
                    img.src = res.url; // 替换为微信CDN链接
                } else {
                    console.error(`Upload failed for image: ${img.src}`);
                }
            } catch (error) {
                console.error(`Error uploading image ${img.src}:`, error);
            }
        }
    })

    await Promise.all(uploadPromises);
    console.log(`Finished processing all images`);
}
```

#### 3. **添加上传状态检查**
```typescript
async sendArticleToDraftBox() {
    console.log('Starting image upload process...');

    await uploadSVGs(this.articleDiv, this.plugin.wechatClient);
    await uploadCanvas(this.articleDiv, this.plugin.wechatClient);
    await uploadURLImage(this.articleDiv, this.plugin.wechatClient);
    await uploadURLVideo(this.articleDiv, this.plugin.wechatClient);

    console.log('Image upload process completed');

    // 验证是否还有外部图片链接
    const remainingExternalImages = this.articleDiv.querySelectorAll('img[src^="http"]:not([src*="mmbiz.qpic.cn"])');
    if (remainingExternalImages.length > 0) {
        console.warn(`Warning: ${remainingExternalImages.length} external images were not uploaded`);
        remainingExternalImages.forEach((img, index) => {
            console.warn(`External image ${index + 1}: ${img.getAttribute('src')}`);
        });
    }

    const media_id = await this.wechatClient.sendArticleToDraftBox(
        this.draftHeader.getActiveLocalDraft()!,
        this.getArticleContent()
    );
}
```

## 总结

WeWrite的图片处理系统设计是完善的，但在实际执行中可能因为以下原因导致外部图片链接被直接传递：

### ❌ **实际问题**
1. **错误处理不完善**：fetchImageBlob失败时没有正确的Promise处理
2. **网络问题**：跨域限制或网络超时导致图片下载失败
3. **日志缺失**：难以调试和定位问题
4. **静默失败**：上传失败时没有明显的错误提示

### ✅ **解决方向**
1. **完善错误处理**：确保Promise正确处理成功和失败情况
2. **增加日志输出**：便于调试和问题定位
3. **添加状态检查**：验证图片上传是否真正完成
4. **用户反馈**：上传失败时给出明确提示

这解释了为什么用户会看到图床链接直接出现在微信公众号中，而不是被转换为微信CDN链接。
