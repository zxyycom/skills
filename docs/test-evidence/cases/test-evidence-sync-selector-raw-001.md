### Case TEST-EVIDENCE-SYNC-SELECTOR-RAW-001: selected sync 在写入前拒绝畸形 Case ID

Tests:
- `test:8614266e2876cda0451548b38697527299ab50f1d95eb99b5ea747385584b6d0`

Tags:
- `test-evidence`

Contract:
- selected sync 只接受合法 Case ID；畸形 selector 必须在写入派生索引前失败。

Proves:
- 畸形 selector 返回 source-invalid 与 index.selection-invalid，且索引字节保持原样。
