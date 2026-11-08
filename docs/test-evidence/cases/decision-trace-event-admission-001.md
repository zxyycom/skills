### Case DECISION-TRACE-EVENT-ADMISSION-001: Decision Trace 原子接纳关系事件

Tests:
- `test:f0cf375cd2958a20e91d5962ba51cb0ac8a945a0890248239213e105381bdefb`

Tags:
- `decision-records`

Contract:
- Decision Trace 必须把完整拆分、纯归并和稀疏重划事件作为原子接纳单元；未直接跨越的同事件成员只作为 context。

Proves:
- 原生真实 Decision 索引图对拆分、纯归并和稀疏重划分别验证：预算不足时只保留 anchor、context 为空，blockedEvent 返回事件类型、完整成员及所需预算。
- 预算足够且只遍历一层时，直接邻居进入 trace，事件其他成员进入 context；节点验证领域查询投影，不声称 CLI 呈现。
