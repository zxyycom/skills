### Case DECISION-EVOLVE-DISCARD-SUCCESSOR-CONFLICT-001: Evolve 拒绝同时 discard 和选择同一后继

Tests:
- `test:dddf55e2948eda62c3093dd7d587e4da9547fbb6487fe23d50b975d36100b04f`

Tags:
- `decision-records`

Contract:
- 同一关系图计划不能同时 upsert 一个 Decision ID 并删除它；`evolve --discard` 的目标不能出现在 successor 集合。

Proves:
- 纯 selector 解析与生命周期准备拒绝同时 upsert/discard 同一 ID，返回冲突领域错误且不产生 changes。
