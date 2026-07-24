---
title: 限制索引投影字段长度
status: active
alignment: aligned
createdAt: 2026-07-20T19:47:38+08:00
purpose: 让索引摘要保持可检索、可展示，并具备最低限度的独立表达能力。
background: 无长度上限会让索引退化为正文副本，内容过短又不能稳定表达决策含义。
decision: "`title`、`purpose`、`background` 和 `decision` 必须是 4 至 100 个 Unicode 字符的单行文本；CLI 不截断或补齐，完整正文不受限制。"
relations:
  - type: 修订
    target: decision-records/260718-use-purpose-background-decision-structure.md
---

## 目的
- 给标题和索引摘要建立简单、统一且可机械检查的表达边界。
- 防止索引投影因过长失去低成本检索价值，也防止过短内容只留下无法独立判断的标签。

## 背景
- 标题、目的、背景和决策会进入 JSON 索引并由 `list` 展示，需要同时兼顾表达完整性和集合扫描成本。
- 仅要求非空会接受含义不足的极短字段；没有上限则允许把完整正文复制进索引。
- 为不同字段设置不同长度会增加作者和校验器的规则负担，当前没有足够价值证明这种复杂度。

## 决策
- 采用: `title`、`purpose`、`background` 和 `decision` 去除首尾空白后必须各自包含 4 至 100 个 Unicode 字符，上下限均包含。
- 采用: 字符数按 Unicode 码点计算，不按 UTF-8 字节数或 JavaScript UTF-16 代码单元计算。
- 采用: 四个字段都是单行文本，不允许换行；长度限制作用于 Markdown 标题、索引摘要及其 JSON 投影。
- 采用: CLI 遇到不合规字段时报告实际长度并失败，不自动截断、补齐或改写内容。
- 采用: `sync-index` 在写入前检查 Markdown 来源，`check` 同时检查 Markdown 和索引投影；完整目的、背景和决策章节不受此长度限制。
