### Case DECISION-FILESYSTEM-SCAN-EMPTY-INDEX-001: Scan 报告空索引诊断

Entry:
- `tools/decision-records/tests/filesystem-boundaries.test.ts > scan reports an empty decision index as an actionable index diagnostic`
- `bun test --test-name-pattern="^scan\ reports\ an\ empty\ decision\ index\ as\ an\ actionable\ index\ diagnostic$" ./tools/decision-records/tests/run.ts`

Contract:
- 空的决策索引文本必须被记录为包含索引路径的 JSON 解析诊断，而不是当作索引缺失。

Proves:
- Scan 保留 `indexExists`，并在 index errors 中给出 `decision-index.json` 的 EOF JSON 解析原因。
