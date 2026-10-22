### Case DECISION-CANDIDATE-ACTIVATION-SELECTION-001: 源码查询发现候选且激活只索引审核目标

Tests:
- `test:10742b04fe87dd1d1c0aa373c0a6cd4d386ee062b8d2c1cf8636d0e6e67a9b99`

Tags:
- `decision-records`

Contract:
- 候选列表发现来源集合，show-candidate 只报告所选与直接依赖问题；普通发布只建立所选 ready 候选，不默认重新验收或提醒无关来源。

Proves:
- show-candidate 不泄漏无关坏源警告；发布后索引只包含已选候选，未选候选由显式候选/检查入口继续发现。
