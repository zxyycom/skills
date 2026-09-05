---
title: 以权威文件搜索协同索引身份
id: 260905-search-authoritative-files-with-index-identity
status: active
alignment: aligned
createdAt: 2026-09-05T03:24:00Z
purpose: 让未知领域身份时的全文发现直接读取受管权威文件，同时保持结构筛选与稳定身份由领域索引承接。
background: 将正文复制进派生索引会扩大同步和差异负担，而仅查摘要字段又无法发现正文主题。
decision: 共享文件搜索只返回受管路径与预览；领域以同一索引快照按 sourcePath 反查 ID 并补充领域摘要。
tags:
  - decision-records
  - index-runtime
  - investigation-report
relations: []
---

## 目的

- 让不知道领域 ID 的使用者能从受管记录正文发现相关记录，并取得可继续 `show` 或 `trace` 的稳定身份。
- 保持全文匹配、文件预览、领域结构筛选和领域摘要各有明确 owner，避免把正文副本变成索引事实。

## 背景

- 结构化索引适合按 status、tag、日期和关系等字段筛选，却不能覆盖只出现于 Markdown 正文的主题或理由。
- 把完整正文投影进可提交的索引会放大索引同步、来源 revision 与 diff；搜索命中片段也只能在查询时由具体请求生成。
- 文件路径能定位 Markdown，但 basename、归档位置和路径变化不能承担领域身份；搜索结果仍需要完整 ID 与领域摘要。

## 决策

- 采用: 共享文件全文搜索只在调用领域明确给出的受管 root 与 pattern 或显式文件列表中运行，提供 `all`、`any`、`phrase` 三种匹配与有界、带行号的原文预览；它不解析领域 Markdown、不推断 ID、不建立持久全文索引，也不提供跨领域 CLI。
- 采用: 领域搜索优先从同一可信结构化索引快照按领域条件筛选 entries，得到显式 `sourcePath` 文件列表和唯一 `sourcePath → ID` 映射；文件命中后由该映射恢复完整 ID，再由领域投影摘要和展示。
- 采用: 索引不可用、损坏或陈旧时，领域只能在完整验证权威来源后建立一次只读内存映射并明确 warning；映射缺失或不唯一、来源无效或文件读取失败时搜索失败，不把部分结果说成完整。
- 采用: 正文全文发现按需读取权威文件，不向领域派生索引复制完整正文；结构化索引继续承担状态、筛选、位置与身份反查协作。
- 不采用: 正则或部分正则查询、相关性排序、向量/倒排持久索引、basename 身份推断、通用跨领域搜索命令，或在本次边界中删除 Index Runtime 的既有 `text` 模式。后者仅在其全部消费者迁移后由独立 Change 演进。
