---
title: 按测试证据 Case ID 独立暂存派生索引条目
status: active
alignment: aligned
createdAt: 2026-08-10T06:42:57Z
purpose: 让并行测试证据维护只暂存选中 Case 对应的索引变化，同时保持权威目录与派生索引的责任边界。
background: 多个 Case 共享一个派生索引；公共运行时已经能按稳定 ID 组合条目，但测试证据领域仍需拥有选择输入和文件边界。
decision: 测试证据入口校验 Case ID 后只把选中 ID 交给索引运行时，topic 表、Case Markdown 和代码均由调用方另行暂存。
relations: []
---

## 目的

- 让并行维护不同测试证据 Case 的任务只把本次选中 Case 对应的索引变化写入 `pending`，不带入同一工作区索引中的其他 Case 变化。
- 让测试证据领域继续拥有 Case 身份、CLI 语义和领域文件边界，同时复用公共索引运行时的组合、校验和受控写入能力。
- 保持 topic 表、Case Markdown、测试或产品代码、完整派生索引和按条目暂存之间可核对的责任边界。

## 背景

- 每个测试证据 Case 使用固定格式的 Case ID 作为稳定索引 ID，但全部 Case 共享一个 `test-evidence-index.json`；普通文件级暂存无法隔离同一索引中的并行 Case 变化。
- index-runtime 已经能够从 current revision 与工作区索引按选中 ID 组合 state 和逐条来源指纹，重新投影完整目标，并通过 version-control 受控替换目标索引的 `pending` 内容。
- topic 表和 Case Markdown 是测试证据的权威内容；索引运行时不能从 Case ID 推断这些文件，也不能决定测试或产品代码的提交范围。
- 完整 topic 表位于索引 metadata，其来源指纹作用于整个测试证据集合，不能归入单个 Case ID。

## 决策

- 采用: test-evidence 提供 `stage-index <case-id...>` 领域入口。每个输入必须是符合固定 Case ID 协议且不重复的稳定 ID，并直接复用现有索引 ID；重命名由调用方同时选择旧 ID 和新 ID。
- 采用: 领域入口完成 Case ID 校验后，只调用配置完成的 `StateIndexRuntime.stageSelectedEntries(selectedIds)`；不读取 revision 索引，不构造基线、变化对象、metadata、来源 revision、目标索引或待提交文件计划。
- 采用: 成功只表示选中 Case 的索引条目变化已经进入 `pending`。命令不读取、写入或暂存 topic 表、Case Markdown、测试代码或产品代码；调用方必须另行选择这些文件并核对最终提交范围。
- 采用: topic 表 metadata 或其来源指纹相对既有基线变化时，保留公共集合级门禁并拒绝按 Case 暂存；调用方需要改用普通文件级方式暂存完整索引，不从 Case 的 topic 归属推断集合级选择。
- 采用: 同一测试证据索引已有待提交变化时直接拒绝，不清除、累加、合并或覆盖；目标索引之外的待提交路径保持不变。
- 采用: CLI 提供稳定文本与 JSON 结果，保留公共暂存结果的 selected IDs、是否变化、状态和诊断；参数错误退出 `2`，索引、版本工作区、冲突或写入失败退出 `1`。
