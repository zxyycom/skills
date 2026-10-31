### Case DECISION-CANDIDATE-ACTIVATION-SELECTION-001: 源码查询发现候选且激活只索引审核目标

Tests:
- `test:f0e116999ed261a9cd263b9591eaab0ef7a7207e811aecff69f60fa3f4100ce6`

Tags:
- `decision-records`

Contract:
- 候选列表发现来源集合，show-candidate 只报告所选与直接依赖问题；普通发布只建立所选 ready 候选，不默认重新验收或提醒无关来源。

Proves:
- show-candidate 不泄漏无关坏源警告；发布后索引只包含已选候选，未选候选由显式候选/检查入口继续发现。
