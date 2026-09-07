### Case TASK-GRAPH-CLI-SCHEMA-001: index info 保留未知 schema 诊断

Tests:
- `test:cab7527936d988e7bf3da55a4a4b84712f215f3a626eeef292b001ae4f8b7436`

Tags:
- `task-graph`

Contract:
- `index info` 必须先区分未知 schemaVersion，再应用当前版本的字段规则，并保留稳定 `SCHEMA_UNSUPPORTED` code。

Proves:
- 未知 schemaVersion 通过统一失败 envelope 返回 `SCHEMA_UNSUPPORTED`，而不是降级为普通索引格式诊断。
