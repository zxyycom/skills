### Case DECISION-CANDIDATE-RELATION-MISSING-001: 候选关系校验拒绝缺失目标

Tests:
- `test:dc539c34ad7d6485cb7dda2a8543bb6b28e3b571c77f34e2d506403c1efcd0c5`

Tags:
- `decision-records`

Contract:
- 候选关系的目标必须存在于可扫描的决策集合中。

Proves:
- 正文校验器对显式可用目标集合之外的修订目标返回 target does not exist，document=null；不读取目标文件。
