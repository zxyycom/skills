### Case DECISION-CANDIDATE-RELATION-SELF-001: 候选关系校验拒绝自引用

Tests:
- `test:22b275edc0abb13faef5e18188f0572669f1230ddea420452b40bca33c7c1f29`

Tags:
- `decision-records`

Contract:
- 候选不能以自身决策路径作为关系目标。

Proves:
- 正文校验器对候选修订关系指向自身返回 must not relate to itself，document=null。
