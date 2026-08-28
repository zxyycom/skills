### Case INVESTIGATION-RELATION-TRANSACTION-ATOMIC-001: set-relations atomically applies multi-source replacements and explicit clears

Entry:
- `tools/investigation-report/tests/transaction.test.ts > set-relations atomically applies multi-source replacements and explicit clears`
- `bun test --test-name-pattern="^set-relations atomically applies multi-source replacements and explicit clears$" ./tools/investigation-report/tests/run.ts`

Contract:
- 多 source 关系替换和显式清空在同一图预演后原子应用。

Proves:
- 双拆分关系建立成功，随后可在同一调用中清空。
