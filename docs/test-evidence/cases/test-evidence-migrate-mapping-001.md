### Case TEST-EVIDENCE-MIGRATE-MAPPING-001: 迁移拒绝零匹配与多匹配快照实体

Tests:
- `test:91698e529e5d593d850d2e6849c8525228353765ebbb1719e2870f443297eeab`

Tags:
- `repository-tooling`

Contract:
- 每个保留旧 Entry 必须精确映射到唯一的快照实体，不能以旧字符串伪造实体 ID。

Proves:
- 零匹配或多匹配的 Entry 以阻断结果结束。
