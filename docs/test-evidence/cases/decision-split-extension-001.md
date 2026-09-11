### Case DECISION-SPLIT-EXTENSION-001: Evolve 选全既有成员后扩充闭合拆分

Tests:
- `test:a67584e58ed14d103abc92c6ab2c3e0f5ba8fd95381c1e5c1feea511cde92831`

Tags:
- `decision-records`

Contract:
- 已存在闭合拆分时，新增直接后继必须在同一次 evolve 中显式选择全部既有后继和新增候选。

Proves:
- 同时选择两个既有后继和第三个候选后，第三个后继建立并保存指向共同粗前序的拆分关系。
- 扩充后的完整决策集合通过严格检查。
