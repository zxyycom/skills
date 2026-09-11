### Case TEST-EVIDENCE-SELECTED-SYNC-001: selected sync accepts one Case change only after proving the full catalog

Tests:
- `test:9c91d146ff63257470715034bae03ea240cb7a5c46c6e9e9618c9660a569ab9d`

Tags:
- `test-evidence`

Contract:
- selected sync 只更新所选 Case 条目，但仍完整校验 Case-only 目录。

Proves:
- 所选 Case 变化只改变自身 revision；目录中存在无效 Case 时 selected sync 以 source-invalid 阻断。
