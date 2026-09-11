### Case TASK-GRAPH-PROJECTION-001: ready 与 recovery-needed task 返回正确 actionable nextAction

Tests:
- `test:dd879e4963f23f187a5ec42ecca3ebdf20f3dde449057f603d113894d4f87397`

Tags:
- `task-graph`

Contract:
- effective state 使用固定优先级；actionable 包含 ready 与 recovery-needed task，并区分叶子 claim、恢复 claim 与父任务 complete。

Proves:
- candidate、waiting、paused 和终态不进入 actionable；ready 叶子、recovery-needed 叶子和 ready 父任务分别返回 claim、claim 与 complete。
