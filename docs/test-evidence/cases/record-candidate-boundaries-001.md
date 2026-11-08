### Case RECORD-CANDIDATE-BOUNDARIES-001: 候选允许未来完整关系 ID

Tests:
- `test:02be1afba29927483d2d794e1c26ee20f82a5bb6cba7e530a083c1576f2cc96a`
- `test:e69da66b29e094f28020d5e95e6ee239f428954736cf573b63f004d407c2a9e1`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- 起草时可保留尚未建立的完整关系 ID；候选发现不得把未建立目标当作自身结构错误。

Proves:
- 两域原生创建操作保留未来完整目标 ID；Decision 候选发现返回带未建立关系目标的候选并产生 warning。该组合不证明每个旧 CLI/坏索引分支，也不证明发布前最终图闭合校验。
