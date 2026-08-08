### Case TASK-GRAPH-LIST-FIELDS-001: Node 显示字段保持固定顺序

Entry:
- `tools/task-graph/tests/task-list-renderer.test.ts > task-list renderer preserves fixed node field order`
- `bun test --test-name-pattern="^task-list renderer preserves fixed node field order$" ./tools/task-graph/tests/run.ts`

Contract:
- Node 显示字段固定按 parent、needs、blocked-by、mutex、reason、next、title 排列。

Proves:
- 同时存在全部字段时逐项顺序保持固定，中文与 emoji title 位于最后且保持原值。
