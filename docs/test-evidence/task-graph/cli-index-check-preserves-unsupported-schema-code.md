### Case TASK-GRAPH-CLI-SCHEMA-001: index check 保留未知 schema 诊断

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI index check preserves the unsupported schema error code`
- `bun test --test-name-pattern="^CLI index check preserves the unsupported schema error code$" ./tools/task-graph/tests/run.ts`

Contract:
- index check 必须先区分未知 schemaVersion，再应用当前版本的字段和保留字规则，并保留稳定 `SCHEMA_UNSUPPORTED` code。

Proves:
- schemaVersion 2 即使同时包含当前版本拒绝的 reserved own key，仍通过单 JSON、exit 1 返回 `SCHEMA_UNSUPPORTED`，而不是泛化 `INDEX_INVALID`。
