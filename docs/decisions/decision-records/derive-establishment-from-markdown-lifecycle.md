---
title: 从 Markdown 生命周期派生决策建立状态
status: active
alignment: aligned
createdAt: 2026-07-24T15:35:32Z
purpose: 让候选、已建立成员、生效与索引新鲜度都由自包含 Markdown 生命周期确定。
background: Git HEAD 只能证明路径曾被提交，旧索引也无法发现索引外新增的已建立记录，两者都不应拥有生命周期。
decision: createdAt 为空的完整新记录是候选；合法非空 createdAt Markdown 是全部已建立成员，索引只从它们完整派生。
relations:
  - type: 归并
    target: decision-records/allow-sequential-activation-of-prewritten-candidates.md
  - type: 归并
    target: decision-records/separate-activation-effect-from-head-pending.md
  - type: 归并
    target: decision-records/use-configurable-self-contained-decision-root.md
  - type: 归并
    target: decision-records/use-field-alignment-commands.md
  - type: 归并
    target: decision-records/complete-current-decision-work-by-task-outcome.md
---

## 目的

- 让每条 Markdown 自身足以回答它是尚未生效的候选，还是已经建立并按生命周期生效的决策。
- 让查询索引始终是全部已建立 Markdown 的完整派生视图，不能用旧索引反向限定成员。
- 让决策根目录脱离 Git 也能完成查询、检查、维护、恢复和关系验证。

## 背景

- `createdAt` 已经在首次激活时写入并保持不变，能够在 Markdown 内明确区分尚未激活和已经建立。
- Git `HEAD` 中存在路径只能证明某个路径曾被提交，不能证明当前判断是否确认、生效、可归档或可丢弃。
- 从旧索引 entries 选择重建源会漏掉索引外新增的合法已建立 Markdown，使查询可能在成员不完整时返回陈旧结果。
- 领域目录迁移等协调结构变化需要移动 Markdown、更新关系并完整重建索引，不能继续由提交历史承担隐藏门禁。

## 决策

- 采用: 合法候选是合法的新身份路径、当前完整格式、`status: active`、非空 `alignment` 且 `createdAt: null` 的 Markdown；候选不生效、不进入索引，存在时严格 `check` 继续失败。
- 采用: 合法非空 `createdAt` Markdown 是已建立记录的唯一集合；活动已建立记录立即生效，归档记录只保留历史，索引成员身份不由旧 entries 或 Git 决定。
- 采用: 查询先扫描当前全部 Markdown 得到已建立路径集合，再用该集合校验索引 source revision；索引外新增已建立记录会使查询拒绝陈旧结果，`sync-index --write` 后自动成为正常成员。
- 采用: `sync-index --write` 无论索引有效、缺失、损坏或陈旧，都从全部合法已建立 Markdown 完整重建索引；候选始终排除并逐条提醒。
- 采用: 首次 `activate` 只为目标候选写入秒级 `createdAt`；重新激活归档记录保留原时间。`archive`、`mark-aligned` 和其他维护不要求旧索引已经拥有目标成员。
- 采用: `discard` 只删除完整合法候选；无效未登记文件和任意已建立记录都必须保留并拒绝，已建立记录通过归档或真实演进处理。
- 采用: 关系目标必须是当前扫描到的已建立归档记录，并继续拒绝缺失、候选、活动、重复、自环和环路；不再要求目标存在于 Git `HEAD`。
- 采用: 写事务保存原 Markdown 与索引，应用目标变化后验证完整来源、从全部已建立记录同步索引并读回检查；普通失败恢复本次命令改动。
- 采用: 路径仍是当前集合内的稳定身份，日常生命周期命令不自动移动路径；明确结构迁移由维护者协调移动 Markdown、更新全部关系并重建索引，不推断旧身份或生成兼容映射。
