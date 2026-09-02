### Case INVESTIGATION-RELATION-TRANSACTION-DRIFT-001: set-relations rejects source or index drift before publishing

Entry:
- `tools/investigation-report/tests/transaction.test.ts > set-relations rejects source or index drift before publishing`
- `bun test --test-name-pattern="^set-relations rejects source or index drift before publishing$" ./tools/investigation-report/tests/run.ts`

Contract:
- 关系事务在发布前拒绝报告来源或索引漂移。

Proves:
- 发布前重新读取发现索引或报告来源字节漂移时返回不含写入的 `no-change` mutation 结果。
