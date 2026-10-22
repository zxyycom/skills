### Case TEST-EVIDENCE-SELECTED-SYNC-001: selected sync accepts one Case change only after proving the full catalog

Tests:
- `test:9c91d146ff63257470715034bae03ea240cb7a5c46c6e9e9618c9660a569ab9d`

Tags:
- `test-evidence`

Contract:
- selected sync 完整校验 Case-only 目录，仅接纳所选 Case 变化；未选 Case 漂移必须先恢复或全量同步。

Proves:
- 所选与未选 Case 同时变化时返回 unselected-changes，索引字节不变；恢复未选 Case 后只更新所选 revision。
- 目录中存在无效 Case 时返回 source-invalid，索引字节仍不变。
