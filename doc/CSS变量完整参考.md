# WeWrite CSS 变量完整参考

## 变量分类索引

- [基础系统变量](#基础系统变量)
- [文章排版变量](#文章排版变量)  
- [标题样式变量](#标题样式变量)
- [段落样式变量](#段落样式变量)
- [文本装饰变量](#文本装饰变量)
- [引用块变量](#引用块变量)
- [代码样式变量](#代码样式变量)
- [表格样式变量](#表格样式变量)
- [图片样式变量](#图片样式变量)
- [列表样式变量](#列表样式变量)
- [链接样式变量](#链接样式变量)
- [特殊组件变量](#特殊组件变量)

## 基础系统变量

### 颜色系统
```css
:root {
  /* 主色系 */
  --wewrite-primary: #2c3e50;           /* 主色 */
  --wewrite-secondary: #3498db;         /* 辅助色 */
  --wewrite-accent: #e67e22;            /* 强调色 */
  --wewrite-primary-light: #d0e4ff;     /* 浅色主色 */
  
  /* 中性色 */
  --wewrite-bg: transparent;            /* 背景色 */
  --wewrite-bg-alt: var(--wewrite-primary); /* 备用背景色 */
  --wewrite-text: #333333;              /* 文本色 */
  --wewrite-text-color: var(--wewrite-text); /* 文本色别名 */
  --wewrite-text-alt: #ffffff;          /* 备用文本色 */
  --wewrite-border: #999999;            /* 边框色 */
  
  /* 状态色 */
  --wewrite-success: #27ae60;           /* 成功色 */
  --wewrite-warning: #ff9800;           /* 警告色 */
  --wewrite-error: #e74c3c;             /* 错误色 */
  --wewrite-danger: #dc3545;            /* 危险色 */
  --wewrite-blue: #1e3a8a;              /* 蓝色 */
}
```

### 基础排版
```css
:root {
  --wewrite-font-size: 16px;            /* 基础字号 */
  --wewrite-line-height: 1.8;           /* 行高 */
  --wewrite-text-indent: 0;             /* 文本缩进 */
  --wewrite-letter-spacing: 0;          /* 字符间距 */
  --wewrite-word-spacing: 0;            /* 单词间距 */
  --wewrite-text-align: left;           /* 文本对齐 */
  --wewrite-text-decoration: none;      /* 文本装饰 */
}
```

### 边框和圆角
```css
:root {
  --wewrite-border-width: 1px;          /* 边框宽度 */
  --wewrite-border-style: solid;        /* 边框样式 */
  --wewrite-border-radius: 4px;         /* 基础圆角 */
  --wewrite-border-radius-sm: 2px;      /* 小圆角 */
  --wewrite-border-radius-lg: 6px;      /* 大圆角 */
  --wewrite-border-radius-xl: 8px;      /* 超大圆角 */
}
```

## 文章排版变量

### 主要文章样式
```css
:root {
  /* 字体设置 */
  --article-font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  --article-font-weight: 400;           /* 字体粗细 */
  --article-text-font-size: 15px;       /* 文章字号 */
  --article-text-color: var(--wewrite-text); /* 文章文本色 */
  --article-line-height: var(--wewrite-line-height); /* 文章行高 */
  --article-text-align: left;           /* 文章对齐方式 */
  --article-text-indent: 0;             /* 文章缩进 */
  --article-font-style: normal;         /* 字体样式 */
  
  /* 文本处理 */
  --article-word-break: break-word;     /* 换行规则 */
  --article-letter-space: 0px;          /* 字符间距 */
  
  /* 布局 */
  --article-max-width: none;            /* 最大宽度 */
  --article-padding: 0;                 /* 内边距 */
  --article-margin: 0;                  /* 外边距 */
}
```

## 标题样式变量

### 通用标题设置
```css
:root {
  --heading-color: #333;                /* 标题颜色 */
  --heading-font-family: inherit;       /* 标题字体 */
  --heading-font-weight: 600;           /* 标题粗细 */
  --heading-margin: 1rem 0;             /* 标题外边距 */
  --heading-padding: 0;                 /* 标题内边距 */
  --heading-text-align: left;           /* 标题对齐 */
  --heading-line-height: 1.2;           /* 标题行高 */
}
```

### 各级标题字号
```css
:root {
  --h1-font-size: 24px;                 /* H1字号 */
  --h2-font-size: 21px;                 /* H2字号 */
  --h3-font-size: 18px;                 /* H3字号 */
  --h4-font-size: 16px;                 /* H4字号 */
  --h5-font-size: 14px;                 /* H5字号 */
  --h6-font-size: 12px;                 /* H6字号 */
}
```

## 段落样式变量

```css
:root {
  --paragraph-margin: 1rem 0;           /* 段落外边距 */
  --paragraph-padding: 0;               /* 段落内边距 */
  --paragraph-font-family: inherit;     /* 段落字体 */
  --paragraph-font-size: inherit;       /* 段落字号 */
  --paragraph-line-height: inherit;     /* 段落行高 */
  --paragraph-text-align: inherit;      /* 段落对齐 */
  --paragraph-text-indent: 0;           /* 段落首行缩进 */
}
```

## 文本装饰变量

### 强调文本
```css
:root {
  --strong-color: #e74c3c;              /* 粗体颜色 */
  --strong-font-weight: bold;           /* 粗体粗细 */
  --strong-background-color: transparent; /* 粗体背景 */
}
```

### 斜体文本
```css
:root {
  --em-color: inherit;                  /* 斜体颜色 */
  --em-font-style: italic;              /* 斜体样式 */
  --em-font-weight: inherit;            /* 斜体粗细 */
}
```

### 下划线和删除线
```css
:root {
  --u-color: inherit;                   /* 下划线颜色 */
  --u-text-decoration: underline;       /* 下划线样式 */
  --del-color: #999;                    /* 删除线颜色 */
  --del-text-decoration: line-through;  /* 删除线样式 */
}
```

## 引用块变量

```css
:root {
  --blockquote-color: #666;             /* 引用文本色 */
  --blockquote-background-color: #f8f9fa; /* 引用背景色 */
  --blockquote-border-color: #ddd;      /* 引用边框色 */
  --blockquote-border-width: 4px;       /* 引用边框宽度 */
  --blockquote-border-style: solid;     /* 引用边框样式 */
  --blockquote-padding: 1rem;           /* 引用内边距 */
  --blockquote-margin: 1rem 0;          /* 引用外边距 */
  --blockquote-font-style: normal;      /* 引用字体样式 */
  --blockquote-font-size: inherit;      /* 引用字号 */
  --blockquote-line-height: inherit;    /* 引用行高 */
}
```

## 代码样式变量

### 行内代码
```css
:root {
  --code-background-color: #f8f9fa;     /* 行内代码背景 */
  --code-color: #e83e8c;                /* 行内代码颜色 */
  --code-font-family: 'Courier New', monospace; /* 代码字体 */
  --code-font-size: 0.9em;              /* 代码字号 */
  --code-padding: 0.2em 0.4em;          /* 代码内边距 */
  --code-border-radius: 3px;            /* 代码圆角 */
  --code-border: none;                  /* 代码边框 */
}
```

### 代码块
```css
:root {
  --pre-background-color: #f8f9fa;      /* 代码块背景 */
  --pre-color: #333;                    /* 代码块文本色 */
  --pre-padding: 1rem;                  /* 代码块内边距 */
  --pre-margin: 1rem 0;                 /* 代码块外边距 */
  --pre-border-radius: 4px;             /* 代码块圆角 */
  --pre-border: 1px solid #e1e8ed;      /* 代码块边框 */
  --pre-overflow: auto;                 /* 代码块溢出处理 */
}
```

## 表格样式变量

```css
:root {
  --table-border-color: #ddd;           /* 表格边框色 */
  --table-border-width: 1px;            /* 表格边框宽度 */
  --table-border-style: solid;          /* 表格边框样式 */
  --table-background-color: transparent; /* 表格背景色 */
  --table-background-color-alt: #f8f9fa; /* 表格交替行背景 */
  
  /* 表头样式 */
  --table-header-background-color: #f8f9fa; /* 表头背景 */
  --table-header-color: #333;           /* 表头文本色 */
  --table-header-font-weight: 600;      /* 表头字体粗细 */
  
  /* 单元格样式 */
  --table-td-padding: 0.75rem;          /* 单元格内边距 */
  --table-td-min-width: 100px;          /* 单元格最小宽度 */
  --table-td-max-width: 300px;          /* 单元格最大宽度 */
  --table-td-text-align: left;          /* 单元格文本对齐 */
}
```

## 图片样式变量

```css
:root {
  --image-max-width: 100%;              /* 图片最大宽度 */
  --image-height: auto;                 /* 图片高度 */
  --image-border-radius: 4px;           /* 图片圆角 */
  --image-border: none;                 /* 图片边框 */
  --image-margin: 1rem 0;               /* 图片外边距 */
  --image-display: block;               /* 图片显示方式 */
  
  /* 图片说明 */
  --image-caption-color: #666;          /* 图片说明颜色 */
  --image-caption-font-size: 12px;      /* 图片说明字号 */
  --image-caption-text-align: center;   /* 图片说明对齐 */
  --image-caption-margin: 0.5rem 0;     /* 图片说明外边距 */
  --image-caption-font-style: italic;   /* 图片说明字体样式 */
}
```

## 列表样式变量

### 无序列表
```css
:root {
  --ul-margin: 1rem 0;                  /* 无序列表外边距 */
  --ul-padding-left: 2rem;              /* 无序列表左内边距 */
  --ul-list-style-type: disc;           /* 无序列表标记 */
}
```

### 有序列表
```css
:root {
  --ol-margin: 1rem 0;                  /* 有序列表外边距 */
  --ol-padding-left: 2rem;              /* 有序列表左内边距 */
  --ol-list-style-type: decimal;        /* 有序列表标记 */
}
```

### 列表项
```css
:root {
  --li-margin: 0.25rem 0;               /* 列表项外边距 */
  --li-padding: 0;                      /* 列表项内边距 */
  --li-line-height: inherit;            /* 列表项行高 */
}
```

## 链接样式变量

```css
:root {
  --link-color: #3498db;                /* 链接颜色 */
  --link-text-decoration: none;         /* 链接装饰 */
  --link-hover-color: #2980b9;          /* 链接悬停颜色 */
  --link-hover-text-decoration: underline; /* 链接悬停装饰 */
  --link-visited-color: #8e44ad;        /* 已访问链接颜色 */
}
```

## 特殊组件变量

### Callout 组件
```css
:root {
  --callout-padding: 1rem;              /* Callout内边距 */
  --callout-margin: 1rem 0;             /* Callout外边距 */
  --callout-border-radius: 4px;         /* Callout圆角 */
  --callout-border-width: 1px;          /* Callout边框宽度 */
  
  /* 不同类型的Callout颜色 */
  --callout-note-color: #3498db;        /* Note类型颜色 */
  --callout-tip-color: #27ae60;         /* Tip类型颜色 */
  --callout-warning-color: #f39c12;     /* Warning类型颜色 */
  --callout-danger-color: #e74c3c;      /* Danger类型颜色 */
}
```

### 数学公式
```css
:root {
  --math-font-family: 'Times New Roman', serif; /* 数学公式字体 */
  --math-font-size: 1em;                /* 数学公式字号 */
  --math-color: inherit;                /* 数学公式颜色 */
  --math-display-margin: 1rem 0;        /* 块级公式外边距 */
}
```

### Mermaid 图表
```css
:root {
  --mermaid-background-color: transparent; /* Mermaid背景 */
  --mermaid-border: 1px solid #e1e8ed;  /* Mermaid边框 */
  --mermaid-border-radius: 4px;         /* Mermaid圆角 */
  --mermaid-margin: 1rem 0;             /* Mermaid外边距 */
}
```

## 使用示例

### 创建深色主题
```css
:root {
  --wewrite-bg: #1a1a1a;
  --wewrite-text: #e0e0e0;
  --wewrite-border: #404040;
  --heading-color: #ffffff;
  --blockquote-background-color: #2d2d2d;
  --code-background-color: #2d2d2d;
  --table-background-color-alt: #2d2d2d;
}
```

### 创建大字号主题
```css
:root {
  --article-text-font-size: 18px;
  --article-line-height: 1.8;
  --h1-font-size: 28px;
  --h2-font-size: 24px;
  --h3-font-size: 20px;
}
```

### 创建紧凑布局
```css
:root {
  --article-line-height: 1.5;
  --paragraph-margin: 0.5rem 0;
  --heading-margin: 0.75rem 0;
  --blockquote-margin: 0.75rem 0;
  --pre-margin: 0.75rem 0;
}
```

---

这个参考文档涵盖了 WeWrite 中所有可用的 CSS 变量。通过合理组合这些变量，你可以创建出各种风格的主题模板。
