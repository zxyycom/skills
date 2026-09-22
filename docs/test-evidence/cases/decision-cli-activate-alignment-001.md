### Case DECISION-CLI-ACTIVATE-ALIGNMENT-001: Publish 要求 alignment 参数

Tests:
- `test:2ac240c11034af9054eec4dda4c628546e33caea42b3d412f03c9cc0c1efcc60`

Tags:
- `decision-records`

Contract:
- Publish 必须由调用方显式提供建立后的 alignment。

Proves:
- 未提供 `--alignment` 的 publish 调用退出 2，并报告该必需选项。
