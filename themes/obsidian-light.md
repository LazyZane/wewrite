---
author: WeWrite自动生成
theme_name: Light (Obsidian主题)
description: 基于Obsidian主题"Light"自动生成的WeWrite主题
generated_at: 2025-07-13T15:28:01.176Z
source: Obsidian主题
---

# Light (Obsidian主题)

这是基于Obsidian主题"Light"自动生成的WeWrite主题文件。

## 主题特点

- 背景色：白色 (#ffffff)
- 文字色：深灰色 (#333333)
- 链接色：暖红色 (rgb(215, 130, 126))
- 代码块背景：浅灰色 (#f5f5f5)
- 标题层级：H1最大(2em)到H6最小(0.9em)，颜色从深到浅
- 代码语法高亮：支持多种颜色

## CSS样式定义

```css
:root {
  /* 基础颜色变量 */
  --wewrite-bg: #ffffff;
  --wewrite-text: #333333;
  --wewrite-border: #ddd;

  /* 文章基础样式 */
  --article-font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  --article-text-font-size: 15px;
  --article-line-height: 1.8;
  --article-text-align: left;

  /* 标题颜色 */
  --heading-color: #2c3e50;

  /* 各级标题样式 */
  --h1-color: #2c3e50;
  --h1-size: 2em;
  --h1-weight: 700;

  --h2-color: #34495e;
  --h2-size: 1.5em;
  --h2-weight: 600;

  --h3-color: #34495e;
  --h3-size: 1.25em;
  --h3-weight: 600;

  --h4-color: #5a6c7d;
  --h4-size: 1.1em;
  --h4-weight: 500;

  --h5-color: #5a6c7d;
  --h5-size: 1em;
  --h5-weight: 500;

  --h6-color: #5a6c7d;
  --h6-size: 0.9em;
  --h6-weight: 500;

  /* 强调文本颜色 */
  --strong-color: #2c3e50;

  /* 链接颜色 */
  --link-color: rgb(215, 130, 126);
  --link-hover-color: #0080ff;

  /* 代码块基础样式 */
  --code-background-color: #f5f5f5;
  --code-color: #333333;
  --code-size: 14px;

  /* 代码语法高亮颜色 */
  --code-comment-color: #008000;
  --code-function-color: #795e26;
  --code-keyword-color: #0000ff;
  --code-string-color: #a31515;
  --code-property-color: #001080;
  --code-tag-color: #800000;
  --code-value-color: #09885a;
  --code-important-color: #cd3131;
  --code-punctuation-color: #393a34;

  /* 引用块样式 */
  --blockquote-border-color: #2c3e50;
  --blockquote-background-color: #f8f9fa;
  --blockquote-color: rgb(74, 85, 104);

  /* 表格样式 */
  --table-border-color: #ddd;
  --table-header-background-color: #f8f9fa;
  --table-header-color: rgb(74, 85, 104);

  /* 标签样式 */
  --tag-color: #2c3e50;
  --tag-background: #e8e8e8;
}

/* 代码块语法高亮应用 */
.wewrite-article-content pre code {
  background-color: var(--code-background-color);
  color: var(--code-color);
}

.wewrite-article-content .token.comment {
  color: var(--code-comment-color);
}

.wewrite-article-content .token.function {
  color: var(--code-function-color);
}

.wewrite-article-content .token.keyword {
  color: var(--code-keyword-color);
}

.wewrite-article-content .token.string {
  color: var(--code-string-color);
}

.wewrite-article-content .token.property {
  color: var(--code-property-color);
}

.wewrite-article-content .token.tag {
  color: var(--code-tag-color);
}

.wewrite-article-content .token.number,
.wewrite-article-content .token.boolean {
  color: var(--code-value-color);
}

.wewrite-article-content .token.important {
  color: var(--code-important-color);
}

.wewrite-article-content .token.punctuation {
  color: var(--code-punctuation-color);
}

/* 标题样式应用 */
.wewrite-article-content h1 {
  color: var(--h1-color);
  font-size: var(--h1-size);
  font-weight: var(--h1-weight);
}

.wewrite-article-content h2 {
  color: var(--h2-color);
  font-size: var(--h2-size);
  font-weight: var(--h2-weight);
}

.wewrite-article-content h3 {
  color: var(--h3-color);
  font-size: var(--h3-size);
  font-weight: var(--h3-weight);
}

.wewrite-article-content h4 {
  color: var(--h4-color);
  font-size: var(--h4-size);
  font-weight: var(--h4-weight);
}

.wewrite-article-content h5 {
  color: var(--h5-color);
  font-size: var(--h5-size);
  font-weight: var(--h5-weight);
}

.wewrite-article-content h6 {
  color: var(--h6-color);
  font-size: var(--h6-size);
  font-weight: var(--h6-weight);
}
```

## 使用说明

1. 这个主题文件是从Obsidian主题自动生成的
2. 包含了完整的代码语法高亮支持
3. 你可以编辑上面的CSS来自定义样式
4. 修改后保存文件，WeWrite会自动重新加载主题
5. 如果需要重新生成，可以删除此文件后重新生成

---
*由WeWrite自动生成于 2025/7/13 23:28:01*
