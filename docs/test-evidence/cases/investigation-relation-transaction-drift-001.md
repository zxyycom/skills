### Case INVESTIGATION-RELATION-TRANSACTION-DRIFT-001: set-relations rejects source or index drift before publishing

Tests:
- `test:55d706a11ab26b2a7bf13f3e01259b0865d99c6ad40ee5093a144b54cac35b4d`

Tags:
- `investigation-report`

Contract:
- 关系事务在发布前拒绝相关报告来源或发布索引漂移，结构无效的索引也阻断操作。

Proves:
- 初始无效索引被拒绝；发布前重新读取发现索引字节漂移时（即使并发新增无关来源）返回不含写入的 `no-change` mutation 结果。
