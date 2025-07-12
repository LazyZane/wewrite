/**
 * Draft Manager 
 * 
 * - manage the local parameters for WeChat Article rendering parameters
 * - support multi-account switch
 * 
 */

import WeWritePlugin from "src/main";
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import { areObjectsEqual } from "src/utils/utils";
import { $t } from "src/lang/i18n";
PouchDB.plugin(PouchDBFind);



export type LocalDraftItem = {
    accountName?: string;
    notePath?: string; //obsidan file path for the note. 
    theme?: string; // the theme selected for rendering. missing will use default theme.
    cover_image_url?: string; // the cover image url for the article. could be a obsidian file path or url 
    _id?: string;
    _rev?: string;
    title: string;
    author?: string;
    digest?: string;
    content?: string;
    content_source_url?: string;
    thumb_media_id?: string;
    show_cover_pic?: number;
    need_open_comment?: number;
    only_fans_can_comment?: number;
    pic_crop_235_1?: string; //X1_Y1_X2_Y2, 用分隔符_拼接为X1_Y1_X2_Y2  
    pic_crop_1_1?: string; //X1_Y1_X2_Y2, 用分隔符_拼接为X1_Y1_X2_Y2
    last_draft_url?: string; //	草稿的临时链接
    last_draft_id?: string; //

}

export const initDraftDB = () => {
	try {
		console.log('[WeWrite] Initializing Draft PouchDB...');

		// 移动端特殊配置
		const isMobile = (window as any).app?.isMobile || false;
		const dbOptions: any = {
			name: 'wewrite-local-drafts'
		};

		if (isMobile) {
			console.log('[WeWrite] Applying mobile-specific Draft PouchDB configuration...');
			dbOptions.adapter = 'idb';
			dbOptions.auto_compaction = true;
		}

		const db = new PouchDB(dbOptions);
		console.log('[WeWrite] Draft PouchDB initialized successfully');
		return db;
	} catch (error) {
		console.error('[WeWrite] Failed to initialize Draft PouchDB:', error);

		// 移动端降级处理
		const isMobile = (window as any).app?.isMobile || false;
		if (isMobile) {
			console.log('[WeWrite] Attempting mobile fallback for Draft DB...');
			try {
				const fallbackDb = new PouchDB('wewrite-local-drafts', { adapter: 'memory' });
				console.log('[WeWrite] Mobile fallback Draft PouchDB initialized');
				return fallbackDb;
			} catch (fallbackError) {
				console.error('[WeWrite] Mobile Draft fallback also failed:', fallbackError);
			}
		}

		throw new Error(`Draft database initialization failed: ${error.message}`);
	}
}
export class LocalDraftManager {
    private plugin: WeWritePlugin;
    private db: PouchDB.Database;
    private static instance: LocalDraftManager;
    private constructor(plugin: WeWritePlugin) {
        this.plugin = plugin;
        this.db = initDraftDB();
    }
    public static getInstance(plugin: WeWritePlugin): LocalDraftManager {
        if (!LocalDraftManager.instance) {
            LocalDraftManager.instance = new LocalDraftManager(plugin);
        }
        return LocalDraftManager.instance;
    }
    public async getDrafOfActiveNote() {
        let draft: LocalDraftItem | undefined

        const accountName = this.plugin.settings.selectedMPAccount;
        if (accountName !== undefined && accountName) {
            const f = this.plugin.app.workspace.getActiveFile()
			
            if (f) {
                draft = await this.getDraft(accountName, f.path)
				
                if (draft === undefined) {
                    draft = {
                        accountName: accountName,
                        notePath: f.path,
                        title: f.basename,
                        _id: accountName + f.path
                    }
                    await this.setDraft(draft)

                }
				if (draft.title.trim() === ''){
					draft.title = f.basename
					await this.setDraft(draft)
				}
            }
        }
        return draft
    }
    public isActiveNoteDraft(draft: LocalDraftItem | undefined) {
        const activeFile = this.plugin.app.workspace.getActiveFile()
        if (draft === undefined && activeFile === null) {
            return true
        }
        if (draft !== undefined && activeFile) {
            return draft.notePath === activeFile.path
        }
        return false
    }
    public async getDraft(accountName: string, notePath: string): Promise<LocalDraftItem | undefined> {
        return new Promise((resolve) => {
            this.db.get(accountName + notePath)
                .then((doc) => {
                    resolve(doc as LocalDraftItem)
                })
                .catch((err) => {
                    resolve(undefined)
                })

        })
    }

    public async setDraft(doc: LocalDraftItem): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!doc.accountName || !doc.notePath) {
                return reject(new Error($t('assets.invalid-draft')));
            }

            if (!doc._id) {
                doc._id = doc.accountName + doc.notePath;
            }

            this.db.get(doc._id)
                .then(existedDoc => {
                    const existingDraft = existedDoc as LocalDraftItem;
                    if (areObjectsEqual(doc, existingDraft)) {
                        // No changes needed
                        resolve(true);
                        return;
                    }
                    else {
                        doc._rev = existedDoc._rev;
                        return this.db.put(doc)
                            .then(() => resolve(true))
                            .catch(error => {
                                resolve(false);
                            });
                    }
                    // No changes needed
                    resolve(false);
                })
                .catch(error => {
                    if (error.status === 404) {
                        // New document
                        return this.db.put(doc)
                            .then(() => resolve(true))
                            .catch(err => {
                                console.error('Error creating new draft:', err);
                                reject(err);
                            });
                    }
                    console.error('Error checking existing draft:', error);
                    reject(error);
                });
        });
    }
}
