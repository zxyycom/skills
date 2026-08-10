### Case TEST-EVIDENCE-LEDGER-EMPTY-LEDGER-001: 合法双空 Ledger 无需 Case 目录
Entry:
- `tools/test-evidence/tests/ledger-api.test.ts > legal empty ledgers pass validation and queries without creating Case directories`
- `bun test --test-name-pattern="^legal empty ledgers pass validation and queries without creating Case directories$" ./tools/test-evidence/tests/run.ts`
Contract:
- 零 Test、零 Case 的已初始化 Ledger 必须通过校验、列表和 Test 查询，且不同步创建 `cases/`。
Proves:
- 空账本写出零条目索引后摘要与查询均为空，show 按目标不存在处理，Case 目录仍缺失。
