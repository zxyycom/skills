### Case IR-TRACE-FRONTIER-001: 已接纳事件仍出现在后续预算 frontier

Tests:
- `test:607fbca58ca4ca94a9c428d5ef9c4ac5ad3598fa87d9b128e155a415976dbc65`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- 预算 frontier 保留当前排序中剩余单位的全部 traceIds，即使单位已被整体接纳。

Proves:
- 合法归并 z 到 b/p/q 且 a 补充 p 的预算4反例，p-successors 保持 [a,z]，q-successors 保持 [z]。
