### Case DECISION-SPLIT-EXTENSION-001: Evolve 选全既有成员后扩充闭合拆分

Tests:
- `test:6db9b139dda2366eb9e7bc438d743a05665796779c257fbd17b512a8936b32d4`

Tags:
- `decision-records`

Contract:
- 已存在闭合拆分时，新增直接后继必须在同一次 evolve 中显式选择全部既有后继和新增候选。

Proves:
- 同时选择两个既有后继和第三个候选后，第三个后继建立并保存指向共同粗前序的拆分关系。
- 扩充后的完整决策集合通过严格检查。
