### Case TASK-GRAPH-CLI-SCHEMA-001: index info 保留未知 schema 诊断

Tests:
- `test:ad91c2689ca9b03b27fd59b75c68f7fd1436b04a379703aa3904e6352997b81a`

Tags:
- `task-graph`

Contract:
- `index info` 必须先区分未知 schemaVersion，再应用当前版本的字段规则，并保留稳定 `SCHEMA_UNSUPPORTED` code。

Proves:
- 未知 schemaVersion 通过统一失败 envelope 返回 `SCHEMA_UNSUPPORTED`，而不是降级为普通索引格式诊断。
