# Proposal

本 change 计划让 test-evidence 把选中的 case id 交给 `index-runtime`，只暂存这些 case 对应的 `test-evidence-index.json` 条目。

## Why

测试证据的 topic 表和 case Markdown 是独立领域文件，却共用一个完整 `test-evidence-index.json`。领域文件和代码可以由调用方分别选择；真正无法用普通文件级暂存隔离的是聚合索引中的 case 条目。

已归档的前置 change [`stage-selected-index-entries`](../archive/stage-selected-index-entries/)完成了通用索引的按条目暂存；当前行为契约由 [`Index Runtime`](../../tools/index-runtime/README.md) 承接。test-evidence 已经使用稳定 case id 作为索引 id，因此本 change 只需提供领域命令并把选中 id 原样交给配置完成的索引运行时。topic 表、case Markdown 和代码是否进入 `pending` 不属于索引暂存入口。

## Outcome

- 测试证据 CLI 提供 `stage-index <case-id...>`，直接接收一个或多个稳定 case id。
- test-evidence 校验选中 id 后直接调用 `stageSelectedEntries`，不建立第二套选择身份。
- 未选择 case 的工作区索引变化不进入 `pending`；同一索引已有待提交变化时直接拒绝。
- 命令只报告索引暂存结果，不读取、写入或暂存 topic 表、case Markdown 或代码。
- 既有查询、检查、同步和 case 维护继续只操作 filesystem。

## Scope

纳入范围：

- case id 校验、选择性索引暂存 CLI、文本与 JSON 结果。
- test-evidence-review 的行为文档、独立版本、生成制品、测试、测试证据和长期决策。

不纳入范围：

- topic 表、case Markdown、测试代码或产品代码的暂存、提交或跨文件事务。
- investigation-report 的选择性索引暂存。
- 公共索引按条目暂存或通用 `pending` 写入的实现。
- topic 表局部选择、索引格式变化，或让既有命令感知 `pending`。

## Success Criteria

- filesystem 同时有 A/B 两个 case 索引变化时，选择 A 只把 A 的索引变化带入 `pending`，B 仍只存在于工作区索引。
- 测试证据 CLI 只向配置完成的 index runtime 传递 A 的稳定 id，不提供基线 state、变化对象、metadata、revision 或领域文件。
- 新增、修改、删除和显式重命名正确；重复、非法或两份索引都不存在的 case id 在写入前失败。
- 同一 test-evidence index 已有待提交变化时直接拒绝，不重置、不累加；其他待提交路径保持不变。
- 命令不修改 filesystem，也不暂存 topic 表、case Markdown 或代码；调用方可独立选择这些文件。
- 目标测试、生成漂移、类型检查、严格检查与 `bun run check` 通过。

## Affected Owners

- [`stage-selected-index-entries`](../archive/stage-selected-index-entries/)：本 change 的公共能力前置及历史实现记录，不是当前行为 owner。
- `tools/test-evidence/` 与 [`skills/test-evidence-review/`](../../skills/test-evidence-review/)：case id 输入、CLI、结果、行为与分发。
- [`tools/index-runtime/README.md`](../../tools/index-runtime/README.md)：既有按条目暂存契约，本 change 只作为调用方接入。
- `docs/decisions/test-evidence-review/`、`docs/skills/test-evidence-review.md` 与 `docs/test-evidence/`：长期方向、人类说明和测试证据。
