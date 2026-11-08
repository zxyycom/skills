### Case DECISION-STAGE-ISOLATION-001: Stage 隔离未选择的文件系统变更

Tests:
- `test:61d316dba451f4db3a103b26f69e1d08965cafd346032d8e837f970b14e34326`

Tags:
- `decision-records`

Contract:
- stage 刷新所选 scope，同时保留未选 pending。

Proves:
- 真实 Git 中先暂存新增 B，再 index/domain 刷新 A，B 的 pending 正文和无关 pending 均保持。
