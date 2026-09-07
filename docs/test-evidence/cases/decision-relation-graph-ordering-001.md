### Case DECISION-RELATION-GRAPH-ORDERING-001: 共享边排序按 UTF-16 代码单元排序且不改变输入

Tests:
- `test:129c5ee13444b82710d70e3b1801fd05f9e9d6335f0fd36893fae4d8d9227716`

Tags:
- `decision-records`

Contract:
- 需要规范边顺序的调用方显式使用共享排序能力，排序不得依赖 locale 或修改输入集合。

Proves:
- source、type 与 target 的大小写及连字符组合按 UTF-16 代码单元稳定排序。
- 输入数组中的边顺序保持不变。
