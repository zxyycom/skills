---
title: 在发布范围读取当前文本完成全文发现
id: 261026-search-published-scope-with-current-text
status: active
alignment: aligned
createdAt: 2026-10-26T08:34:01Z
purpose: 让未知ID的正文发现取得可靠完整身份，同时不复制全文或伪造全集来源新鲜结论。
background: 结构索引不能发现全部正文主题；自动全源映射fallback扩大责任且掩盖索引恢复，当前已采用发布范围与显式恢复。
decision: 共享搜索只返回受管路径与有界原文预览；领域据同一发布投影筛选和反查ID，读取时核对身份，坏索引显式恢复。
tags:
  - decision-records
  - index-runtime
  - investigation-report
relations:
  - type: 修订
    target: 260905-search-authoritative-files-with-index-identity
    summary: 保留全文与索引身份分工，自动降级改显式恢复
---

## 目的

- 从正文发现相关记录后能以完整ID继续show/trace，保持共享与领域owner清楚。

## 背景

- 持久索引承接结构筛选、摘要与身份，不保存完整正文。
- 发布范围不证明工作区全集；当前文本读取与发布metadata属于不同来源事实。

## 决策

### 发布范围与稳定身份

- 采用: 共享文件搜索只在领域明确提供的受管 root/pattern 或文件列表内匹配，返回路径与带行号的有界原文预览；不解析领域 Markdown、猜 ID 或建立跨域 CLI、持久全文索引。
- 采用: 领域从同一合法发布索引快照按状态、tags、时间和关系等条件选 entry，形成显式 sourcePath 文件集与唯一 sourcePath→ID 映射。
  - 命中后按此映射补完整 ID 和领域摘要，读取当前文件时核对声明 ID。
  - 不以 basename、归档位置或名称相似度推断身份。
- 采用: 索引缺失、损坏或不兼容时显式恢复，不自动全源扫描生成内存身份映射。
  - 已发布范围之外的新增和筛选变化须同步后进入发现；当前文本与投影不同不等同于已验证全集新鲜度。
  - 映射缺失或不唯一、所需读取或身份核对失败时失败，不把部分结果说完整。

### 匹配与结果覆盖

- 采用: `all`、`any` 可跨同一记录的段；content 以文件物理行为段，metadata 以各字段为段，`phrase` 只限单段；匹配按 NFKC、忽略大小写及空白处理。
  - 结构和文本关系命中分别解释，不由无 summary 文本命中否定关系筛选。
  - 有界原文预览不能替代完整 `show`；`show` 返回完整所选正文。
- 采用: 输出来源、筛选、限制、计数及 `scanComplete`、`resultsComplete`、`previewsComplete`，区分结果窗口和预览截断。
  - 发布快照范围或不完整扫描不能支持“当前全集没有相关记录”。
  - 局部搜索不宣称跨文件原子快照。

### 持久化与能力范围

- 采用: 正文只按需读取权威文件，持久派生索引仍不复制全文；不增加正则、相关性排序、向量或倒排索引。
- 采用: 本修订保留 Index Runtime 既有 text 模式；其全体消费者退出另行判断。
