### Case TEST-EVIDENCE-SELECTED-SYNC-001: selected sync accepts one Case change only after proving the full catalog

Tests:
- `test:eb43a98f7b1213a72569a1279b84082825abfa3dac6c2e62a31bbaccbac3c35b`

Tags:
- `test-evidence`

Contract:
- selected sync 只更新所选 Case 条目，但仍完整校验 Case-only 目录。

Proves:
- 所选 Case 变化只改变自身 revision；目录中存在无效 Case 时 selected sync 以 source-invalid 阻断。
