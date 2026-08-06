---
title: 按 ID 键控条目独立暂存状态索引
status: active
alignment: unaligned
createdAt: 2026-08-06T09:23:47Z
purpose: 让并行任务只暂存自己选择的索引条目，不带入同一文件中的其他工作区变化。
background: 单文件索引无法按文件边界隔离不同任务，但 ID 键控条目及其来源指纹可以独立组合。
decision: 索引运行时只接收选中 ID，从 revision 与工作区索引组合完整目标并受控写入 pending。
relations:
  - type: 拆分
    target: index-runtime/stage-selected-index-entries.md
---

## 目的

- 让共用一个完整索引文件的并行任务只暂存本次选择的索引条目。
- 让调用方只声明稳定 ID，不重复实现索引合并、来源 revision、投影、校验和序列化。
- 保持索引文件、领域文件和版本管理待提交写入的责任边界。

## 背景

- 一个领域的全部索引条目聚合在单个确定性 JSON 文件中，普通文件级暂存会同时带入其他任务尚未完成的工作区索引变化。
- ID 键控索引同时保存 `entries[id]` 与 `sourceRevision.entries[id]`；revision 索引可以作为基线，工作区索引可以作为选中条目的候选来源。
- metadata、metadata 来源 revision、schema、namespace、definition 和 key definitions 影响完整集合，不能归入某个选中 ID。
- 领域 Markdown、目录表、topic 表、代码等事实源仍由接入方拥有；通用索引不能从 ID 推断或决定这些文件的提交范围。
- 共享 version-control 已拥有 revision、`pending`、写入锁、冲突检查和失败恢复，index-runtime 不应直接依赖底层版本系统。

## 决策

- 采用: index-runtime 提供按稳定条目 ID 暂存单文件索引的操作。配置完成的运行时只接收非空且不重复的选中 ID，不接收领域文件、基线条目、变化类型、metadata、revision 或完整目标索引。
- 采用: current revision 中的完整索引是基线，工作区完整索引是候选。选中且工作区存在的 ID 使用工作区 state 与对应来源指纹；选中且只在基线存在的 ID 被删除；未选中 ID 保持基线状态。重命名由调用方同时选择旧、新 ID。
- 采用: 既有基线下，工作区 metadata、metadata 来源指纹、schema、namespace、definitionVersion 和 key definitions 必须与基线相同，否则拒绝条目级操作。首次索引使用工作区的完整集合级契约。
- 采用: 目标索引从选定 state 使用同一 definition 重新执行 parser、key 投影、规范化和完整 `validateIndex`；目标 `sourceRevision.entries` 按同一 ID 选择规则组合，不复制候选 keys 或条目顺序。
- 采用: 操作只写目标索引的 `pending` 内容，不读取、写入或暂存领域文件，也不承诺索引与领域文件之间的原子事务。接入方自行维护领域文件并核对最终提交范围。
- 采用: 同一索引的 `pending` 已经不同于 current revision 时直接拒绝，不累加、不合并、不覆盖。期望内容核对、替换、读回和失败恢复由 version-control 在同一受锁边界完成，其他待提交路径保持不变。
- 采用: 路径或 ID 无效、输入索引或来源 revision 不完整、集合级契约改变、目标完整校验失败、current revision 改变或待提交写入冲突时，不接受部分目标并返回稳定诊断。
