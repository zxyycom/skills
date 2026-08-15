### Case DECISION-FILESYSTEM-SCAN-READ-FAILURES-001: Scan 报告文件系统读取失败

Entry:
- `tools/decision-records/tests/filesystem-boundaries.test.ts > scan reports root archive index and source read failures with their actionable paths`
- `bun test --test-name-pattern="^scan\ reports\ root\ archive\ index\ and\ source\ read\ failures\ with\ their\ actionable\ paths$" ./tools/decision-records/tests/run.ts`

Contract:
- Scan 遇到决策根、archive、索引或决策源的读取失败时，必须在相应错误集合中保留可定位路径和底层原因。

Proves:
- 注入的四种读取失败分别报告根目录、archive、`decision-index.json` 或 `use-generated-cli.md`，且包含模拟失败原因。
