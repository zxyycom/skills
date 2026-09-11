### Case TEST-EVIDENCE-STAGE-ISOLATION-001: 选择性暂存使用现有 Git 索引边界

Tests:
- `test:2fdf2b45de9b4a6c43902ed59ad145287dc00f1d1d6e979e8d8146716e31dfe0`

Tags:
- `test-evidence`

Contract:
- 选择性暂存只能通过既有 Git 索引边界发布所选 Case 的派生索引变化，且不得改写已暂存的无关文件。

Proves:
- cached 文件仅为 `test-evidence-index.json` 与预置的 `unrelated.txt`，且 `unrelated.txt` 的 cached 字节保持原样。
