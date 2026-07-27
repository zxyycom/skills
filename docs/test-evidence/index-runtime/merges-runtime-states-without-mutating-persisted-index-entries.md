### Case INDEX-RUNTIME-RUNTIME-OVERLAY-001: 合并运行时状态且不修改持久化条目
Entry:
- `tools/index-runtime/tests/query.test.ts > merges runtime states without mutating persisted index entries`
- `bun test --test-name-pattern="^merges runtime states without mutating persisted index entries$" ./tools/index-runtime/tests/run.ts`
Contract:
- 运行时状态只能覆盖当前查询投影，不得回写持久化索引。
Proves:
- 动态键可命中覆盖状态，而原索引条目仍不含该键。
