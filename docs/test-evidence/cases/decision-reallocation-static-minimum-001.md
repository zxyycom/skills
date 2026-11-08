### Case DECISION-REALLOCATION-STATIC-MINIMUM-001: 严格关系检查拒绝规模不足的重划分量

Tests:
- `test:7b51c6051faa3cf1fc1d60e8b03cdc2957686f8099d43631b1ae0db5eacc288f`

Tags:
- `decision-records`

Contract:
- 已建立关系图中的重划分量至少有两个直接后继。

Proves:
- 真实原生索引图中，两个前序和两个后继的稀疏重划有效；移除一个后继的关系后图校验失败。该节点不验证前序不足分支或具体诊断文本。
