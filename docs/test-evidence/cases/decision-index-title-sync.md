### Case DECISION-INDEX-TITLE-SYNC-001: 标题更新需显式同步

Tests:
- `test:e87372c9b5159dc9f2c6adf6a2abb066f22ba1e859927142ffca777b3f69b13b`

Tags:
- `decision-records`

Contract:
- 标题更新需显式同步。

Proves:
- 改标题后 list 仍显示旧标题；sync-index 后采用新标题并保留 status、alignment 与 createdAt。
