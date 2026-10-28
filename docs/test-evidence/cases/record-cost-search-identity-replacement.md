### Case RECORD-COST-CASE-029: 搜索读取身份替换

Tests:
- `test:f5422976f61dc8d184525e2bdc16fc933dabd610115a5285b4c7c5b4923f4dab`

Tags:
- `record-cost`

Contract:
- 来源在访问前被替换为符号链接等不安全对象时必须拒绝。

Proves:
- 先读取一条，再替换后续来源并验证拒绝。
