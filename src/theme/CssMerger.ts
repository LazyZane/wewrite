/**
 * to build custom css for wewrite.
 * author: Learner Chen <learner.chen@icloud.com>
 * date: 2025-05-10
 */

import postcss from 'postcss';

import $00 from '../assets/default-styles/00_wewrite.css';
import $01 from '../assets/default-styles/01_layout.css';
import $02 from '../assets/default-styles/02_icons.css';
import $03 from '../assets/default-styles/03_typography.css';
import $04 from '../assets/default-styles/04_paragragh.css';
import $05 from '../assets/default-styles/05_strong.css';
import $06 from '../assets/default-styles/06_em.css';
import $07 from '../assets/default-styles/07_u.css';
import $08 from '../assets/default-styles/08_del.css';
import $09 from '../assets/default-styles/09_codespan.css';
import $09_5 from '../assets/default-styles/09_5_highlight.css';
import $10 from '../assets/default-styles/10_heading.css';
import $11  from '../assets/default-styles/11_h1.css';
import $12 from '../assets/default-styles/12_h2.css';
import $13 from '../assets/default-styles/13_h3.css';
import $14 from '../assets/default-styles/14_h4.css';
import $15 from '../assets/default-styles/15_h5.css';
import $16 from '../assets/default-styles/16_h6.css';
import $20 from '../assets/default-styles/20_image.css';
import $21 from '../assets/default-styles/21_list.css';
import $23 from '../assets/default-styles/23_footnote.css';
import $24 from '../assets/default-styles/24_table.css';
import $25 from '../assets/default-styles/25_code.css';
import $26 from '../assets/default-styles/26_blockquote.css';
import $27 from '../assets/default-styles/27_links.css';
import $30 from '../assets/default-styles/30_callout.css';
import $31 from '../assets/default-styles/31_admonition.css';
import $32 from '../assets/default-styles/32_math.css';
import $33 from '../assets/default-styles/33_mermaid.css';
import $34 from '../assets/default-styles/34_chart.css';
import $35 from '../assets/default-styles/35_icon.css';
import $40 from '../assets/default-styles/40_summary.css';
import $50 from '../assets/default-styles/50_profile.css';
import { Notice } from 'obsidian';
import { $t } from 'src/lang/i18n';

const baseCSS = [
	$00,
	$01,
	$02,
	$03,
	$04,
	$05,
	$06,
	$07,
	$08,
	$09,
	$09_5,
	$10,
	$11,
	$12,
	$13,
	$14,
	$15,
	$16,
	$20,
	$21,
	$23,
	$24,
	$25,
	$26,
	$27,
	$30,
	$31,
	$32,
	$33,
	$34,
	$35,
	$09,
	$40,
	$50
]

const RESERVED_CLASS_PREFIX = [
	'appmsg_',
	'wx_',
	'wx-',
	'common-webchat',
	'weui-',
	'wewrite-' // 保留所有wewrite-开头的类名
]

const isClassReserved = (className: string) => {
	return RESERVED_CLASS_PREFIX.some(prefix => className.startsWith(prefix));
}	

type Rule = Map<string, postcss.Declaration>;
type Rules = Map<string, Rule>;

export class CSSMerger {
	baseAST: postcss.Root | undefined;
	overrideAST: postcss.Root | undefined;
	vars: Map<string, string> = new Map()
	rules: Rules = new Map()


	async init(customCSS: string) {
		await this.buildBaseCSS();
		try {
			const ast = (await postcss().process(customCSS, { from: undefined })).root;
			this.pickVariables(ast, this.vars);
			this.pickRules(ast, this.rules);
		}catch(e) {
			new Notice($t('render.failed-to-parse-custom-css', [e]));
			console.error(e);
		}

	}
	async buildBaseCSS() {
		this.vars.clear();
		this.rules.clear();
		for (const css of baseCSS) {
			const ast = (await postcss().process(css, { from: undefined })).root;
			this.pickVariables(ast, this.vars);
			this.pickRules(ast, this.rules);
		}
	}
	private resolveCssVars(value: string, vars: Map<string, string>, depth = 0): string {
		const MAX_DEPTH = 10; // 防止无限循环
		const varRegex = /var\(\s*--([\w-]+)(?:\s*,\s*((?:\((?:[^()]|\([^()]*\))*\)|[^)\s]|[\s\S])*?))?\s*\)/g;
		let result = value;
		let replaced: boolean;

		do {
			replaced = false;

			result = result.replace(varRegex, (_match, varName: string, fallback: string | undefined) => {

				const fullKey = `--${varName}`;
				if (vars.has(fullKey)) {
					const replacement = vars.get(fullKey)!;
					replaced = true;
					return replacement;
				} else if (fallback !== undefined) {
					replaced = true;
					return fallback;
				} else {
					console.warn(`Variable ${fullKey} not found and no fallback provided`);
					return '';
				}
			});

			depth++;
		} while (replaced && depth < MAX_DEPTH);

		return result;
	}

	private pickRules(root: postcss.Root, rules: Rules): void {
		root.walkRules(rule => {
			if (rule.selector !== ':root') {
				let selectedRule = rules.get(rule.selector);
				if (!selectedRule) {
					selectedRule = new Map();
					rules.set(rule.selector, selectedRule);
				}
				rule.walkDecls(decl => {
					const baseDecl = selectedRule.get(decl.prop);

					if (baseDecl === undefined || !baseDecl.important || decl.important) {
						selectedRule.set(decl.prop, decl);
					} else {
					}
				})
			}
		})
	}
	private pickVariables(root: postcss.Root, vars: Map<string, string>): void {
		root.walkRules(rule => {
			if (rule.selector === ':root') {
				rule.walkDecls(decl => {
					if (decl.prop.startsWith('--')) {
						vars.set(decl.prop, decl.value);
					}
				});
			}
		})
	}

	applyStyleToElement(currentNode: HTMLElement, isRoot: boolean = true) {
		// 如果是根调用，将CSS变量应用到传入的根元素上
		if (isRoot) {
			this.vars.forEach((value, prop) => {
				currentNode.style.setProperty(prop, value);
				console.log(`[WeWrite] 应用CSS变量到根元素: ${prop} = ${value}`);
			});
		}

		this.rules.forEach((rule, selector) => {
			try {
				if (currentNode.matches(selector)) {
					rule.forEach((decl, prop) => {
						let value = this.resolveCssVars(decl.value, this.vars);
						currentNode.style.setProperty(prop, decl.important ? value + ' !important' : value);
					})
				}
			} catch (error) {
				console.log('error selector=>', selector, ' | Error=>', error.message);
			}
		})
		let element = currentNode.firstElementChild;
		while (element) {
			this.applyStyleToElement(element as HTMLElement, false); // 递归调用时不是根元素
			element = element.nextElementSibling;
		}
		return currentNode;
	}
	removeClassName(root: HTMLElement) {
		const className = root.getAttribute('class');
		if (className) {
			const classes = className.split(' ');
			for (const c of classes) {
				if (isClassReserved(c)) {
					continue;
				}
				root.classList.remove(c);
			}
		}
		root.removeAttribute('class');
		let element = root.firstElementChild;
		while (element) {
			this.removeClassName(element as HTMLElement);
			element = element.nextElementSibling;
		}
	}
}
