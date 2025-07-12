/**
 * 开头结尾设置组件
 */

import { Setting, TextAreaComponent, TextComponent, ToggleComponent } from "obsidian";
import { HeaderFooterTemplate } from "./wewrite-setting";
import { processTemplate, mergeVariables, validateTemplate, PREDEFINED_VARIABLES } from "../utils/template-engine";

export class HeaderFooterSettingsComponent {
    private containerEl: HTMLElement;
    private headerTemplate: HeaderFooterTemplate;
    private footerTemplate: HeaderFooterTemplate;
    private onSave: (headerTemplate: HeaderFooterTemplate, footerTemplate: HeaderFooterTemplate) => void;

    constructor(
        containerEl: HTMLElement,
        headerTemplate: HeaderFooterTemplate,
        footerTemplate: HeaderFooterTemplate,
        onSave: (headerTemplate: HeaderFooterTemplate, footerTemplate: HeaderFooterTemplate) => void
    ) {
        this.containerEl = containerEl;
        this.headerTemplate = { ...headerTemplate };
        this.footerTemplate = { ...footerTemplate };
        this.onSave = onSave;
    }

    display(): void {
        this.createHeaderSection();
        this.createFooterSection();
        this.createVariablesReference();
    }

    private createHeaderSection(): void {
        // 开头设置标题
        new Setting(this.containerEl)
            .setName("开头内容设置")
            .setHeading()
            .setDesc("为文章自动添加个性化开头内容");

        // 开头启用开关
        new Setting(this.containerEl)
            .setName("启用自定义开头")
            .setDesc("发布时自动在文章开头添加个性化内容")
            .addToggle((toggle: ToggleComponent) => {
                toggle
                    .setValue(this.headerTemplate.enabled)
                    .onChange((value) => {
                        this.headerTemplate.enabled = value;
                        this.onSave(this.headerTemplate, this.footerTemplate);
                        this.refreshPreview('header');
                    });
            });

        // 开头模板编辑
        new Setting(this.containerEl)
            .setName("开头模板")
            .setDesc("支持变量语法：{{variableName}}，如 {{brandName}}、{{tagline}} 等")
            .addTextArea((textArea: TextAreaComponent) => {
                textArea
                    .setPlaceholder("输入开头模板内容...")
                    .setValue(this.headerTemplate.template)
                    .onChange((value) => {
                        this.headerTemplate.template = value;
                        this.onSave(this.headerTemplate, this.footerTemplate);
                        this.refreshPreview('header');
                    });
                textArea.inputEl.rows = window.innerWidth <= 768 ? 4 : 6;
                textArea.inputEl.style.width = "100%";
                textArea.inputEl.style.fontSize = window.innerWidth <= 480 ? "14px" : "16px";
            });

        // 开头变量设置
        this.createVariableSettings('header', this.headerTemplate);

        // 开头预览
        this.createPreview('header');
    }

    private createFooterSection(): void {
        // 结尾设置标题
        new Setting(this.containerEl)
            .setName("结尾内容设置")
            .setHeading()
            .setDesc("为文章自动添加个性化结尾内容");

        // 结尾启用开关
        new Setting(this.containerEl)
            .setName("启用自定义结尾")
            .setDesc("发布时自动在文章结尾添加个性化内容")
            .addToggle((toggle: ToggleComponent) => {
                toggle
                    .setValue(this.footerTemplate.enabled)
                    .onChange((value) => {
                        this.footerTemplate.enabled = value;
                        this.onSave(this.headerTemplate, this.footerTemplate);
                        this.refreshPreview('footer');
                    });
            });

        // 结尾模板编辑
        new Setting(this.containerEl)
            .setName("结尾模板")
            .setDesc("支持变量语法：{{variableName}}，如 {{callToAction}}、{{contactInfo}} 等")
            .addTextArea((textArea: TextAreaComponent) => {
                textArea
                    .setPlaceholder("输入结尾模板内容...")
                    .setValue(this.footerTemplate.template)
                    .onChange((value) => {
                        this.footerTemplate.template = value;
                        this.onSave(this.headerTemplate, this.footerTemplate);
                        this.refreshPreview('footer');
                    });
                textArea.inputEl.rows = window.innerWidth <= 768 ? 4 : 6;
                textArea.inputEl.style.width = "100%";
                textArea.inputEl.style.fontSize = window.innerWidth <= 480 ? "14px" : "16px";
            });

        // 结尾变量设置
        this.createVariableSettings('footer', this.footerTemplate);

        // 结尾预览
        this.createPreview('footer');
    }

    private createVariableSettings(type: 'header' | 'footer', template: HeaderFooterTemplate): void {
        const variables = type === 'header' 
            ? ['brandName', 'tagline', 'headerImage']
            : ['callToAction', 'contactInfo', 'footerImage'];

        variables.forEach(varName => {
            const displayName = PREDEFINED_VARIABLES[varName as keyof typeof PREDEFINED_VARIABLES] || varName;
            
            new Setting(this.containerEl)
                .setName(displayName)
                .setDesc(`设置变量 {{${varName}}} 的值`)
                .addText((text: TextComponent) => {
                    text
                        .setPlaceholder(`输入${displayName}...`)
                        .setValue(template.variables[varName] || '')
                        .onChange((value) => {
                            template.variables[varName] = value;
                            this.onSave(this.headerTemplate, this.footerTemplate);
                            this.refreshPreview(type);
                        });
                    text.inputEl.style.width = "100%";
                    text.inputEl.style.fontSize = window.innerWidth <= 480 ? "14px" : "16px";
                });
        });
    }

    private createPreview(type: 'header' | 'footer'): void {
        const template = type === 'header' ? this.headerTemplate : this.footerTemplate;
        const previewId = `${type}-preview`;
        
        const previewSetting = new Setting(this.containerEl)
            .setName(`${type === 'header' ? '开头' : '结尾'}预览`)
            .setDesc("实时预览模板效果");

        const previewDiv = previewSetting.settingEl.createDiv({
            cls: `wewrite-template-preview ${previewId}`,
        });
        previewDiv.style.cssText = `
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            padding: 1em;
            margin-top: 0.5em;
            background: var(--background-secondary);
            font-family: var(--font-text);
            white-space: pre-wrap;
            max-height: 200px;
            overflow-y: auto;
        `;

        this.refreshPreview(type);
    }

    private refreshPreview(type: 'header' | 'footer'): void {
        const template = type === 'header' ? this.headerTemplate : this.footerTemplate;
        const previewEl = this.containerEl.querySelector(`.${type}-preview`) as HTMLElement;
        
        if (!previewEl) return;

        if (!template.enabled) {
            previewEl.textContent = `${type === 'header' ? '开头' : '结尾'}功能已禁用`;
            previewEl.style.opacity = '0.5';
            return;
        }

        previewEl.style.opacity = '1';

        // 验证模板
        const validation = validateTemplate(template.template);
        if (!validation.valid) {
            previewEl.innerHTML = `<span style="color: var(--text-error);">模板错误：${validation.errors.join(', ')}</span>`;
            return;
        }

        // 处理模板
        const mergedVariables = mergeVariables(template.variables);
        const processedContent = processTemplate(template.template, mergedVariables);
        
        if (processedContent.trim()) {
            previewEl.textContent = processedContent;
        } else {
            previewEl.textContent = '模板为空';
            previewEl.style.opacity = '0.5';
        }
    }

    private createVariablesReference(): void {
        new Setting(this.containerEl)
            .setName("变量参考")
            .setHeading()
            .setDesc("可在模板中使用的变量列表");

        const referenceDiv = this.containerEl.createDiv({
            cls: "wewrite-variables-reference",
        });
        referenceDiv.style.cssText = `
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            padding: 1em;
            background: var(--background-secondary);
            font-family: var(--font-monospace);
            font-size: 0.9em;
        `;

        const variablesList = Object.entries(PREDEFINED_VARIABLES)
            .map(([key, desc]) => `{{${key}}} - ${desc}`)
            .join('\n');

        referenceDiv.innerHTML = `
            <div style="margin-bottom: 0.5em; font-weight: bold;">预定义变量：</div>
            <div style="white-space: pre-line; line-height: 1.4;">${variablesList}</div>
            <div style="margin-top: 1em; font-size: 0.8em; opacity: 0.7;">
                提示：{{currentDate}} 和 {{currentTime}} 会自动填充当前日期时间
            </div>
        `;
    }
}
