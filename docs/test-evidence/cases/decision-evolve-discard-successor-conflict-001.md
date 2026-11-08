### Case DECISION-EVOLVE-DISCARD-SUCCESSOR-CONFLICT-001: Evolve 拒绝删除同一后继

Tests:
- `test:75c6229410dd053e583578775f6f176c74e12440f41ac89fdecac96cbf89eeb4`

Tags:
- `decision-records`

Contract:
- 同一计划不能既选择又删除相同 Decision ID。

Proves:
- 原生操作以名称选候选、完整 ID 删除同一候选，预检返回 discard 错误，候选字节不变且未创建索引。
