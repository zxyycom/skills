### Case DECISION-EVOLVE-DISCARD-SUCCESSOR-CONFLICT-001: Evolve 拒绝同时 discard 和选择同一后继

Tests:
- `test:f923315d84c40a3c680fb07ca09051597859cf00a78aab1e7a5dac05616f3e9a`

Tags:
- `decision-records`

Contract:
- 同一关系图计划不能同时 upsert 一个 Decision ID 并删除它；`evolve --discard` 的目标不能出现在 successor 集合。

Proves:
- CLI 在写入前拒绝冲突的 operation plan，并保留目标 Markdown 和正式索引原文。
