# WeWrite 模板编写指南

## 模板系统概述

WeWrite 使用基于 CSS 变量的主题系统，允许用户通过 Markdown 文件定义自定义样式。每个主题文件都是一个包含 CSS 代码块的 Markdown 文件。

## 模板文件结构

### 1. 基本文件格式

```markdown
---
author: 你的名字
theme_name: 主题名称
---

# 主题说明

这里可以写主题的描述和特点

## CSS 样式定义

```css
:root {
  /* 在这里定义CSS变量 */
  --article-font-family: "PingFang SC", sans-serif;
  --article-text-color: #333;
}

/* 其他CSS规则 */
.wewrite {
  font-family: var(--article-font-family);
}
```

### 2. Front Matter 要求

- `author`: 作者名称（可选）
- `theme_name`: **必需**，主题显示名称，系统通过此字段识别主题

### 3. CSS 代码块要求

- 必须使用 ````css` 标记
- 支持多个 CSS 代码块
- 系统会自动提取并合并所有 CSS 代码块

## 核心 CSS 变量系统

### 基础变量（来自 00_wewrite.css）

#### 颜色系统
```css
:root {
  /* 主色系 */
  --wewrite-primary: #2c3e50;
  --wewrite-secondary: #3498db;
  --wewrite-accent: #e67e22;
  --wewrite-primary-light: #d0e4ff;
  
  /* 中性色 */
  --wewrite-bg: transparent;
  --wewrite-text: #333333;
  --wewrite-text-color: var(--wewrite-text);
  --wewrite-border: #999999;
  
  /* 状态色 */
  --wewrite-success: #27ae60;
  --wewrite-warning: #ff9800;
  --wewrite-error: #e74c3c;
}
```

#### 排版基础
```css
:root {
  --wewrite-font-size: 16px;
  --wewrite-line-height: 1.8;
  --wewrite-text-indent: 0;
  --wewrite-letter-spacing: 0;
  --wewrite-text-align: left;
  --wewrite-border-radius: 4px;
}
```

### 文章排版变量（来自 03_typography.css）

```css
:root {
  /* 字体设置 */
  --article-font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  --article-font-weight: 400;
  --article-text-font-size: 15px;
  --article-text-color: var(--wewrite-text);
  --article-line-height: var(--wewrite-line-height);
  --article-text-align: left;
  --article-text-indent: 0;
  --article-word-break: break-word;
  --article-letter-space: 0px;
  --article-font-style: normal;
}
```

## 常用样式变量分类

### 1. 标题样式
```css
:root {
  --heading-color: #333;
  --heading-font-family: inherit;
  --heading-font-weight: 600;
  --heading-margin: 1rem 0;
  --h1-font-size: 24px;
  --h2-font-size: 21px;
  --h3-font-size: 18px;
  --h4-font-size: 16px;
  --h5-font-size: 14px;
  --h6-font-size: 12px;
}
```

### 2. 段落样式
```css
:root {
  --paragraph-margin: 1rem 0;
  --paragraph-padding: 0;
  --paragraph-font-family: inherit;
  --paragraph-line-height: inherit;
}
```

### 3. 强调文本
```css
:root {
  --strong-color: #e74c3c;
  --strong-font-weight: bold;
  --em-color: inherit;
  --em-font-style: italic;
}
```

### 4. 引用块
```css
:root {
  --blockquote-color: #666;
  --blockquote-background-color: #f8f9fa;
  --blockquote-border-color: #ddd;
  --blockquote-border-width: 4px;
  --blockquote-padding: 1rem;
  --blockquote-margin: 1rem 0;
  --blockquote-font-style: normal;
}
```

### 5. 代码样式
```css
:root {
  --code-background-color: #f8f9fa;
  --code-color: #e83e8c;
  --code-font-family: 'Courier New', monospace;
  --code-font-size: 0.9em;
  --code-padding: 0.2em 0.4em;
  --code-border-radius: 3px;
}
```

### 6. 表格样式
```css
:root {
  --table-border-color: #ddd;
  --table-border-width: 1px;
  --table-header-background-color: #f8f9fa;
  --table-header-color: #333;
  --table-background-color-alt: #f8f9fa;
  --table-td-min-width: 100px;
  --table-td-max-width: 300px;
}
```

### 7. 图片样式
```css
:root {
  --image-max-width: 100%;
  --image-border-radius: 4px;
  --image-caption-color: #666;
  --image-caption-font-size: 12px;
  --image-caption-text-align: center;
}
```

## 实战示例：创建通用模板

### 示例1：简洁现代风格

```markdown
---
author: 你的名字
theme_name: 简洁现代
---

# 简洁现代风格

适合技术文章和商务内容的简洁现代风格。

## 基础设置

```css
:root {
  /* 字体系统 */
  --article-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --article-text-font-size: 16px;
  --article-line-height: 1.6;
  --article-text-color: #2c3e50;
  
  /* 背景和边框 */
  --wewrite-bg: #ffffff;
  --wewrite-border: #e1e8ed;
  
  /* 标题样式 */
  --heading-color: #1a202c;
  --heading-font-weight: 600;
  --h2-font-size: 20px;
  --h3-font-size: 18px;
}
```

## 特殊元素

```css
/* 引用块样式 */
blockquote {
  border-left: 4px solid #3498db;
  background-color: #f8fafc;
  padding: 1rem 1.5rem;
  margin: 1.5rem 0;
  border-radius: 0 4px 4px 0;
}

/* 强调文本 */
strong {
  color: #e74c3c;
  font-weight: 600;
}

/* 代码样式 */
code {
  background-color: #f1f5f9;
  color: #475569;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
}
```
```

### 示例2：温暖阅读风格

```markdown
---
author: 你的名字  
theme_name: 温暖阅读
---

# 温暖阅读风格

适合个人博客和生活分享的温暖风格。

```css
:root {
  /* 温暖色调 */
  --article-font-family: "Georgia", "Times New Roman", serif;
  --article-text-font-size: 17px;
  --article-line-height: 1.8;
  --article-text-color: #4a4a4a;
  --wewrite-bg: #fefcf8;
  
  /* 标题样式 */
  --heading-color: #8b4513;
  --heading-font-family: "PingFang SC", sans-serif;
  --h2-font-size: 22px;
  
  /* 强调色 */
  --strong-color: #d2691e;
  --blockquote-border-color: #deb887;
  --blockquote-background-color: #faf8f3;
}

/* 段落间距 */
p {
  margin: 1.2rem 0;
  text-indent: 2em;
}

/* 首段不缩进 */
h1 + p, h2 + p, h3 + p {
  text-indent: 0;
}
```
```

## 模板开发最佳实践

### 1. 变量命名规范
- 使用语义化命名：`--heading-color` 而不是 `--blue-color`
- 保持一致性：所有标题相关变量以 `heading-` 开头
- 使用层级结构：`--h1-font-size`, `--h2-font-size`

### 2. 响应式设计
```css
:root {
  --article-max-width: 800px;
  --article-padding: 2rem;
}

@media (max-width: 768px) {
  :root {
    --article-padding: 1rem;
    --article-text-font-size: 15px;
  }
}
```

### 3. 可访问性考虑
```css
:root {
  /* 确保足够的对比度 */
  --article-text-color: #2d3748;
  --wewrite-bg: #ffffff;
  
  /* 合适的字体大小 */
  --article-text-font-size: 16px; /* 不小于16px */
  --article-line-height: 1.6; /* 不小于1.5 */
}
```

### 4. 微信公众号适配
```css
:root {
  /* 微信公众号推荐设置 */
  --article-max-width: none; /* 不限制宽度 */
  --article-text-align: justify; /* 两端对齐 */
  --article-text-font-size: 15px; /* 微信推荐字号 */
  --article-line-height: 1.75; /* 适合移动端阅读 */
}
```

## 调试和测试

### 1. 实时预览
- 保存模板文件后，在 WeWrite 预览器中选择你的主题
- 使用不同类型的内容测试（标题、段落、引用、代码等）

### 2. 常见问题排查
- **主题不显示**：检查 `theme_name` 是否正确设置
- **样式不生效**：检查 CSS 语法是否正确
- **变量不工作**：确保变量名拼写正确，使用 `var()` 函数

### 3. 兼容性测试
- 测试不同长度的文章
- 测试各种 Markdown 元素
- 在微信公众号后台预览效果

## 模板管理

### 1. 文件组织
```
/wewrite-themes/
├── 01-简洁现代.md
├── 02-温暖阅读.md
├── 03-技术文档.md
└── 04-创意设计.md
```

### 2. 版本控制
在模板文件中添加版本信息：
```markdown
---
author: 你的名字
theme_name: 主题名称
version: 1.0.0
created: 2025-01-11
updated: 2025-01-11
---
```

### 3. 分享和备份
- 将模板文件保存到云端
- 使用 Git 进行版本管理
- 与团队成员分享模板文件

---

通过这个指南，你可以创建出专业、美观且适合微信公众号的自定义主题模板。记住要多测试、多调整，找到最适合你内容风格的设计方案。
