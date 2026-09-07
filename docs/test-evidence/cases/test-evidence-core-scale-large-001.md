### Case TEST-EVIDENCE-CORE-SCALE-LARGE-001: 一万个索引 Case 保持精确筛选与分页

Tests:
- `test:54693db5ad61b6141ba40ed34e1e791ba199b9f86af1c8861eb09805c432ed50`

Tags:
- `test-evidence`

Contract:
- 大规模索引仍以精确 test ID 和分页查询 Case，不以不完整候选集报告成功。

Proves:
- 10,000 个 Case 的精确 test ID 查询返回唯一预期 Case。
