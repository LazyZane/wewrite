/** 
 * Procesing the image data for a valid WeChat MP article for upload.
 * 
 */
import { $t } from 'src/lang/i18n';
import { fetchImageBlob } from 'src/utils/utils';
import { WechatClient } from './../wechat-api/wechat-client';
import WeWritePlugin from 'src/main';
import { log } from 'console';
function imageFileName(mime:string){
    // 如果mime为空或无效，默认使用jpg
    if (!mime || mime === '' || !mime.includes('/')) {
        return `image-${new Date().getTime()}.jpg`;
    }

    const parts = mime.split('/');
    if (parts.length < 2) {
        return `image-${new Date().getTime()}.jpg`;
    }

    let type = parts[1];

    // 处理常见的mime类型映射
    const mimeMap: {[key: string]: string} = {
        'jpeg': 'jpg',
        'png': 'png',
        'gif': 'gif',
        'webp': 'webp',
        'bmp': 'bmp',
        'svg+xml': 'svg'
    };

    // 如果是已知类型，使用映射；否则默认jpg
    const extension = mimeMap[type] || 'jpg';

    return `image-${new Date().getTime()}.${extension}`;
}
export function svgToPng(svgData: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 1;
            canvas.width = img.width * dpr;
            canvas.height = img.height * dpr;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error($t('render.faild-canvas-context')));
                return;
            }
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error($t('render.failed-to-convert-canvas-to-blob')));
                }
            }, 'image/png');
        };

        img.onerror = (error) => {
            reject(error);
        };

         const encoder = new TextEncoder();
         const uint8Array = encoder.encode(svgData);
         const latin1String = String.fromCharCode.apply(null, uint8Array);
         img.src = `data:image/svg+xml;base64,${btoa(latin1String)}`;
    });
}

function dataURLtoBlob(dataUrl: string): Blob {
    const parts = dataUrl.split(';base64,');
	console.log('parts:', parts);
	
    const contentType = parts[0].split(':')[1];
	console.log('contentType', contentType);
	
    const raw = window.atob(parts[1]);
	console.log('raw:', raw);
    const rawLength = raw.length;

    const uInt8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }
	log('uInt8Array byteLength:', uInt8Array.byteLength);
    return new Blob([uInt8Array], { type: contentType });
}
export function getCanvasBlob(canvas: HTMLCanvasElement) {
    const pngDataUrl = canvas.toDataURL('image/png');
    const pngBlob = dataURLtoBlob(pngDataUrl);
    return pngBlob;
}

export async function uploadSVGs(root: HTMLElement, wechatClient: WechatClient){
    const svgs: SVGSVGElement[] = []
    root.querySelectorAll('svg').forEach(svg => {
        svgs.push(svg)
    })

    const uploadPromises = svgs.map(async (svg) => {
        const svgString = svg.outerHTML;
        if (svgString.length < 10000) {
            return
        }
        await svgToPng(svgString).then(async blob => {
            await wechatClient.uploadMaterial(blob, imageFileName(blob.type)).then(res => {
                if (res){
                    svg.outerHTML = `<img src="${res.url}" />`
                }else{
                    console.error(`upload svg failed.`);
                }
            })
        })
    })
	
    await Promise.all(uploadPromises)
}
export async function uploadCanvas(root:HTMLElement, wechatClient:WechatClient):Promise<void>{
    const canvases: HTMLCanvasElement[] = []
    
    root.querySelectorAll('canvas').forEach (canvas => {
        canvases.push(canvas)
    })
    
    const uploadPromises = canvases.map(async (canvas) => {
        const blob = getCanvasBlob(canvas);
        await wechatClient.uploadMaterial(blob, imageFileName(blob.type)).then(res => {
            if (res){
                canvas.outerHTML = `<img src="${res.url}" />`
            }else{
            }
        })
    })
    await Promise.all(uploadPromises)
}

export async function uploadURLImage(root:HTMLElement, wechatClient:WechatClient):Promise<void>{
    const images: HTMLImageElement[] = []

    root.querySelectorAll('img').forEach (img => {
        images.push(img)
    })

    const uploadPromises = images.map(async (img, index) => {
        const originalSrc = img.src;
        let blob:Blob|undefined

        // 跳过微信图床图片
        if (img.src.includes('://mmbiz.qpic.cn/')){
            return;
        }

        // 处理Base64图片
        else if (img.src.startsWith('data:image/')){
            blob = dataURLtoBlob(img.src);
        }

        // 处理外部链接图片
        else{
            try {
                blob = await fetchImageBlob(img.src);
            } catch (error) {
                console.error(`[WeWrite] Failed to fetch image from ${originalSrc}:`, error);
                return; // 保持原链接，不进行上传
            }
        }

        // 上传到微信
        if (blob === undefined){
            return;
        }

        try {
            const res = await wechatClient.uploadMaterial(blob, imageFileName(blob.type));

            if (res && res.url){
                img.src = res.url; // 替换为微信CDN链接
                // 添加data属性记录原始链接
                img.setAttribute('data-original-src', originalSrc);
            } else {
                const errorCode = res && typeof res === 'object' ? res.errcode : 'unknown';
                const errorMsg = res && typeof res === 'object' ? res.errmsg : 'unknown';
                console.error(`[WeWrite] Upload failed for image: ${originalSrc}, error code: ${errorCode}, message: ${errorMsg}`);
            }
        } catch (error) {
            console.error(`[WeWrite] Error uploading image ${originalSrc}:`, error);
        }
    })

    await Promise.all(uploadPromises);

    // 验证上传结果
    const remainingExternalImages = root.querySelectorAll('img[src^="http"]:not([src*="mmbiz.qpic.cn"])');
    if (remainingExternalImages.length > 0) {
        console.warn(`[WeWrite] Warning: ${remainingExternalImages.length} external images were not uploaded successfully`);
    }
}
// export async function uploadURLBackgroundImage(root:HTMLElement, wechatClient:WechatClient):Promise<void>{
//     const bgEls: Map<string, HTMLElement>  = new Map()
//     root.querySelectorAll('*').forEach(el => {
// 		const style = window.getComputedStyle(el);
// 		const bg = style.getPropertyValue('background-image');
// 		console.log('uploadURLBGImage=>', bg);
// 		if (bg && bg !== 'none') {
// 			const match = bg.match(/url\(["']?(.*?)["']?\)/);
// 			if (match && match[1]) {
// 				bgEls.set(match[1], el as HTMLElement);
// 			}
// 		}
	
// 	});
//     console.log('-----------------------------------')
//     const uploadPromises = bgEls.forEach((async (el, src) => {
// 		log('uploadURLBGImage eachEls =>', src, el);
//         let blob:Blob|undefined 
//         if (src.includes('://mmbiz.qpic.cn/')){
//             return;
//         }
//         else if (src.startsWith('data:image/')){
// 			console.log('src=>', src);
			
//             blob = dataURLtoBlob(src);
//         }else{
//             // blob = await fetch(img.src).then(res => res.blob());
//             blob = await fetchImageBlob(src)
//         }
        
//         if (blob === undefined){
//             console.error(`upload image failed. blob is undefined.`);
//             return
            
//         }else{
// 			log('uploading blob...', blob.size, blob.type)
//             await wechatClient.uploadMaterial(blob, imageFileName(blob.type)).then(res => {
//                 if (res){
//                     el.style.setProperty("background-image", `url("${res.url}")`)
//                 }else{
//                     console.error(`upload image failed.`);
                    
//                 }
//             })
//         }
//     }))
//     // await Promise.all(uploadPromises)
// }
export async function uploadURLVideo(root:HTMLElement, wechatClient:WechatClient):Promise<void>{
    const videos: HTMLVideoElement[] = []
    
    root.querySelectorAll('video').forEach (video => {
        videos.push(video)
    })
    
    const uploadPromises = videos.map(async (video) => {
        let blob:Blob|undefined 
        if (video.src.includes('://mmbiz.qpic.cn/')){
            return;
        }
        else if (video.src.startsWith('data:image/')){
            blob = dataURLtoBlob(video.src);
        }else{
            blob = await fetchImageBlob(video.src)
        }
        
        if (blob === undefined){
            return
            
        }else{
			
            await wechatClient.uploadMaterial(blob, imageFileName(blob.type), 'video').then(async res => {
                if (res){
					const video_info = await wechatClient.getMaterialById(res.media_id)
					video.src = video_info.url
                }else{
                    console.error(`upload video failed.`);
                    
                }
            })
        }
    })
    await Promise.all(uploadPromises)
}
