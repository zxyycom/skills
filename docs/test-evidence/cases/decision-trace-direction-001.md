### Case DECISION-TRACE-DIRECTION-001: Trace 遵循前序与后继方向

Tests:
- `test:f0cf375cd2958a20e91d5962ba51cb0ac8a945a0890248239213e105381bdefb`

Tags:
- `decision-records`

Contract:
- trace 按 predecessors/successors 方向遍历稳定 ID 关系。

Proves:
- 真实 Decision 索引图分别从拆分后继向前序、从归并前序向后继追踪，断言 traceIds 与事件 context；该节点不覆盖无前序边界。
