### Case TASK-GRAPH-CLI-VERSION-001: Version 使用 JSON 协议报告 3.1.0

Tests:
- `test:ca9a93cea9584b0021c96070c1b3a2e2cd36cd3eb60f5fd012c39abe9dcc0441`

Tags:
- `task-graph`

Contract:
- --version 使用单个 LF 结尾 JSON success 报告当前 task-graph 版本且不读取 index revision。

Proves:
- 结果逐字段为 name task-graph、version 3.0.0 与 revision null。
