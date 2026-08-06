# Proposal

本 change 计划让 investigation-report 把选中的调查主题 id 直接交给 `index-runtime`，只暂存这些主题对应的 `investigation-index.json` 条目。

## Why

多个调查主题会长期并行演进，但全部主题共用一个完整 `investigation-index.json`。主题 Markdown 本身是独立文件，可以由调用方按路径决定暂存范围；真正无法用普通文件级暂存隔离的是这个聚合索引。

前置 change [`stage-selected-index-entries`](../stage-selected-index-entries/)负责通用索引的按条目暂存。调查索引的稳定 id 已经是调查根相对主题路径，因此本 change 只需提供领域命令并把选中 id 原样交给配置完成的索引运行时。调查 Markdown 是否进入 `pending` 仍由调用方或调查领域的其他流程决定。

## Outcome

- 调查 CLI 提供 `stage-index <topic-id...>`，其中 topic id 就是调查根相对主题路径。
- investigation-report 校验选中 id 后直接调用 `stageSelectedEntries`，不建立第二套选择身份。
- 未选择主题的工作区索引变化不进入 `pending`；同一索引已有待提交变化时直接拒绝。
- 命令只报告索引暂存结果，不读取、写入或暂存调查 Markdown。
- `check`、`sync-index`、`list` 和报告维护继续只操作 filesystem。

## Scope

纳入范围：

- 调查主题 id 校验、选择性索引暂存 CLI、文本与 JSON 结果。
- investigation-report 的行为文档、独立版本、生成制品、测试、测试证据和长期决策。

不纳入范围：

- 调查 Markdown 或其他领域文件的暂存、提交或跨文件事务。
- test-evidence 的选择性索引暂存。
- 公共索引按条目暂存或通用 `pending` 写入的实现。
- 调查索引格式变化，或让 `check`、`sync-index`、`list` 感知 `pending`。

## Success Criteria

- filesystem 同时有 A/B 两项调查索引变化时，选择 A 只把 A 的索引变化带入 `pending`，B 仍只存在于工作区索引。
- 调查 CLI 只向配置完成的 index runtime 传递 A 的稳定 id，不提供基线 state、变化对象、metadata、revision 或调查文件。
- 新增、修改、删除和显式重命名正确；重复、非法或两份索引都不存在的主题 id 在写入前失败。
- 同一 investigation index 已有待提交变化时直接拒绝，不重置、不累加；其他待提交路径保持不变。
- 命令不修改 filesystem，也不暂存调查 Markdown；调用方可独立选择对应领域文件。
- 目标测试、生成漂移、类型检查、严格检查与 `bun run check` 通过。

## Affected Owners

- [`stage-selected-index-entries`](../stage-selected-index-entries/)：本 change 的公共能力前置。
- `tools/investigation-report/` 与 [`skills/investigation-report/`](../../skills/investigation-report/)：主题 id 输入、CLI、结果、行为与分发。
- [`tools/index-runtime/README.md`](../../tools/index-runtime/README.md)：既有按条目暂存契约，本 change 只作为调用方接入。
- `docs/decisions/investigation-report/`、`docs/skills/investigation-report.md` 与 `docs/test-evidence/`：长期方向、人类说明和测试证据。
