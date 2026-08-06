# Proposal

本 proposal 计划让 `index-runtime` 按条目暂存单文件索引：调用方只给出本次选择的条目 id，索引运行时自行生成只包含这些条目变化的完整 `pending` 索引。

## Why

一个 state index 会把一个领域的全部条目聚合到同一个 JSON 文件。多个任务即使分别修改不同条目，也会同时修改这个文件；普通文件级暂存只能暂存整个文件，因而会把其他任务尚未完成的索引变化一起带入。

`index-runtime` 已经管理索引结构、稳定 id、条目投影、完整校验和确定性序列化。它也能读取当前 revision 中的索引和工作区中的索引，因此调用方不需要重新描述基线、增删改类型或完整目标内容，只需要说明本次选择哪些 id。

这项能力只解决索引文件自身的独立暂存。条目对应的 Markdown、目录表、topic 表、代码或其他领域文件仍由接入方决定是否以及怎样暂存。

## Outcome

- `index-runtime` 提供按稳定 id 暂存索引条目的公共操作；配置好 definition、root 和 index path 后，调用方只传选中的 id。
- 操作以当前 revision 索引为基线，以工作区索引为候选。选中的条目采用工作区状态，未选中的条目保持 revision 状态。
- 新增、修改和删除都由 id 在两份索引中的存在状态表达；重命名由调用方同时选择旧 id 和新 id 表达。
- 选择结果重新构造成一个完整、合法且确定的索引，并只写入目标索引的 `pending` 表示；工作区索引保持不变。
- 同一索引已经存在待提交变化时直接拒绝，不合并、不覆盖；其他路径的待提交内容保持不变。
- `index-runtime` 不读取、选择或暂存任何领域文件。

## Scope

纳入范围：

- 按选中 id 合并 revision 索引与工作区索引的公共 API、runtime 方法、结果类型和稳定诊断。
- 已有条目修改、新增、删除、显式重命名、首次索引、合法空结果和无实际变化。
- 目标完整索引的重新投影、完整校验、确定性序列化和 revision 计算，以及 `StateSnapshot.revision` / `readRevision` 的统一语义。
- 同一索引已有待提交变化时的受锁拒绝，以及目标之外待提交内容的保留。
- `index-runtime`、共享 version-control、必要的现有索引消费者兼容调整、测试证据和长期决策。

不纳入范围：

- 领域 Markdown、目录表、topic 表、代码或其他文件的发现、选择、生成、校验、暂存或提交。
- 让调用方提供完整基线、显式变化对象、目标 metadata、目标 revision、完整目标索引或待提交文件列表。
- 在同一索引已有待提交变化时累加选择或自动合并多个任务。
- 按条目选择索引级 metadata、definition 或任意 JSON 字段。
- 为 investigation-report、test-evidence 或其他领域实现自己的暂存命令。

## Success Criteria

- 对 revision 索引 `A0/B0/C0` 与工作区索引 `A1/B1/C1` 选择 `A/C` 后，`pending` 索引为 `A1/B0/C1`，工作区索引仍为 `A1/B1/C1`。
- 调用方只提供选中 id；公共暂存 API 不接收领域文件、基线条目、变化类型、metadata、revision 或完整索引。
- 修改、新增、删除和显式重命名都能通过同一 id 选择规则完成；未选中的工作区变化不进入结果。
- 目标索引重新投影并通过完整校验；选择顺序不影响结果，目标 revision 与最终规范化索引一致。
- metadata 变化、无效输入索引、选中 id 在两边都不存在或最终集合无效时，`pending` 不发生变化。
- 同一索引已有待提交变化时直接拒绝；两个并发调用不能互相覆盖。
- 成功只改变目标索引的 `pending` 内容；工作区文件、领域文件和其他待提交路径保持不变。
- index-runtime、version-control、受影响消费者、类型检查、生成漂移、测试证据和 `bun run check` 通过。

## Affected Owners

- [`tools/index-runtime/README.md`](../../tools/index-runtime/README.md)、`tools/index-runtime/src/` 与 `tests/`：条目选择、完整索引重建、revision、公共 API、runtime 方法和行为证据。
- [`tools/shared/version-control.md`](../../tools/shared/version-control.md)、`tools/shared/src/version-control/` 与测试：受锁核对目标索引的既有 `pending` 状态并完成替换。
- `tools/decision-records/`、`tools/investigation-report/` 与 `tools/test-evidence/`：适配统一的索引 revision 契约；领域文件暂存不进入本 change。
- [`docs/decisions/index-runtime/stage-selected-index-entries.md`](../../docs/decisions/index-runtime/stage-selected-index-entries.md) 与统一决策索引：记录并跟踪本能力的长期方向和执行状态。
- [`stage-selected-investigations`](../stage-selected-investigations/) 与 [`stage-selected-test-evidence`](../stage-selected-test-evidence/)：后续领域接入只向索引运行时传递选中 id，领域文件仍由各自 change 负责。
- `docs/test-evidence/`：新增或修改最小测试入口的权威 case 与派生索引。
