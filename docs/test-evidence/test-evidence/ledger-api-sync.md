### Case TEST-EVIDENCE-LEDGER-API-SYNC-001: 同步 API 明确区分检查与写入状态
Entry:
- `tools/test-evidence/tests/ledger-api.test.ts > ledger sync API distinguishes check write current and unchanged states`
- `bun test --test-name-pattern="^ledger sync API distinguishes check write current and unchanged states$" ./tools/test-evidence/tests/run.ts`
Contract:
- 同步 API 的 check 不写入，write 仅在需要时原子更新索引，并返回可判定状态。
Proves:
- 缺失、首次写入、当前和重复写入分别返回 index-missing、written、current 与 unchanged。
