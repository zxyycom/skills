### Case DECISION-EVOLUTION-RELATIONS-001: 候选关系不进入正式图

Tests:
- `test:6dbb722108aad1ce5e53a09c067568959c89259f72dabbfc59c1b6c2e28ffc4d`

Tags:
- `decision-records`

Contract:
- 候选可预写关系；候选建立前不进入正式索引和关系图。

Proves:
- 一个候选指向另一个候选时，两者均可被候选发现；正式索引字节不变、均不含两者，既有正式记录仍为 active 且正式图验证成功。此节点不声称对候选执行严格全集 check。
