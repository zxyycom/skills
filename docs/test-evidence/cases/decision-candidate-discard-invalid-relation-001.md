### Case DECISION-CANDIDATE-DISCARD-INVALID-RELATION-001: Discard 拒绝关系目标无效的候选

Tests:
- `test:12136384c530c8dd56c4c5de910a43c782317d6555a098cb99d16e945d0fa699`

Tags:
- `decision-records`

Contract:
- Discard 前必须确认候选的全部关系目标都是可解析的有效决策记录，不能通过删除来源掩盖无效关系。

Proves:
- 候选指向缺少必需正文的扫描目标时，discard 返回目标无效诊断。
- 拒绝后关系来源、无效目标与正式索引均保持不变。
