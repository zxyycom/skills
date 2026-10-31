### Case INVESTIGATION-RELATION-TRANSACTION-PARSE-001: set-relations parses complete source groups and rejects ambiguous grouping

Tests:
- `test:a2e018d815986f8cbbc0a4cd992e36674ccd15746cb7337fa1d3add6510453ce`

Tags:
- `investigation-report`

Contract:
- `set-relations` 只接受完整 source 关系组，拒绝歧义参数分组。

Proves:
- 缺少 source 的 relation 参数以用法错误退出。
