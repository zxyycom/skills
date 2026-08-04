# Proposal

本 change 计划让 investigation-report 使用 `index-runtime` 的选择性索引物化能力，把指定调查主题与完整派生索引写入同一个一致的 `pending` 调查范围。

## Why

多个调查主题会长期并行演进，但全部主题共用一个完整 `investigation-index.json`。只暂存当前 filesystem 索引会带入未选择主题的投影；只暂存索引文件而不带对应权威主题，又会使 pending 中的 `sourceRevision` 与来源不一致。

公共索引物化及其首个 decision-records 真实接入由前置 change [`materialize-selected-index-state`](../materialize-selected-index-state/) 承接。本 change 只补调查领域责任：读取 version-control revision 与选中的 filesystem 主题、解析主题 state、计算目标 `sourceRevision`、提供 companion topic files，并请求共享 version-control 写入 `pending`。

## Outcome

- 调查 CLI 提供 `stage <topic-path...>`，选择调查根相对主题路径。
- 未选择主题使用 revision 内容，选中路径按 filesystem 状态新增、替换或删除。
- `index-runtime` 从调查基线 state 与选择变化物化完整目标索引。
- 调查领域把完整目标主题文件作为 companion files，与索引一起替换 `pending` 调查范围。
- `check`、`sync-index`、`list` 和报告维护继续只操作 filesystem。

## Scope

纳入范围：

- `stage` CLI、调查 source adapter、目标 metadata/`sourceRevision`、companion files 与 `pending` 调查范围。
- investigation-report 的行为文档、独立版本、生成制品、测试、测试证据和长期决策。

不纳入范围：

- test-evidence 的选择性暂存。
- 公共索引物化实现或通用 `pending` 写入实现。
- 调查索引格式变化，或让 `check`、`sync-index`、`list` 感知 `pending`。

## Success Criteria

- filesystem 同时有 A/B 两项调查变化时，stage A 生成 revision+A 的完整索引和主题集合；B 保留在 filesystem 且不进入 `pending`。
- 同领域 `pending` 已含 B 时，stage A 整体重置为 revision+A；范围外 `pending` 保持不变。
- 新增、修改、删除和显式重命名正确；重复、非法或两处都不存在的路径在写入前失败。
- `index-runtime` 接收调查基线 state、选择变化、空 metadata 与目标 `sourceRevision`；调查代码不重复实现索引 state overlay。
- `pending` 中完整主题文件与索引同源；stage 不修改 filesystem。
- 前置公共 change 已完成 decision-records 强制接入及其回归；调查目标测试、生成漂移、类型检查、严格检查与 `bun run check` 通过。

## Affected Owners

- [`materialize-selected-index-state`](../materialize-selected-index-state/)：本 change 的公共能力前置。
- `tools/investigation-report/` 与 [`skills/investigation-report/`](../../skills/investigation-report/)：调查 adapter、CLI、行为与分发。
- [`tools/shared/version-control.md`](../../tools/shared/version-control.md)：既有 pending 范围替换 owner。
- `docs/decisions/investigation-report/`、`docs/skills/investigation-report.md` 与 `docs/test-evidence/`：长期方向、人类说明和测试证据。
