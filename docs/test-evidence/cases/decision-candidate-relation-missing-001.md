### Case DECISION-CANDIDATE-RELATION-MISSING-001: 候选关系校验拒绝缺失目标

Tests:
- `test:67f663ba1e24731309913f043092b63ac0721802258461a7eeb2d8fa308e7e48`

Tags:
- `decision-records`

Contract:
- 候选关系的目标必须存在于可扫描的决策集合中。

Proves:
- 候选修订关系指向不存在的 Markdown 路径时，严格检查报告 target does not exist。
