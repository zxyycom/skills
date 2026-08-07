### Case TASK-GRAPH-CLI-SCHEMA-001: index info 保留未知 schema 诊断

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI index info preserves the unsupported schema error code`
- `bun test --test-name-pattern="^CLI index info preserves the unsupported schema error code$" ./tools/task-graph/tests/run.ts`

Contract:
- `index info` 必须先区分未知 schemaVersion，再应用当前版本的字段规则，并保留稳定 `SCHEMA_UNSUPPORTED` code。

Proves:
- 未知 schemaVersion 通过统一失败 envelope 返回 `SCHEMA_UNSUPPORTED`，而不是降级为普通索引格式诊断。
