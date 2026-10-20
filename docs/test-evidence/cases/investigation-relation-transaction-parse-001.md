### Case INVESTIGATION-RELATION-TRANSACTION-PARSE-001: set-relations parses complete source groups and rejects ambiguous grouping

Tests:
- `test:d512726158b4d655aeb64195154b28136934b31c3243d818703e1b8f0871418b`

Tags:
- `investigation-report`

Contract:
- `set-relations` 只接受完整 source 关系组，拒绝歧义参数分组。

Proves:
- 缺少 source 的 relation 参数以用法错误退出。
