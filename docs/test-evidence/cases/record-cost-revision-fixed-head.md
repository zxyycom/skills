### Case RECORD-COST-CASE-028: 固定 HEAD 读取

Tests:
- `test:f47dcd497690374e2c3803c60a79a6bf150c8ce0073aacd6e5b0d903f6af6d51`

Tags:
- `record-cost`

Contract:
- prepare 后 HEAD 变更不得改变已准备内容。

Proves:
- 真实 Git 新提交后仍读取原提交字节。
