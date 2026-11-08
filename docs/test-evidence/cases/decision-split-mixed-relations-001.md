### Case DECISION-SPLIT-MIXED-RELATIONS-001: 同次事务不得混合拆分与普通后继

Tests:
- `test:903d91097b3fae84e188a150e21fc63bdb6f74f1a0f4b8f4aa37d67f22d625fa`

Tags:
- `decision-records`

Contract:
- 拆分事件的所选后继须组成完整且纯粹的拆分策略。

Proves:
- 两个候选分别只含拆分和修订边时，原生预检拒绝，索引不变、两活动前序仍在原位；该节点不承诺特定诊断文案。
