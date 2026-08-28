### Case INVESTIGATION-RELATION-TRANSACTION-IDEMPOTENCE-001: set-relations is idempotent and leaves unrelated report fields unchanged

Entry:
- `tools/investigation-report/tests/transaction.test.ts > set-relations is idempotent and leaves unrelated report fields unchanged`
- `bun test --test-name-pattern="^set-relations is idempotent and leaves unrelated report fields unchanged$" ./tools/investigation-report/tests/run.ts`

Contract:
- 同一最终关系重复写入返回 unchanged，且不改写无关报告字段。

Proves:
- 第二次调用不改变报告字节，title 仍保留。
