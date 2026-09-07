### Case INVESTIGATION-INDEX-QUERY-001: list uses Investigation ID ordering and repeated tag filters use AND

Tests:
- `test:0facc169363282d37f2e2a74dd8027577cf43b6934d08d30c8399cdeee680bd3`

Tags:
- `investigation-report`

Contract:
- 报告 list 按 Investigation ID 确定性排序，重复 tag 条件使用 AND。

Proves:
- 两个 tag 条件只返回同时具有两者的报告。
