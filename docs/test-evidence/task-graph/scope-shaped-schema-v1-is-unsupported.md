### Case TASK-GRAPH-SCHEMA-V1-001: scope 形态的 schema v1 不进入兼容路径

Entry:
- `tools/task-graph/tests/schema-index.test.ts > scope-shaped schema v1 is unsupported without a compatibility path`
- `bun test --test-name-pattern="^scope-shaped schema v1 is unsupported without a compatibility path$" ./tools/task-graph/tests/run.ts`

Contract:
- 当前解析器只接受根级 `tasks` 字典的 schema v2，不提供旧结构读取、双写或迁移协议。

Proves:
- 带 `nextIds` 和 `scopes` 的 schema v1 索引稳定返回 `SCHEMA_UNSUPPORTED`，不会被解释为当前索引。
