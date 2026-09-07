### Case TEST-EVIDENCE-SYNC-SELECTOR-RAW-001: selected sync 在写入前拒绝畸形 Case ID

Tests:
- `test:6ae36ea65bdf8960dadb7af62f855af4ad6ab50c0806a06057b0d28637dcdf0a`

Tags:
- `test-evidence`

Contract:
- selected sync 只接受合法 Case ID；畸形 selector 必须在写入派生索引前失败。

Proves:
- 畸形 selector 返回 source-invalid 与 index.selection-invalid，且索引字节保持原样。
