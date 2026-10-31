### Case LIGHTWEIGHT-JUDGMENT-STATS-GROUP-001: 原型标签分组与费用隔离

Tests:
- `test:f994aaf5168a944a1af6dc4b56d848d897b902d9aab4fa88abf998a9d0855481`

Tags:
- `lightweight-judgment`

Contract:
- 原型名字标签作为自有数据参与精确筛选与分组；重复／失败默认保留，费用不跨 endpoint 无条件混总。

Proves:
- __proto__／constructor 标签组合选中两条，重复 tokens 累计10、indeterminate 错误单列；三个分组正确且两个接收方费用各自报告3。
