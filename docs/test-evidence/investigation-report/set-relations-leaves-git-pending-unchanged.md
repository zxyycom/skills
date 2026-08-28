### Case INVESTIGATION-RELATION-TRANSACTION-PENDING-001: set-relations leaves Git pending unchanged

Entry:
- `tools/investigation-report/tests/transaction.test.ts > set-relations leaves Git pending unchanged`
- `bun test --test-name-pattern="^set-relations leaves Git pending unchanged$" ./tools/investigation-report/tests/run.ts`

Contract:
- 关系事务不读取或改写 Git pending。

Proves:
- 关系替换成功且无事务错误。
