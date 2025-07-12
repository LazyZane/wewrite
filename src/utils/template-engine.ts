/**
 * 模板变量替换引擎
 * 支持 {{variableName}} 语法的变量替换
 */

export interface TemplateVariables {
    [key: string]: string | undefined;
}

/**
 * 处理模板字符串，替换其中的变量
 * @param template 模板字符串，支持 {{variableName}} 语法
 * @param variables 变量对象
 * @returns 处理后的字符串
 */
export function processTemplate(template: string, variables: TemplateVariables): string {
    if (!template) {
        return '';
    }

    // 匹配 {{variableName}} 格式的变量
    const variableRegex = /\{\{(\w+)\}\}/g;
    
    return template.replace(variableRegex, (match, variableName) => {
        const value = variables[variableName];
        return value !== undefined ? value : match; // 如果变量不存在，保留原始标记
    });
}

/**
 * 获取模板中使用的所有变量名
 * @param template 模板字符串
 * @returns 变量名数组
 */
export function extractTemplateVariables(template: string): string[] {
    if (!template) {
        return [];
    }

    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
        const variableName = match[1];
        if (!variables.includes(variableName)) {
            variables.push(variableName);
        }
    }

    return variables;
}

/**
 * 验证模板语法是否正确
 * @param template 模板字符串
 * @returns 验证结果
 */
export function validateTemplate(template: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!template) {
        return { valid: true, errors: [] };
    }

    // 检查是否有未闭合的变量标记
    const openBraces = (template.match(/\{\{/g) || []).length;
    const closeBraces = (template.match(/\}\}/g) || []).length;
    
    if (openBraces !== closeBraces) {
        errors.push('模板中存在未闭合的变量标记');
    }

    // 检查变量名是否符合规范（只允许字母、数字、下划线）
    const variableRegex = /\{\{(\w*[^}\w][^}]*)\}\}/g;
    let match;
    while ((match = variableRegex.exec(template)) !== null) {
        errors.push(`无效的变量名: ${match[1]}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * 预定义的模板变量
 */
export const PREDEFINED_VARIABLES = {
    brandName: '品牌名称',
    tagline: '标语/口号',
    headerImage: '开头图片',
    footerImage: '结尾图片',
    callToAction: '行动号召',
    contactInfo: '联系信息',
    currentDate: '当前日期',
    currentTime: '当前时间'
} as const;

/**
 * 获取当前日期时间的变量值
 */
export function getDynamicVariables(): TemplateVariables {
    const now = new Date();
    return {
        currentDate: now.toLocaleDateString('zh-CN'),
        currentTime: now.toLocaleTimeString('zh-CN'),
        currentYear: now.getFullYear().toString(),
        currentMonth: (now.getMonth() + 1).toString(),
        currentDay: now.getDate().toString()
    };
}

/**
 * 默认的开头模板
 */
export const DEFAULT_HEADER_TEMPLATE = `![]({{headerImage}})

**{{brandName}}** | {{tagline}}

---
`;

/**
 * 默认的结尾模板
 */
export const DEFAULT_FOOTER_TEMPLATE = `---

![]({{footerImage}})

**{{callToAction}}**

{{contactInfo}}

*{{currentDate}}*`;

/**
 * 合并用户变量和动态变量
 * @param userVariables 用户定义的变量
 * @returns 合并后的变量对象
 */
export function mergeVariables(userVariables: TemplateVariables): TemplateVariables {
    return {
        ...getDynamicVariables(),
        ...userVariables
    };
}
