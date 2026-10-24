### Case DECISION-INDEX-TITLE-SYNC-001: 标题更新需显式同步

Tests:
- `test:0ee2dfb958ec4391e2a633f470c70a03ab603b0b77a47dedbb7118d869ee3eac`

Tags:
- `decision-records`

Contract:
- 标题更新需显式同步。

Proves:
- 改标题后 list 仍显示旧标题；sync-index 后采用新标题并保留 status、alignment 与 createdAt。
