### Case TASK-GRAPH-CLI-SCHEMA-001: index info 保留未知 schema 诊断

Tests:
- `test:9c11856d2442bb7fa283e2716c673e5420511d610fd2aeaab153ab011d01d5c5`

Tags:
- `task-graph`

Contract:
- `index info` 必须先区分未知 schemaVersion，再应用当前版本的字段规则，并保留稳定 `SCHEMA_UNSUPPORTED` code。

Proves:
- 未知 schemaVersion 通过统一失败 envelope 返回 `SCHEMA_UNSUPPORTED`，而不是降级为普通索引格式诊断。
