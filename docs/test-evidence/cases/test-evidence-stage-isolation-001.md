### Case TEST-EVIDENCE-STAGE-ISOLATION-001: 选择性暂存使用现有 Git 索引边界

Tests:
- `test:14993d5380123e49f45b803773114651af08c55604a206027e51e8d6e2779e6f`

Tags:
- `test-evidence`

Contract:
- 选择性暂存只能通过既有 Git 索引边界发布所选 Case 的派生索引变化，且不得改写已暂存的无关文件。

Proves:
- cached 文件仅为 `test-evidence-index.json` 与预置的 `unrelated.txt`，且 `unrelated.txt` 的 cached 字节保持原样。
