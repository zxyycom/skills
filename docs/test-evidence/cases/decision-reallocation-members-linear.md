### Case DECISION-REALLOCATION-MEMBERS-001: 合法稀疏重划完整遍历不重复处理全成员

Tests:
- `test:bd6516a02175a4c343c68813ee67464d78896fe5ebc6ebe48a565856de8c6c5e`

Tags:
- `performance`

Contract:
- 重划完整成员原子接纳，不同 direct 单位仍晋升实际可达成员。

Proves:
- 真实 Markdown 在内存中解析的 d=10/100/300 稀疏圈通过领域及策略 shape/closure 检查；完整 trace 接纳全部 2d 成员且无 context，full member descriptor/filter 工作至多 2d，不依赖落盘或 Git。
