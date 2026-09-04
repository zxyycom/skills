---
title: 分离领域 ID 与存储位置
id: separate-domain-ids-from-storage-details
status: active
alignment: aligned
createdAt: 2026-09-04T15:06:56Z
purpose: 让受管记录的稳定身份不再由文件位置或扩展名承担。
background: basename 同时表达语义和位置时，重命名或移动会被误判为身份迁移，并使索引无法独立定位来源。
decision: 使用 Markdown 显式纯 ID 与索引 sourcePath 分离身份和位置；关系与选择只使用 ID。
tags:
  - decision-records
  - repository-model
relations:
  - type: 修订
    target: use-stable-decision-id-for-relations-and-lifecycle
---

## 目的

- 让受管 Decision 与 Investigation 记录在文件移动、归档或语义命名调整后，仍能用同一稳定身份恢复关系、索引和维护范围。

## 背景

- 将 basename 连同 `.md` 同时当作身份和位置，迫使文件名承载不应由存储承担的关系与选择语义。
- 派生索引需要由领域 ID 精确定位当前 Markdown；若 ID 可由路径反推，就无法区分身份变化、语义命名和纯位置变化。

## 决策

- 采用: 每份受管记录在 frontmatter `id` 中声明 extensionless 领域 ID，关系、索引 key、资源 owner 与维护选择都使用该 ID。
- 采用: `sourcePath` 独立保存当前 Markdown 位置，文件 basename 可以等于 ID 或使用合法语义 name；索引由 Markdown 重建，按 ID 回读时验证目标内容仍声明该 ID。
- 采用: 一个末尾 `.md` 只在旧 selector 的输入边界兼容移除，不能进入持久 ID、关系、索引或结构化输出。
- 不采用: 从 basename、archive 目录或跨领域共享 resolver 推导身份，也不把短期 Change Plan 纳入长期记录身份模型。
