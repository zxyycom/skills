### Case TASK-GRAPH-PROJECTION-001: ready 与 recovery-needed task 返回正确 actionable nextAction

Tests:
- `test:09c74b38878b76a0814bef8b8bdd2bc61f046787ced53fdabdbef0215adbd09d`

Tags:
- `task-graph`

Contract:
- effective state 使用固定优先级；actionable 包含 ready 与 recovery-needed task，并区分叶子 claim、恢复 claim 与父任务 complete。

Proves:
- candidate、waiting、paused 和终态不进入 actionable；ready 叶子、recovery-needed 叶子和 ready 父任务分别返回 claim、claim 与 complete。
