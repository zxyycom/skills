### Case RECORD-COST-CASE-014: 搜索权限访问边界

Tests:
- `test:ad768b2a987a3b5f194e11a1524d048ecb600af16d9325d9bec0e242c9bf3a36`

Tags:
- `record-cost`

Contract:
- 访问不可读文件失败，预算停止后不承诺检查该文件。

Proves:
- 有权限条件时分别检查访问与未访问结果。
