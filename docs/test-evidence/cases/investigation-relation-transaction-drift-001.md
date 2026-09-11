### Case INVESTIGATION-RELATION-TRANSACTION-DRIFT-001: set-relations rejects source or index drift before publishing

Tests:
- `test:104402c4821e19dfcb3e1b11ccef579de0cf0132865d8884b18e2af21d40783b`

Tags:
- `investigation-report`

Contract:
- 关系事务在发布前拒绝报告来源或索引漂移。

Proves:
- 发布前重新读取发现索引或报告来源字节漂移时返回不含写入的 `no-change` mutation 结果。
