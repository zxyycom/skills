### Case DECISION-CLI-ACTIVATE-ALIGNMENT-001: Activate 要求 alignment 参数

Tests:
- `test:4d8eaf153b6958def27b5f6ae453f7bd04cd5d0a641f3f49c88a24f23b3c8bec`

Tags:
- `decision-records`

Contract:
- Activate 必须由调用方显式提供建立后的 alignment。

Proves:
- 未提供 `--alignment` 的 activate 调用退出 2，并报告该必需选项。
