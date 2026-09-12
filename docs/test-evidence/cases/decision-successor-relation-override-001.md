### Case DECISION-SUCCESSOR-RELATION-OVERRIDE-001: 后继局部完整 override 优先于事务默认值

Tests:
- `test:683bc9ad7b65829c45335d083232297fe6b1924fad74148dbd5c8e20ed77694c`

Tags:
- `decision-records`

Contract:
- 事务准备为每个 successor 采用 `successor.relationOverride ?? transaction.relationOverride`；局部 source 和空 replacement 都不得回退到事务默认 replacement。

Proves:
- 局部 source 保留原关系，局部空 replacement 清空关系，局部非空 replacement 取代事务默认集合。
