### Case DECISION-ACTIVATION-RELATION-001: Activate 建立候选来源关系并归档活动目标

Tests:
- `test:178472a35cc87d8ff707416c24cdb6285b83a2f2041254ff10213754b11feae3`

Tags:
- `decision-records`

Contract:
- 新候选未收到 CLI 关系覆盖时，自身保存的完整关系必须成为最终关系，并与候选建立、活动前序归档和索引重建在同一事务中生效。

Proves:
- 带来源关系的候选在建立前通过严格检查。
- 单次 activate 建立候选、保存来源关系，并把关系指向的活动前序归档。
