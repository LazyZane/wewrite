# WeWrite 模板制作快速提示词

## 🚀 一句话任务描述

创建一个WeWrite主题模板，严格遵循语法规范，确保无错误且适配微信公众号。

## 📋 必须遵循的格式

```markdown
---
author: 作者名称
theme_name: 主题名称
---

# 主题名称

主题描述

## 基础样式

```css
:root {
  --article-font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
  --article-text-font-size: 15px;
  --article-line-height: 1.75;
  --article-text-color: #3f3f3f;
}
```

## 其他样式

```css
/* 更多CSS规则 */
```
```

## ⚠️ 关键错误预防

### 1. Unicode字符处理
```css
/* ✅ 正确 */
content: "\201C";    /* 左双引号 */
content: "\25B8";    /* 右三角 */

/* ❌ 错误 */
content: """;        /* 会导致解析错误 */
content: "▸";        /* 会导致解析错误 */
```

### 2. 必需字段
```yaml
---
theme_name: 主题名称    # 必须存在，系统识别标识
---
```

### 3. CSS语法
```css
/* ✅ 正确 */
.element {
  color: #333;         /* 分号结尾 */
}

/* ❌ 错误 */
.element {
  color: #333          /* 缺少分号 */
}
```

## 🎯 微信公众号适配

```css
:root {
  /* 推荐设置 */
  --article-text-font-size: 15px;      /* 微信推荐字号 */
  --article-line-height: 1.75;         /* 移动端行高 */
  --article-text-align: justify;       /* 两端对齐 */
  --article-max-width: none;           /* 不限制宽度 */
  --h1-font-size: 22px;                /* 标题不要过大 */
  --h2-font-size: 19px;
}
```

## 🔧 常用Unicode转义

| 字符 | 转义序列 | 用途 |
|------|----------|------|
| " | `\201C` | 左双引号 |
| ▸ | `\25B8` | 右三角 |
| • | `\2022` | 项目符号 |
| → | `\2192` | 右箭头 |

## ✅ 提交前检查清单

- [ ] `theme_name` 字段存在
- [ ] 所有CSS规则以分号结尾
- [ ] 特殊字符使用转义序列
- [ ] 字号适合移动端
- [ ] 代码块正确闭合

## 🎨 快速样式模板

### 标题装饰
```css
h2::before {
  content: "";
  position: absolute;
  left: 0;
  width: 4px;
  height: 1.2em;
  background: #3498db;
}
```

### 引用块
```css
blockquote::before {
  content: "\201C";
  font-size: 2.5em;
  color: #bdc3c7;
}
```

### 列表标记
```css
ul li::before {
  content: "\25B8";
  color: #3498db;
}
```

---

**记住**：语法正确 > 功能丰富 > 视觉美观
