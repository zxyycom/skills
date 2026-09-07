### Case DECISION-FILESYSTEM-SCAN-READ-FAILURES-001: Scan 报告文件系统读取失败

Tests:
- `test:8e51c0a347097ac35e83f562d912a3d0f51fd3c8442d565c197667a196a32212`

Tags:
- `decision-records`

Contract:
- Scan 遇到决策根、archive、索引或决策源的读取失败时，必须在相应错误集合中保留可定位路径和底层原因。

Proves:
- 注入的四种读取失败分别报告根目录、archive、`decision-index.json` 或 `use-generated-cli.md`，且包含模拟失败原因。
