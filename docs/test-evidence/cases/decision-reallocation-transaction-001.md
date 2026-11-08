### Case DECISION-REALLOCATION-TRANSACTION-001: 稀疏重划提交与前序归档

Tests:
- `test:9bffb128cdc9fc093743a4dac03e6087f745c4c52f29483675891bfb3842e484`

Tags:
- `decision-records`

Contract:
- evolve 接受连通稀疏多前序多后继重划，归档活动前序并分别确认后继 alignment。

Proves:
- 原生操作先拒绝只选择一个后继并保留索引和两个活动前序；选择完整两个后继后提交，两个前序归档、后继 alignment 各异，索引保留 2+1 条稀疏边及各边摘要，最终图验证成功。
