### Case INVESTIGATION-RELATION-TRANSACTION-DRIFT-001: set-relations rejects source or index drift before publishing

Tests:
- `test:1369d9b990f2f28beb787088536220a1988e8ac15b55e46358be4d4e28f32d72`

Tags:
- `investigation-report`

Contract:
- 关系事务在发布前拒绝报告来源或索引漂移。

Proves:
- 发布前重新读取发现索引或报告来源字节漂移时返回不含写入的 `no-change` mutation 结果。
