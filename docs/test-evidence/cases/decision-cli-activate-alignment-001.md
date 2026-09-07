### Case DECISION-CLI-ACTIVATE-ALIGNMENT-001: Activate 要求 alignment 参数

Tests:
- `test:6aca5ec795e418505b5ec72c731a93ac4d3ddc498ddb3c1f1e7946db5555a3c4`

Tags:
- `decision-records`

Contract:
- Activate 必须由调用方显式提供建立后的 alignment。

Proves:
- 未提供 `--alignment` 的 activate 调用退出 2，并报告该必需选项。
