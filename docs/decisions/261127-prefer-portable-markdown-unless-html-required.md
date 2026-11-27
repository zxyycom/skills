---
title: Markdown 默认保持可移植，仅按明确要求嵌入 HTML
id: 261127-prefer-portable-markdown-unless-html-required
status: active
alignment: aligned
createdAt: 2026-11-27T02:39:15Z
purpose: 使同一份 Markdown 的结构在源码阅读和不同预览环境中仍可辨认。
background: 一个预览器能显示 HTML，不足以证明同一文档的其他读者也能恢复其结构。
decision: AI-Ready Docs 默认选用可移植的 Markdown，只有用户或交付契约明确要求时才嵌入 HTML。
tags:
  - ai-ready-docs
  - document-structure
relations: []
---

## 目的

让 `skills/ai-ready-docs/` 在处理 Markdown 时优先保留可跨环境阅读的层级与关系。

## 背景

作者可能在支持 HTML 的预览器里阅读文档，后续使用者却直接读取 Markdown 源码，或在过滤标签的环境里阅读。用 HTML 做普通标题或列表能够在前者呈现预期效果，却让其他读者额外依赖标签解释；本地预览成功回答不了这种写法是否适合作为默认格式。

## 决策

- 采用: 默认用可移植的 Markdown 表达正文结构。只有用户或交付契约明确要求 HTML 时才嵌入 HTML；允许使用或预览成功本身不构成要求。
- 采用: 将载体选择与语法正确性分别核对。是否需要 HTML 是兼容性判断，行内标记和表格能否形成预期结构则是 Markdown 自身的正确性问题。本取舍约束嵌入正文的 HTML；作为讲解对象的代码示例仍按代码表达。
