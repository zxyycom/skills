### Case INVESTIGATION-RELATION-TRANSACTION-DRIFT-001: set-relations rejects source or index drift before publishing

Tests:
- `test:104402c4821e19dfcb3e1b11ccef579de0cf0132865d8884b18e2af21d40783b`

Tags:
- `investigation-report`

Contract:
- 关系事务在发布前拒绝相关报告来源或发布索引漂移，结构无效的索引也阻断操作。

Proves:
- 初始无效索引被拒绝；发布前重新读取发现索引字节漂移时（即使并发新增无关来源）返回不含写入的 `no-change` mutation 结果。
