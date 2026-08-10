---
title: 按调查主题 ID 独立暂存派生索引条目
status: active
alignment: aligned
createdAt: 2026-08-10T03:58:30Z
purpose: 让并行调查只暂存选中主题对应的索引变化，同时保持事实源与集合级资源边界。
background: 多个主题共享一个派生索引；公共运行时已经能按稳定 ID 组合条目，但领域仍需拥有选择输入和文件边界。
decision: 调查入口校验主题路径后只把选中 ID 交给索引运行时，领域文件另行暂存，集合级资源变化拒绝条目级操作。
relations: []
---

## 目的

- 让并行维护不同调查主题的任务只把本次选中主题对应的索引变化写入 `pending`，不带入同一工作区索引中的其他主题变化。
- 让调查领域继续拥有主题身份、CLI 语义和领域文件边界，同时复用公共索引运行时的组合、校验和受控写入能力。
- 保持主题 Markdown、随附资源、完整派生索引和按条目暂存之间可核对的责任边界。

## 背景

- 每个调查主题以相对调查根目录的 `<category-id>/<semantic-slug>.md` 路径作为稳定索引 ID，但全部主题共享一个 `investigation-index.json`；普通文件级暂存无法隔离同一索引中的并行主题变化。
- index-runtime 已经能够从 current revision 与工作区索引按选中 ID 组合 state 和逐条来源指纹，重新投影完整目标，并通过 version-control 受控替换目标索引的 `pending` 内容。
- 主题 Markdown 是调查内容和资源引用关系的事实源；索引运行时不能从主题 ID 推断这些文件，也不能决定它们的提交范围。
- 随附资源 ID 与 SHA-256 位于索引 metadata，资源集合与内容由 `sourceRevision.metadata` 跟踪；这些值作用于完整调查集合，不能归入单个主题 ID。

## 决策

- 采用: investigation-report 提供 `stage-index <topic-id...>` 领域入口。每个输入必须是不带重复的规范 POSIX 主题路径，并直接作为现有调查索引 ID；重命名由调用方同时选择旧 ID 和新 ID。
- 采用: 领域入口完成主题 ID 校验后，只调用配置完成的 `StateIndexRuntime.stageSelectedEntries(selectedIds)`；不读取 revision 索引，不构造基线、变化对象、metadata、来源 revision、目标索引或待提交文件计划。
- 采用: 成功只表示选中主题的索引条目变化已经进入 `pending`。命令不读取、写入或暂存主题 Markdown 与随附资源；调用方必须另行选择领域文件并核对最终提交范围。
- 采用: 随附资源 metadata 或其来源指纹相对既有基线变化时，保留公共集合级门禁并拒绝按主题暂存；调用方需要改用普通文件级方式暂存完整索引，不从主题引用关系推断资源选择。
- 采用: 同一调查索引已有待提交变化时直接拒绝，不清除、累加、合并或覆盖；目标索引之外的待提交路径保持不变。
- 采用: CLI 提供稳定文本与 JSON 结果，保留公共暂存结果的 selected IDs、是否变化、状态和诊断；参数错误退出 `2`，索引、版本工作区、冲突或写入失败退出 `1`。
