### Case DECISION-CLI-TRACE-DEPTH-001: Trace 拒绝负深度

Tests:
- `test:cc4fdf0c53274c80404fe585847736815cf0463782fb626536f2132089c6241c`

Tags:
- `decision-records`

Contract:
- Trace depth 必须是非负整数。

Proves:
- `--depth -1` 使 trace 退出 2 并报告 must be a non-negative integer。
