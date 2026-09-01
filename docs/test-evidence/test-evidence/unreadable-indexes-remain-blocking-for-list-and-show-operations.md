### Case TEST-EVIDENCE-UNREADABLE-INDEX-001: 不可读索引阻断 list 与 show
Entry:
- `tools/test-evidence/tests/catalog.test.ts > unreadable indexes remain blocking for list and show operations`
- `bun test --test-name-pattern="^unreadable indexes remain blocking for list and show operations$" ./tools/test-evidence/tests/catalog.test.ts`
Contract:
- 无法安全读取且不可回退的索引错误必须阻断 list 与 show。
Proves:
- 两种操作都不返回 case，并报告 blocking `state-index.index-read-failed`。
