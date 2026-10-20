### Case DECISION-UNRECORDED-ARCHIVED-PREDECESSOR-001: 关系事务确认尚未进入 Git HEAD 的归档直接前序

Tests:
- `test:3b2e8e72c3003905fb8966d851670610255f758d838cb5c892d57e7c419c486f`

Tags:
- `decision-records`

Contract:
- `evolve` 以候选中的关系连接尚未进入 Git HEAD 的 archived 直接前序时，首次调用必须暂停且不写入；archived 前序与 active 前序适用同一确认规则。

Proves:
- 给定前序未 recorded 的历史事实，纯生命周期准备返回 attention、对应 archived 前序提示且不含 changes。
- 确认 keep-unrecorded-history 后只生成后继的一项 active 建立变更，关系指向原归档前序，不为前序生成修改。
