### Case TASK-GRAPH-GC-001: 批量 scope close 在全部门禁通过后一次提交

Entry:
- `tools/task-graph/tests/scope-repository.test.ts > bulk scope close validates all selections before one revision and preserves nextIds`
- `bun test --test-name-pattern="^bulk scope close validates all selections before one revision and preserves nextIds$" ./tools/task-graph/tests/run.ts`

Contract:
- 显式非空 scope 集合共用一个结果交付确认，先验证全部选择，再以一次 revision 原子关闭并保留 nextIds。

Proves:
- 包含不可关闭、空集合或重复 scope 时无变更；合法批次排序返回、只增一次 revision 且不复用 ID。
