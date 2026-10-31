### Case DECISION-RELATION-GRAPH-ORDERING-001: 共享边排序按 UTF-16 代码单元排序且不改变输入

Tests:
- `test:b0f7b666e98f3c32352408c7e34be50c724be32fa4b5b5b85a2967044608248b`

Tags:
- `decision-records`

Contract:
- 需要规范边顺序的调用方显式使用共享排序能力，排序不得依赖 locale 或修改输入集合。

Proves:
- source、type 与 target 的大小写及连字符组合按 UTF-16 代码单元稳定排序。
- 输入数组中的边顺序保持不变。
