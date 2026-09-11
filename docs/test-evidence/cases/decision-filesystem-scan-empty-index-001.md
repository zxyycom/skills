### Case DECISION-FILESYSTEM-SCAN-EMPTY-INDEX-001: Scan 报告空索引诊断

Tests:
- `test:6bab8040bb587be9751637545b4ac390be5505827af7429eceb2852383b39f51`

Tags:
- `decision-records`

Contract:
- 空的决策索引文本必须被记录为包含索引路径的 JSON 解析诊断，而不是当作索引缺失。

Proves:
- Scan 保留 `indexExists`，并在 index errors 中给出 `decision-index.json` 的 EOF JSON 解析原因。
