### Case DECISION-EVOLVE-GROUPED-COMPLETE-REPLACEMENT-001: 分组与事件闭合分别验收

Tests:
- `test:320fde9d3a0ba83c866f78352fb7415ba9be78162aafab473d823f61af629adb`
- `test:c4f68b6f910843204ea7ed757acb56c82e9282aac5777faf3e8824884a418f21`

Tags:
- `decision-records`

Contract:
- 分组必须完整有效，拆分最终事件必须选择全部后继。

Proves:
- 参数解析拒绝空分组及清空/关系混用等非法形状；独立原生事务预检拒绝遗漏既有拆分后继并保持来源及索引字节。两项为分层证据，不声称已穷举各组 predecessor 不一致及混合类型。
