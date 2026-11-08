### Case IR-TRACE-FRONTIER-001: 已接纳事件仍出现在后续预算 frontier

Tests:
- `test:2c718c871cf6740716b37b1512215345d38e6a7330d6dfe4fa6802023616f350`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- 预算 frontier 保留当前排序中剩余单位的全部 traceIds，即使单位已被整体接纳；已接纳事件不应被报告为 blocked event。

Proves:
- IR 发布索引上合法归并 z 到 b/p/q 且 a 补充 p，预算 4 时，traceIds 为 b/p/q/z、无 context 或 blocked event，p-successors 保持 [a,z]，q-successors 保持 [z]。该节点直接调用 IR 查询投影，不声称覆盖真实 CLI。
