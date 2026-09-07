### Case DECISION-FILESYSTEM-SCAN-EMPTY-INDEX-001: Scan 报告空索引诊断

Tests:
- `test:0851082b6763774ee3e88e34e8e3ea2b4b3fff8fd2c18b5a02d897ba1b16c13a`

Tags:
- `decision-records`

Contract:
- 空的决策索引文本必须被记录为包含索引路径的 JSON 解析诊断，而不是当作索引缺失。

Proves:
- Scan 保留 `indexExists`，并在 index errors 中给出 `decision-index.json` 的 EOF JSON 解析原因。
