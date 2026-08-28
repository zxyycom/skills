### Case INVESTIGATION-RELATION-TRANSACTION-PARSE-001: set-relations parses complete source groups and rejects ambiguous grouping

Entry:
- `tools/investigation-report/tests/transaction.test.ts > set-relations parses complete source groups and rejects ambiguous grouping`
- `bun test --test-name-pattern="^set-relations parses complete source groups and rejects ambiguous grouping$" ./tools/investigation-report/tests/run.ts`

Contract:
- `set-relations` 只接受完整 source 关系组，拒绝歧义参数分组。

Proves:
- 缺少 source 的 relation 参数以用法错误退出。
