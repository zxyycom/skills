### Case DECISION-CANDIDATE-RELATION-REPEATED-TARGET-001: 候选关系校验拒绝重复目标

Tests:
- `test:c0dea0def8e053d7046f4a45e9c20f8475f074b458dbfaab784a0278055742bb`

Tags:
- `decision-records`

Contract:
- 同一候选的直接关系集合中，每个目标只能出现一次，即使关系类型不同也不能重复。

Proves:
- 正文校验器对同一目标同时出现修订与替代返回 repeats relationship target，document=null。
