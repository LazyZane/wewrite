/**
 * i18n module for WeWrite plugin
 */
import i18n from "i18next";
import { moment } from "obsidian";

import enUsTrans from "./locales/en-us.json";
import zhCnTrans from "./locales/zh-cn.json";
declare global {
	interface Window {
		$t: (key: string, options?: string[]) => string;
	}
}
i18n.init({
	debug: false,
	lng: moment.locale(), //obsidian language
	fallbackLng: "en", 
	interpolation: {
		escapeValue: false, 
	},
	resources: {
		en: {
			translation: enUsTrans,
		},
		zh: {
			translation: zhCnTrans,
		},
	},
});
export function $t(key: string, options?: string[]) {
	let result = i18n.t(key);
	if (options !== undefined) {
		for (let i = 0; i < options.length; i++) {
			result = result.replace(`{${i}}`, options[i]);
		}
	}
	return result;
}

window.$t = $t;

export default i18n;
