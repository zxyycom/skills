### Case DECISION-CANDIDATE-RELATION-REPEATED-TARGET-001: 候选关系校验拒绝重复目标

Tests:
- `test:e220a04ecd94aa66e4c31e6f7aba7845dc7ee281233b8c7ea1ddf793fa23496c`

Tags:
- `decision-records`

Contract:
- 同一候选的直接关系集合中，每个目标只能出现一次，即使关系类型不同也不能重复。

Proves:
- 同一目标同时出现修订与替代时，原生 candidate parser 拒绝，真实 `show-candidate` 返回非成功状态与 `ok:false`；节点不断言旧 TS 错误文字。
