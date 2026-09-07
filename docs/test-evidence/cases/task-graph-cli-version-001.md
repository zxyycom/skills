### Case TASK-GRAPH-CLI-VERSION-001: Version 使用 JSON 协议报告 3.1.0

Tests:
- `test:9984c414b7b8aa79665cbd2fb167715747299e6a5f8b3c203458a9c974e603a0`

Tags:
- `task-graph`

Contract:
- --version 使用单个 LF 结尾 JSON success 报告当前 task-graph 版本且不读取 index revision。

Proves:
- 结果逐字段为 name task-graph、version 3.0.0 与 revision null。
