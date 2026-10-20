### Case DECISION-EVOLVE-DISCARD-SUCCESSOR-CONFLICT-001: Evolve 拒绝同时 discard 和选择同一后继

Tests:
- `test:f923315d84c40a3c680fb07ca09051597859cf00a78aab1e7a5dac05616f3e9a`

Tags:
- `decision-records`

Contract:
- 同一关系图计划不能同时 upsert 一个 Decision ID 并删除它；`evolve --discard` 的目标不能出现在 successor 集合。

Proves:
- 纯 selector 解析与生命周期准备拒绝同时 upsert/discard 同一 ID，返回冲突领域错误且不产生 changes。
