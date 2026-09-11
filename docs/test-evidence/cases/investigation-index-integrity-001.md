### Case INVESTIGATION-INDEX-INTEGRITY-001: index loading rejects stale report projections

Tests:
- `test:8ca73d0168da6e0503e3e300ba4fe9990ed8da9d356bb09ae71bf32ca7de0531`

Tags:
- `investigation-report`

Contract:
- 索引读取必须拒绝与权威报告 Markdown 不一致的陈旧投影。

Proves:
- 报告源变化后查询返回 source 或 index 诊断。
