### Case INVESTIGATION-DISCARD-SPLIT-001: discard rejects a removal that breaks split relation closure

Tests:
- `test:a995ab2772dae0229ed6eeffd30efad8f19ad814181a60e3952e2e215e9b5abe`

Tags:
- `investigation-report`

Contract:
- `discard` 必须预演最终关系图，不能删除会破坏拆分后继闭合的报告。

Proves:
- 删除会使前序只剩一个拆分后继时失败，目标报告保留。
