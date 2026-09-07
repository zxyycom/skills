### Case INVESTIGATION-RELATION-TRANSACTION-PARSE-001: set-relations parses complete source groups and rejects ambiguous grouping

Tests:
- `test:cbe987d97e045ad9cb000021ed5ea4913f59c98aaa59c912be79965ec242f62b`

Tags:
- `investigation-report`

Contract:
- `set-relations` 只接受完整 source 关系组，拒绝歧义参数分组。

Proves:
- 缺少 source 的 relation 参数以用法错误退出。
