/**
 * a dialog modal to confirm the delete action
 * 
*/

import { Modal } from 'obsidian';
import { $t } from 'src/lang/i18n';
import WeWritePlugin from 'src/main';
import { MaterialItem } from '../wechat-api/wechat-types';

export class ConfirmDeleteModal extends Modal {
    plugin: WeWritePlugin;
    item: MaterialItem;
    callback: (item: MaterialItem) => void
    constructor(plugin: WeWritePlugin, item: MaterialItem, callback: (item: MaterialItem) => void) {
        super(plugin.app);
        this.plugin = plugin;
        this.item = item
        this.callback = callback
    }

    update(item: MaterialItem, callback: (item: MaterialItem) => void) {
        this.item = item
        this.callback = callback
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('confirm-pulbish-dialog-content')

        contentEl.createEl('h3', { text:$t('modals.delete.title')});
        const content = contentEl.createDiv({ cls: 'description' })
        content.createEl('p', { text: $t('modals.delete.message') });
        content.createEl('p', { text: $t('modals.delete.warning')});
        content.createEl('p', { text: $t('modals.delete.action')});
        content.createEl('p', { text: $t('modals.caution') });
        
        const toolbar = contentEl.createDiv({ cls: 'confirm-pulbish-dialog-tool-bar' })
        const confirmButton = toolbar.createEl('button', { 
            text: $t('modals.confirm'),
            cls: "danger-button"
        });
        const cancelButton = toolbar.createEl('button', { 
            text: $t('modals.cancel')
        });

        confirmButton.addEventListener('click', () => {
            this.delete();
            this.close();
        });

        cancelButton.addEventListener('click', () => {
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
    delete() {
        if (this.callback) {
            this.callback(this.item)
        }
    }
}
