### Case TEST-EVIDENCE-LEDGER-INDEX-SYNC-001: Ledger 索引同步确定且兼容双空账本
Entry:
- `tools/test-evidence/tests/ledger-index.test.ts > ledger sync writes deterministic populated and empty indexes without creating case directories`
- `bun test --test-name-pattern="^ledger sync writes deterministic populated and empty indexes without creating case directories$" ./tools/test-evidence/tests/run.ts`
Contract:
- 写入同步必须确定、幂等，并能为双空账本生成空索引而不创建 Case 目录。
Proves:
- 第二次写入保持字节不变，空账本生成空 entries 且 `cases/` 仍不存在。
