### Case TEST-EVIDENCE-INDEX-SYNC-001: 分发 sync 仅在显式 write 时生成索引

Tests:
- `test:84f7c555eb35f98488b6e67f8af3a0d4f6b536335662132f3591dc397488610d`

Tags:
- `test-evidence`

Contract:
- 分发 CLI 的 sync 在没有 `--write` 时只能返回检查结果，不得创建索引；显式 `--write` 才可写入派生索引。

Proves:
- 缺失索引的 JSON sync check 以退出码 1 返回有效 sync 结果且不创建文件；带 `--write` 的调用成功创建索引。
