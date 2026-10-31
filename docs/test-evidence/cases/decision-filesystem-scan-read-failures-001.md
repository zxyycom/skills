### Case DECISION-FILESYSTEM-SCAN-READ-FAILURES-001: Scan 报告文件系统读取失败

Tests:
- `test:74476a6dd057d6cd5a50113813380403d6bcafddf73c3ab3875d924de0570107`

Tags:
- `decision-records`

Contract:
- Scan 遇到决策根、archive、索引或决策源的读取失败时，必须在相应错误集合中保留可定位路径和底层原因。

Proves:
- 注入的四种读取失败分别报告根目录、archive、`decision-index.json` 或 `use-generated-cli.md`，且包含模拟失败原因。
