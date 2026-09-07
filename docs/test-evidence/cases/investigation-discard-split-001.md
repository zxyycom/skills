### Case INVESTIGATION-DISCARD-SPLIT-001: discard rejects a removal that breaks split relation closure

Tests:
- `test:fcfd2dade266c95d524b5590c10d123b7292996c756592552b05e9780919ad76`

Tags:
- `investigation-report`

Contract:
- `discard` 必须预演最终关系图，不能删除会破坏拆分后继闭合的报告。

Proves:
- 删除会使前序只剩一个拆分后继时失败，目标报告保留。
