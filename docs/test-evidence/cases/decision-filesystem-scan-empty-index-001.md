### Case DECISION-FILESYSTEM-SCAN-EMPTY-INDEX-001: Scan 报告空索引诊断

Tests:
- `test:18cd1c3fd940b1c0a5be65a7a45e7423e15720c45fe84b2215a734f3d516f072`

Tags:
- `decision-records`

Contract:
- 空的决策索引文本必须被记录为包含索引路径的 JSON 解析诊断，而不是当作索引缺失。

Proves:
- Scan 保留 `indexExists`，index 为 null、文本为空，并在 index errors 中给出 `decision-index.json` 路径与 JSON 解析语义诊断。
