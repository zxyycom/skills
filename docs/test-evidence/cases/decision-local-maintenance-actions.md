### Case DECISION-LOCAL-MAINTENANCE-ACTIONS-001: 普通生命周期与关系操作沿用发布基线

Tests:
- `test:5bb957883b2ab14e1f8dabcd608cec2aaea11060c857cb37403f7b9e21fd9b6d`

Tags:
- `decision-records`

Contract:
- 普通 publish/evolve（无删除）、set-relations、archive 和 reactivate 使用发布图与必要来源，不验收无关当前正文。

Proves:
- 无关 B 坏源存在时上述操作按序成功，演进关系与 A 归档结果准确，B 坏源不变且全集 check 仍失败。
