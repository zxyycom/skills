### Case TEST-EVIDENCE-LEDGER-CLI-SYNC-001: Sync CLI 只在显式 write 时更新索引
Entry:
- `tools/test-evidence/tests/ledger-cli.test.ts > ledger CLI sync-index separates check from explicit atomic writes`
- `bun test --test-name-pattern="^ledger CLI sync-index separates check from explicit atomic writes$" ./tools/test-evidence/tests/run.ts`
Contract:
- `sync-index` 默认只检查，只有 `--write` 才能执行原子重建。
Proves:
- 缺失索引的默认命令失败，显式写入返回 written，随后文本检查报告 current。
