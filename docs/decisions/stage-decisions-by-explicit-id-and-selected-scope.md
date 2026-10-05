---
title: 按显式决策 ID 与所选范围暂存
id: 261004-stage-decisions-by-explicit-id-and-selected-scope
status: active
alignment: aligned
createdAt: 2026-10-04T15:22:49Z
purpose: 让并行决策变化按稳定身份与显式 scope 进入待提交快照，不混入未选择内容。
background: 集合索引覆盖并行变化，文件位置又独立于稳定身份；暂存需分别选择记录身份与实际写入范围。
decision: stage 按 frontmatter ID 选择，位置变化不改变身份；显式 scope 界定索引与领域文件的写入范围。
tags:
  - artifact-identity
  - decision-records
  - record-identity
  - responsibility-boundaries
  - version-control
relations:
  - type: 修订
    target: stage-selected-decisions-by-stable-id
    summary: 保留按 ID 隔离，修正 basename 与 scope 边界
---

## 目的

- 让并行决策变化按稳定 Decision ID 被独立选择进入下一版本，不带入未选择的工作区变化。
- 让默认完整暂存与显式索引或领域范围暂存均可预测，不改变工作区生命周期。

## 背景

- 完整派生索引覆盖整个集合，按普通路径暂存无法为并行变化组合合法索引。
- ID 由 frontmatter 显式声明，sourcePath 独立表达位置；basename 改变因此不再表示身份迁移。
- `all`、`index`、`domain` 分别满足完整、仅索引和仅领域文件的暂存需要，“完整决策范围”只适用于默认 `all`。

## 决策

- 采用: `stage` 以显式完整 Decision ID 或唯一 name 选择正式记录，selector 在当前集合与 `HEAD` 基线索引的 ID 并集中解析；候选与未选择的工作区变化留在范围外。
- 同一 ID 的 sourcePath 或 basename 变化只选择该 ID；frontmatter ID 更正须同时选择旧、新 ID。选择集合由调用方明确提供，不从关系、名称相似度或命令历史推断或扩大。
- 默认 `all` 原子构造所选正式 Markdown 与索引投影的完整 pending 快照，索引从同一目标 Markdown 集合重建；`index` 只替换索引投影；`domain` 只写正式 Markdown 并保留 pending 索引原字节。跨域 scope 的精确协议由统一待提交快照范围方向承接。
- 暂存以已同步且有效的工作区集合为前提；写前核对 `HEAD` revision、所选来源与受控 pending 漂移。非法或重复 selector、缺失选择、目标不合法或版本管理不可用时停止，不接受无法恢复的部分结果。
- 各 scope 仅写明确目标范围，保留范围外 pending 和 filesystem；结构化结果说明实际写入路径与保留范围。调用方承担所选 scope 未覆盖部分的后续组合责任。
- 生命周期事务维护 filesystem，`stage` 独立构造 pending；暂存不执行同步，不改变生命周期、关系或对齐，也不提交或推送。建立事实仍由工作区生命周期表达。
