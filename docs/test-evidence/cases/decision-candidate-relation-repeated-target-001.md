### Case DECISION-CANDIDATE-RELATION-REPEATED-TARGET-001: 候选关系校验拒绝重复目标

Tests:
- `test:fc0b885a48b853bb641eb5d2b86b475583d121e1fe245c55ad78faeaf9dc1263`

Tags:
- `decision-records`

Contract:
- 同一候选的直接关系集合中，每个目标只能出现一次，即使关系类型不同也不能重复。

Proves:
- 正文校验器对同一目标同时出现修订与替代返回 repeats relationship target，document=null。
