/** message slot for internal communication */
import { SrcThumbList } from "./src-thumb-list";

export type MSG_TYPE  = 
  'src-thumb-list-updated' | 
  'material-updated' | 
  'wechat-account-changed' |
  'selected-theme-changed' |
  'draft-title-updated' |
  'active-file-changed' |
  'wechat-material-updated' |
  'clear-draft-list' |
  'clear-news-list' |
  'clear-image-list' |
  'clear-video-list' |
  'clear-voice-list' |
  'clear-thumb-list' |
  'draft-item-updated' |
  'draft-item-deleted' |
  'news-item-updated' |
  'news-item-deleted' |
  'image-item-updated' |
  'image-item-deleted' |
  'video-item-updated' |
  'video-item-deleted' |
  'voice-item-updated' |
  'voice-item-deleted' |
  'image-used-updated' |
  'thumb-item-updated' |
  'thumb-item-deleted' |
  'custom-theme-changed' |
  'set-draft-cover-image' |
  'set-image-as-cover' |
  'delete-media-item' |
  'delete-draft-item' |
  'publish-draft-item' |
  'custom-theme-folder-changed' |
  'image-generated' |
  'show-spinner' | 
  'hide-spinner'

  

export class MessageService {
    private listeners: Map<string, ((data: SrcThumbList | null | any) => void)[]> = new Map();
  
    registerListener(msg:MSG_TYPE, listener: ( data: SrcThumbList | null | any) => void) {
      const listeners = this.listeners.get(msg)
      if (listeners == undefined || listeners === null) {
        this.listeners.set(msg, [listener]);
      }else{
        listeners.push(listener);
      }
    }
  
    sendMessage(msg:MSG_TYPE, data: SrcThumbList | null | any) {
      const listeners = this.listeners.get(msg)
      if (listeners == undefined || listeners === null) {
        return;
      }else{
        listeners.forEach(listener => listener(data));
      }
    }
  }
