### Case DECISION-CANDIDATE-DISCARD-UNBORN-001: Discard 对空已记录集合准备候选删除

Tests:
- `test:20c624af74c72be43ae4cc4757538d904b784e06a9261a47792a109c0fed525b`

Tags:
- `decision-records`

Contract:
- 已记录 Decision ID 集合为空时，完整且未被引用的 candidate 可由普通 discard 准备删除。

Proves:
- 向领域准备传入显式空 git-head baseline，得到唯一候选删除计划，精确包含来源路径、原字节与 nextText=null。
