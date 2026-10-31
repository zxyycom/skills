### Case DECISION-CLI-ACTIVATE-ALIGNMENT-001: Publish 要求 alignment 参数

Tests:
- `test:27c2d2edad3be51f9b1bf1a2271f8c9edfc141c7907196b07cc7741497f7fcf9`

Tags:
- `decision-records`

Contract:
- Publish 必须由调用方显式提供建立后的 alignment。

Proves:
- 未提供 `--alignment` 的 publish 调用退出 2，并报告该必需选项。
