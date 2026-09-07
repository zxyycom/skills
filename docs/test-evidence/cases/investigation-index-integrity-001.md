### Case INVESTIGATION-INDEX-INTEGRITY-001: index loading rejects stale report projections

Tests:
- `test:e9b2cd20a6d7319170d6345d831568b5664271a5ec8f8f3e0783a7948f535779`

Tags:
- `investigation-report`

Contract:
- 索引读取必须拒绝与权威报告 Markdown 不一致的陈旧投影。

Proves:
- 报告源变化后查询返回 source 或 index 诊断。
