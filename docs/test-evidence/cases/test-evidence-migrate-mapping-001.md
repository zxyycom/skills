### Case TEST-EVIDENCE-MIGRATE-MAPPING-001: 迁移拒绝零匹配与多匹配快照实体

Tests:
- `test:2a0ad2955f411c1f13aa2e7ee74b84702751f027bd8449d45165a4c71eb7477b`

Tags:
- `repository-tooling`

Contract:
- 每个保留旧 Entry 必须精确映射到唯一的快照实体，不能以旧字符串伪造实体 ID。

Proves:
- 零匹配或多匹配的 Entry 以阻断结果结束。
