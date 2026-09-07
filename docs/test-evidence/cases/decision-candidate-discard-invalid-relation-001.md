### Case DECISION-CANDIDATE-DISCARD-INVALID-RELATION-001: Discard 拒绝关系目标无效的候选

Tests:
- `test:30b6c904173aef4987a002b9dacd1a22c7aef3b978f6468f1d1c78dda0e76e20`

Tags:
- `decision-records`

Contract:
- Discard 前必须确认候选的全部关系目标都是可解析的有效决策记录，不能通过删除来源掩盖无效关系。

Proves:
- 候选指向缺少必需正文的扫描目标时，discard 返回目标无效诊断。
- 拒绝后关系来源、无效目标与正式索引均保持不变。
