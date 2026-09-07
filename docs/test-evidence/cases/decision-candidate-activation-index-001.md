### Case DECISION-CANDIDATE-ACTIVATION-INDEX-001: 激活前收敛未索引的已建立记录

Tests:
- `test:9004bf73dab69ed979ac9148a13ae3bde9389efdafd11e5c461bcb0feca3599f`

Tags:
- `decision-records`

Contract:
- 激活显式完整候选前必须从规范 Markdown 收敛已建立但未索引的记录，不能丢失任一成员。

Proves:
- 常规查询继续返回最近一次持久快照且不包含孤立来源，显式同步吸收未索引的已建立记录。
- 随后的候选激活把目标改为 active、选择 alignment 并写入建立时间，让目标和既有记录同时保留在索引。
