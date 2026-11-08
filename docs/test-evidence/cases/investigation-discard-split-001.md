### Case INVESTIGATION-DISCARD-SPLIT-001: discard rejects a removal that breaks split relation closure

Tests:
- `test:3c86fdaaa55859c0a267821abf94e5bf6c2ec64e650fa8d0d196093eb99b689d`

Tags:
- `investigation-report`

Contract:
- discard 不得破坏调查拆分关系的完整闭合。

Proves:
- 删除会使前序仅剩一个拆分后继时失败，目标报告和索引保留。
