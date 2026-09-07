### Case DECISION-CANDIDATE-RELATION-SELF-001: 候选关系校验拒绝自引用

Tests:
- `test:d30b8ab5d83626839ecab0c5d4c4e4bb32b828753365bf853a450756fe3b7c8b`

Tags:
- `decision-records`

Contract:
- 候选不能以自身决策路径作为关系目标。

Proves:
- 候选修订关系指向自身时，严格检查报告 must not relate to itself。
