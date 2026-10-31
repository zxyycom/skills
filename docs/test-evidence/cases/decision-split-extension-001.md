### Case DECISION-SPLIT-EXTENSION-001: Evolve 选全既有成员后扩充闭合拆分

Tests:
- `test:8763d752db4ffe619758858b71bf4ef68279923c9ff40ba9d17c39165014c7c6`

Tags:
- `decision-records`

Contract:
- 已存在闭合拆分时，新增直接后继必须在同一次 evolve 中显式选择全部既有后继和新增候选。

Proves:
- 同时选择两个既有后继和第三个候选后，第三个后继建立并保存指向共同粗前序的拆分关系。
- 扩充后的完整决策集合通过严格检查。
