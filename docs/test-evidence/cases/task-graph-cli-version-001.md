### Case TASK-GRAPH-CLI-VERSION-001: Version 使用 JSON 协议报告 3.1.0

Tests:
- `test:0bb51b9e874239472492ccfc749110fa0f067247ef997fd1d00ee8bd8f0b2c01`

Tags:
- `task-graph`

Contract:
- --version 使用单个 LF 结尾 JSON success 报告当前 task-graph 版本且不读取 index revision。

Proves:
- 结果逐字段为 name task-graph、version 3.0.0 与 revision null。
