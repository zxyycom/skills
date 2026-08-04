# Proposal

本 change 计划让 test-evidence 使用 `index-runtime` 的选择性索引物化能力，把指定 case 与完整派生索引写入同一个一致的 `pending` 测试证据范围。

## Why

测试证据以 topic 表和独立 case Markdown 为权威源，却共用一个完整 `test-evidence-index.json`。只暂存当前 filesystem 索引会带入未选择 case 的投影；只暂存索引而不带对应权威 case，又会使 pending 中的 metadata、成员和 `sourceRevision` 与来源不一致。

公共索引物化及其首个 decision-records 真实接入由前置 change [`materialize-selected-index-state`](../materialize-selected-index-state/) 承接。本 change 只补测试证据领域责任：读取 version-control revision 中的 topic/case、解析选中的 filesystem case、计算目标 `sourceRevision`、提供 companion catalog/case files，并请求共享 version-control 写入 `pending`。

## Outcome

- 测试证据 CLI 提供 `stage <case-path...>`，选择证据根相对 case 路径。
- 未选择 case 使用 revision 内容，选中路径按 filesystem 状态新增、替换或删除。
- `index-runtime` 从证据基线 state 与选择变化物化完整目标索引。
- 测试证据领域把目标 topic 表和完整 case 文件作为 companion files，与索引一起替换 `pending` 证据范围。
- 既有查询、检查、同步和 case 维护继续只操作 filesystem。

## Scope

纳入范围：

- `stage` CLI、topic/case adapter、目标 metadata/`sourceRevision`、companion files、文本/JSON 结果与 `pending` 证据范围。
- test-evidence-review 的行为文档、独立版本、生成制品、测试、测试证据和长期决策。

不纳入范围：

- investigation-report 的选择性暂存。
- 公共索引物化实现或通用 `pending` 写入实现。
- topic 表局部选择、代码自动暂存、索引格式变化，或让既有命令感知 `pending`。

## Success Criteria

- filesystem 同时有 A/B 两个 case 变化时，stage A 生成 revision+A 的完整索引和证据集合；B 保留在 filesystem 且不进入 `pending`。
- 同领域 `pending` 已含 B 时，stage A 整体重置为 revision+A；范围外 `pending` 保持不变。
- 新增、修改、删除和显式重命名正确；重复、非法或两处都不存在的路径在写入前失败。
- `index-runtime` 接收基线 case state、选择变化、目标 topics metadata 与目标 `sourceRevision`；证据代码不重复实现索引 state overlay。
- 已有 revision 集合固定使用 revision topic 表；首次集合才从 filesystem 引导完整合法 topic 表。
- `pending` 中 topic 表、完整 case 文件和索引同源；stage 不修改 filesystem，也不自动暂存测试或产品代码。
- 前置公共 change 已完成 decision-records 强制接入及其回归；目标测试、生成漂移、类型检查、严格检查与 `bun run check` 通过。

## Affected Owners

- [`materialize-selected-index-state`](../materialize-selected-index-state/)：本 change 的公共能力前置。
- `tools/test-evidence/` 与 [`skills/test-evidence-review/`](../../skills/test-evidence-review/)：领域 adapter、CLI、机器结果、行为与分发。
- [`tools/shared/version-control.md`](../../tools/shared/version-control.md)：既有 pending 范围替换 owner。
- `docs/decisions/test-evidence-review/`、`docs/skills/test-evidence-review.md` 与 `docs/test-evidence/`：长期方向、人类说明和测试证据。
