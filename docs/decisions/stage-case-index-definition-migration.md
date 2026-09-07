---
title: 按 Case 暂存索引并整体处理定义迁移
id: 260907-stage-case-index-definition-migration
status: active
alignment: aligned
createdAt: 2026-09-07T10:02:55Z
purpose: 保留安全的 selected staging，同时禁止在 definition 切换时按 Case 拆分索引。
background: Case-only 索引不再有 topic metadata，但跨 definition 的索引基线不能安全组合。
decision: 普通 Case 变化可 selected stage；首次 definition 迁移必须整体暂存索引。
tags:
  - test-evidence-review
  - version-control
relations:
  - type: 修订
    target: stage-selected-test-evidence-index-entries
---

## 目的
- 保留并行 Case 维护时对共享派生索引的 selected staging，且不把权威 Case、测试代码或项目快照一并暂存。
- 使索引定义改变的首次切换保持原子，避免以旧 definition 的基线拼接新 Case-only 条目。

## 背景
- Case-only 索引的 metadata 固定为空对象，普通 Case 改动可以由稳定 Case ID 隔离。
- definitionVersion 改变时，当前 revision 和 pending 基线不具有可安全组合的同一投影语义。

## 决策
- 采用: `stage-index <case-id...>` 只接受唯一合法 Case ID，并复用索引运行时对 selected entries 的安全 Git 操作；成功不表示 Case Markdown、测试代码或项目文件已经暂存。
- 采用: 普通 definition 内的 Case 新增、删除和重命名可由显式完整 ID 集选择；命令拒绝冲突 pending 或不能证明安全基线的状态。
- 采用: 首次跨 definitionVersion 的迁移必须整体暂存索引，不按 Case 拆分；调用方同时核对迁移后的 Case 源和索引。
- 采用: 暂存不读取实体快照、不执行测试或项目采集，也不把索引引用有效性表述成测试通过。
- 不采用: 通过 selected staging 自动接纳 definition 迁移，或将 Case、快照和测试代码扩展为索引运行时的暂存责任。
