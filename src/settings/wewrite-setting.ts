/*
manage the wechat account settings

*/
import PouchDB from 'pouchdb';
import { areObjectsEqual } from 'src/utils/utils';

export type WeChatAccountInfo = {
    _id?: string;
    accountName: string;
    appId: string;
    appSecret: string;
    access_token?: string;
    expires_in?: number;
    lastRefreshTime?: number;
    isTokenValid?: boolean;
    doc_id?: string;
}

export type AIChatAccountInfo = {
    _id?: string;
    accountName: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    doc_id?: string;
}
export type AITaskAccountInfo = {
    _id?: string;
    accountName: string;
    baseUrl: string;
    taskUrl: string;
    apiKey: string;
    model: string;
    doc_id?: string;
}

// export type WeWriteAccountInfo = WeChatAccountInfo | AIChatAccountInfo | AITaskAccountInfo;
// 开头结尾模板配置
export type HeaderFooterTemplate = {
    enabled: boolean;
    template: string;
    variables: {
        brandName?: string;
        tagline?: string;
        headerImage?: string;
        footerImage?: string;
        callToAction?: string;
        contactInfo?: string;
        [key: string]: string | undefined;
    };
}

export type WeWriteSetting = {
	useCenterToken: boolean;
    realTimeRender: boolean;
    previewer_wxname?: string;
    custom_theme?: string;
    codeLineNumber: boolean;
    css_styles_folder: string;
    _id?: string; // = 'wewrite-setting';
    _rev?: string;
    ipAddress?: string;
    selectedMPAccount?: string;
    selectedChatAccount?: string;
    selectedDrawAccount?: string;
    mpAccounts: Array<WeChatAccountInfo>;
    chatAccounts: Array<AIChatAccountInfo>;
    drawAccounts: Array<AITaskAccountInfo>;
    accountDataPath: string;
	chatSetting: ChatSetting;
    // 开头结尾配置
    headerTemplate?: HeaderFooterTemplate;
    footerTemplate?: HeaderFooterTemplate;
}

export type ChatSetting = {
    _id?: string;
    _rev?: string;
	chatSelected?: string;
	modelSelected?: string;
	temperature?: number;
	top_p?: number;
	frequency_penalty?: number;
	presence_penalty?: number;
	max_tokens?: number;
}

export const initWeWriteDB = () => {
	try {
		console.log('[WeWrite] Initializing PouchDB...');

		// 移动端特殊配置
		const isMobile = (window as any).app?.isMobile || false;
		const dbOptions: any = {
			name: 'wewrite-settings'
		};

		if (isMobile) {
			console.log('[WeWrite] Applying mobile-specific settings PouchDB configuration...');
			dbOptions.adapter = 'idb';
			dbOptions.auto_compaction = true;
		}

		const db = new PouchDB(dbOptions);
		console.log('[WeWrite] PouchDB initialized successfully');
		return db;
	} catch (error) {
		console.error('[WeWrite] Failed to initialize PouchDB:', error);

		// 移动端降级处理
		const isMobile = (window as any).app?.isMobile || false;
		if (isMobile) {
			console.log('[WeWrite] Attempting mobile fallback for settings DB...');
			try {
				const fallbackDb = new PouchDB('wewrite-settings', { adapter: 'memory' });
				console.log('[WeWrite] Mobile fallback settings PouchDB initialized');
				return fallbackDb;
			} catch (fallbackError) {
				console.error('[WeWrite] Mobile settings fallback also failed:', fallbackError);
			}
		}

		throw new Error(`Database initialization failed: ${error.message}`);
	}
}
// Create a new database
const db = initWeWriteDB();


export const getWeWriteSetting = async (): Promise<WeWriteSetting | undefined> => {
    return new Promise((resolve, reject) => {
        db.get('wewrite-settings')
            .then((doc: any) => {
                resolve(doc);
            })
            .catch((error: any) => {
                console.info('Error getting WeWriteSetting:', error);
                resolve(undefined)
            });
    })
}

export const saveWeWriteSetting = async (doc: WeWriteSetting): Promise<void> => {
    return new Promise((resolve, reject) => {
        doc._id = 'wewrite-settings';
        db.get(doc._id).then(existedDoc => {
            if (areObjectsEqual(doc, existedDoc)) {
                resolve()
            }
            doc._rev = existedDoc._rev;
            db.put(doc)
                .then(() => {
                    resolve();
                })
                .catch((error: any) => {
                    console.error('Error setting WeWriteSetting:', error);
                    resolve()
                });
        }).catch(error => {
            db.put(doc)
                .then(() => {
                    resolve();
                })
                .catch((error: any) => {
                    console.error('Error setting WeWriteSetting:', error);
                    resolve()
                });
        })
    })
}
