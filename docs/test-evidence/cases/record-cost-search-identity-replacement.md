### Case RECORD-COST-CASE-029: 搜索读取身份替换

Tests:
- `test:ddf9902ba173bebb4c3614fd7490c32faf8c43c122c03f7000db3380a3749e1c`

Tags:
- `record-cost`

Contract:
- 来源在访问前被替换为符号链接等不安全对象时必须拒绝。

Proves:
- 先读取一条，再替换后续来源并验证拒绝。
