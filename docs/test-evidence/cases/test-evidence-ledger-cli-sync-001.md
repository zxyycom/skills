### Case TEST-EVIDENCE-LEDGER-CLI-SYNC-001: 分发 Sync CLI 只在显式 write 时创建索引

Tests:
- `test:84f7c555eb35f98488b6e67f8af3a0d4f6b536335662132f3591dc397488610d`

Tags:
- `test-evidence`

Contract:
- 分发 CLI 的 sync check 不得隐式写入索引，只有显式 `--write` 才能创建派生索引。

Proves:
- 缺失索引的 check 返回退出码 1、有效 sync JSON 且文件仍不存在；后续 `--write` 成功创建该索引。
