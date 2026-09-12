### Case DECISION-EVOLVE-GROUPED-RECOVERY-001: 分组 Evolve 发布失败时回滚且不输出成功 review

Tests:
- `test:2137937005904ad67bffc1cbbc8fd9bbdfe5361745b144a2c8b580a59f0d1cdd`

Tags:
- `decision-records`

Contract:
- 分组关系仍属于同一可恢复事务；索引发布失败后必须恢复全部后继与索引，并且不能将 relationReview 声明为 committed。

Proves:
- 两个分组都已计划替换时注入索引发布失败，命令退出失败、stdout 为空，两个 Markdown 与索引都回到原始字节。
