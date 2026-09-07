### Case DECISION-CLI-TRACE-DEPTH-001: Trace 拒绝负深度

Tests:
- `test:2563f323a6ce45ef0bfbc8b4e9a14d31cf45473311ada05cc34030d193f3d4f6`

Tags:
- `decision-records`

Contract:
- Trace depth 必须是非负整数。

Proves:
- `--depth -1` 使 trace 退出 2 并报告 must be a non-negative integer。
